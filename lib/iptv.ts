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
  }

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

export async function queryChannels(q: ChannelQuery): Promise<ChannelPage> {
  const ds = await getDataset();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(120, Math.max(1, q.pageSize ?? 60));
  const search = q.search?.trim().toLowerCase();

  let items = ds.channels;

  if (!q.nsfw) items = items.filter((c) => !c.isNsfw);
  if (q.country) items = items.filter((c) => c.countryCode === q.country);
  if (q.category) items = items.filter((c) => c.categoryIds.includes(q.category!));
  if (q.language) items = items.filter((c) => c.languages.includes(q.language!));
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
