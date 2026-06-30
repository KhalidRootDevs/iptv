import type {
  ApiCategory,
  ApiChannel,
  ApiCountry,
  ApiLanguage,
  ApiLogo,
  ApiStream,
  Channel,
  ChannelPage,
  ChannelQuery,
  Filters,
  FilterOption,
  Stats,
  Stream,
} from "./types";

const API = "https://iptv-org.github.io/api";
// Re-fetch upstream data at most this often (seconds). The dataset changes
// a few times a day, so 6h keeps it fresh without hammering the origin.
const REVALIDATE = 60 * 60 * 6;

async function getJson<T>(file: string): Promise<T> {
  const res = await fetch(`${API}/${file}`, {
    next: { revalidate: REVALIDATE },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${file}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// Map a quality string ("720p", "1080p", "4k") to a comparable number.
function qualityRank(q: string | null): number {
  if (!q) return 0;
  const lower = q.toLowerCase();
  if (lower.includes("4k") || lower.includes("2160")) return 2160;
  const m = lower.match(/(\d{3,4})/);
  return m ? parseInt(m[1], 10) : 0;
}

// Bucket a quality into a coarse, filterable tier.
const QUALITY_TIERS: { value: string; label: string; min: number }[] = [
  { value: "uhd", label: "4K / UHD", min: 2160 },
  { value: "fhd", label: "Full HD (1080p)", min: 1080 },
  { value: "hd", label: "HD (720p)", min: 720 },
  { value: "sd", label: "SD", min: 1 },
];

function qualityBucket(q: string | null): string | null {
  const r = qualityRank(q);
  if (r <= 0) return null;
  return QUALITY_TIERS.find((t) => r >= t.min)?.value ?? null;
}

interface Dataset {
  channels: Channel[];
  byId: Map<string, Channel>;
  filters: Filters;
}

let cache: { data: Dataset; builtAt: number } | null = null;
let inflight: Promise<Dataset> | null = null;

async function build(): Promise<Dataset> {
  const [channels, streams, countries, categories, languages, logos] =
    await Promise.all([
      getJson<ApiChannel[]>("channels.json"),
      getJson<ApiStream[]>("streams.json"),
      getJson<ApiCountry[]>("countries.json"),
      getJson<ApiCategory[]>("categories.json"),
      getJson<ApiLanguage[]>("languages.json"),
      getJson<ApiLogo[]>("logos.json"),
    ]);

  const countryByCode = new Map(countries.map((c) => [c.code, c]));
  const categoryById = new Map(categories.map((c) => [c.id, c.name]));
  const languageByCode = new Map(languages.map((l) => [l.code, l.name]));
  const channelById = new Map(channels.map((c) => [c.id, c]));

  // Best logo per channel: prefer in_use, then largest.
  const logoByChannel = new Map<string, string>();
  for (const logo of logos) {
    if (!logo.channel || !logo.url) continue;
    const existing = logoByChannel.get(logo.channel);
    if (!existing || logo.in_use) logoByChannel.set(logo.channel, logo.url);
  }

  // Group streams by channel id. Orphan streams (channel === null) get grouped
  // by their title so duplicates collapse into a single playable entry.
  const streamsByChannel = new Map<string, Stream[]>();
  const orphanStreams = new Map<string, Stream[]>();
  for (const s of streams) {
    if (!s.url) continue;
    const stream: Stream = {
      url: s.url,
      quality: s.quality,
      label: s.label,
      userAgent: s.user_agent,
      referrer: s.referrer,
    };
    if (s.channel) {
      const arr = streamsByChannel.get(s.channel);
      if (arr) arr.push(stream);
      else streamsByChannel.set(s.channel, [stream]);
    } else {
      const key = s.title || s.url;
      const arr = orphanStreams.get(key);
      if (arr) arr.push(stream);
      else orphanStreams.set(key, [stream]);
    }
  }

  const result: Channel[] = [];

  const sortStreams = (arr: Stream[]) =>
    arr.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));

  // Channels that have at least one stream.
  for (const [channelId, chStreams] of streamsByChannel) {
    const meta = channelById.get(channelId);
    sortStreams(chStreams);
    const country = meta ? countryByCode.get(meta.country) : undefined;
    const langNames = country
      ? country.languages
          .map((code) => languageByCode.get(code))
          .filter((n): n is string => Boolean(n))
      : [];

    result.push({
      id: channelId,
      name: meta?.name ?? channelId,
      logo: logoByChannel.get(channelId) ?? null,
      country: country?.name ?? null,
      countryCode: meta?.country ?? null,
      flag: country?.flag ?? null,
      categories: meta
        ? meta.categories.map((id) => categoryById.get(id) ?? id)
        : [],
      categoryIds: meta?.categories ?? [],
      languages: langNames,
      isNsfw: meta?.is_nsfw ?? false,
      website: meta?.website ?? null,
      network: meta?.network ?? null,
      streams: chStreams,
      bestQuality: chStreams[0]?.quality ?? null,
    });
  }

  // Orphan streams without channel metadata — still playable.
  let orphanIdx = 0;
  for (const [title, chStreams] of orphanStreams) {
    sortStreams(chStreams);
    result.push({
      id: `orphan-${orphanIdx++}`,
      name: title,
      logo: null,
      country: null,
      countryCode: null,
      flag: null,
      categories: [],
      categoryIds: [],
      languages: [],
      isNsfw: false,
      website: null,
      network: null,
      streams: chStreams,
      bestQuality: chStreams[0]?.quality ?? null,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));

  // Build filter facets with counts.
  const countryCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const languageCounts = new Map<string, number>();
  const qualityCounts = new Map<string, number>();
  for (const ch of result) {
    if (ch.countryCode)
      countryCounts.set(
        ch.countryCode,
        (countryCounts.get(ch.countryCode) ?? 0) + 1,
      );
    for (const cat of ch.categoryIds)
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
    for (const lang of ch.languages)
      languageCounts.set(lang, (languageCounts.get(lang) ?? 0) + 1);
    const bucket = qualityBucket(ch.bestQuality);
    if (bucket) qualityCounts.set(bucket, (qualityCounts.get(bucket) ?? 0) + 1);
  }

  const qualityOptions: FilterOption[] = QUALITY_TIERS.map((t) => ({
    value: t.value,
    label: t.label,
    count: qualityCounts.get(t.value) ?? 0,
  })).filter((o) => o.count > 0);

  const countryOptions: FilterOption[] = [...countryCounts.entries()]
    .map(([code, count]) => {
      const c = countryByCode.get(code);
      return {
        value: code,
        label: c?.name ?? code,
        flag: c?.flag,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const categoryOptions: FilterOption[] = [...categoryCounts.entries()]
    .map(([id, count]) => ({
      value: id,
      label: categoryById.get(id) ?? id,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const languageOptions: FilterOption[] = [...languageCounts.entries()]
    .map(([name, count]) => ({ value: name, label: name, count }))
    .sort((a, b) => b.count - a.count);

  const byId = new Map(result.map((c) => [c.id, c]));

  return {
    channels: result,
    byId,
    filters: {
      countries: countryOptions,
      categories: categoryOptions,
      languages: languageOptions,
      qualities: qualityOptions,
      totalChannels: result.length,
    },
  };
}

async function getDataset(): Promise<Dataset> {
  // Serve from in-process cache for the revalidate window.
  if (cache && Date.now() - cache.builtAt < REVALIDATE * 1000) {
    return cache.data;
  }
  if (inflight) return inflight;
  inflight = build()
    .then((data) => {
      cache = { data, builtAt: Date.now() };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function getFilters(): Promise<Filters> {
  const ds = await getDataset();
  return ds.filters;
}

export async function getChannel(id: string): Promise<Channel | null> {
  const ds = await getDataset();
  return ds.byId.get(id) ?? null;
}

export async function getRelated(
  channel: Channel,
  limit = 12,
): Promise<Channel[]> {
  const ds = await getDataset();
  const cats = new Set(channel.categoryIds);
  const scored: { c: Channel; score: number }[] = [];

  for (const c of ds.channels) {
    if (c.id === channel.id || c.isNsfw) continue;
    let score = 0;
    if (channel.countryCode && c.countryCode === channel.countryCode) score += 2;
    if (cats.size && c.categoryIds.some((id) => cats.has(id))) score += 3;
    if (score > 0) scored.push({ c, score });
  }

  scored.sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.slice(0, limit).map((s) => s.c);
}

export async function getStats(): Promise<Stats> {
  const ds = await getDataset();
  const { channels, filters } = ds;

  let totalStreams = 0;
  let channelsWithLogo = 0;
  let nsfwCount = 0;
  let multiSourceCount = 0;

  // Quality buckets keyed by display label.
  const buckets = { "4K": 0, "Full HD": 0, HD: 0, SD: 0, Unknown: 0 };

  for (const c of channels) {
    totalStreams += c.streams.length;
    if (c.logo) channelsWithLogo++;
    if (c.isNsfw) nsfwCount++;
    if (c.streams.length > 1) multiSourceCount++;

    const q = c.bestQuality?.toLowerCase() ?? "";
    const v = q.includes("4k") || q.includes("2160")
      ? 2160
      : Number(q.match(/(\d{3,4})/)?.[1] ?? 0);
    if (v >= 2160) buckets["4K"]++;
    else if (v >= 1080) buckets["Full HD"]++;
    else if (v >= 720) buckets.HD++;
    else if (v > 0) buckets.SD++;
    else buckets.Unknown++;
  }

  return {
    totalChannels: channels.length,
    totalStreams,
    totalCountries: filters.countries.length,
    totalCategories: filters.categories.length,
    totalLanguages: filters.languages.length,
    channelsWithLogo,
    nsfwCount,
    multiSourceCount,
    topCountries: filters.countries.slice(0, 12),
    topCategories: filters.categories.slice(0, 12),
    topLanguages: filters.languages.slice(0, 12),
    qualityDistribution: Object.entries(buckets).map(([label, count]) => ({
      label,
      count,
    })),
  };
}

export async function queryChannels(q: ChannelQuery): Promise<ChannelPage> {
  const ds = await getDataset();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(120, Math.max(1, q.pageSize ?? 60));
  const search = q.search?.trim().toLowerCase();

  let items = ds.channels;

  // Multi-select: OR within a facet, AND across facets.
  const countries = q.countries?.length ? new Set(q.countries) : null;
  const categories = q.categories?.length ? new Set(q.categories) : null;
  const languages = q.languages?.length ? new Set(q.languages) : null;
  const qualities = q.qualities?.length ? new Set(q.qualities) : null;

  if (!q.nsfw) items = items.filter((c) => !c.isNsfw);
  if (countries)
    items = items.filter((c) => c.countryCode && countries.has(c.countryCode));
  if (categories)
    items = items.filter((c) => c.categoryIds.some((id) => categories.has(id)));
  if (languages)
    items = items.filter((c) => c.languages.some((l) => languages.has(l)));
  if (qualities) {
    items = items.filter((c) => {
      const b = qualityBucket(c.bestQuality);
      return b !== null && qualities.has(b);
    });
  }
  if (search)
    items = items.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        (c.country?.toLowerCase().includes(search) ?? false),
    );

  if (q.sort === "country") {
    items = [...items].sort(
      (a, b) =>
        (a.country ?? "￿").localeCompare(b.country ?? "￿") ||
        a.name.localeCompare(b.name),
    );
  } else if (q.sort === "quality") {
    items = [...items].sort(
      (a, b) => qualityRank(b.bestQuality) - qualityRank(a.bestQuality),
    );
  }
  // default sort (by name) is already applied at build time.

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return { items: pageItems, total, page, pageSize, totalPages };
}
