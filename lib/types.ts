// Raw shapes returned by the iptv-org public API (https://iptv-org.github.io/api).

export interface ApiChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string; // ISO 3166-1 alpha-2
  subdivision: string | null;
  city: string | null;
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}

export interface ApiStream {
  channel: string | null;
  feed: string | null;
  title: string;
  url: string;
  quality: string | null;
  label: string | null;
  user_agent: string | null;
  referrer: string | null;
}

export interface ApiCountry {
  name: string;
  code: string;
  languages: string[];
  flag: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  description?: string;
}

export interface ApiLanguage {
  code: string;
  name: string;
}

export interface ApiLogo {
  channel: string | null;
  feed: string | null;
  in_use: boolean;
  tags: string[];
  width: number;
  height: number;
  format: string;
  url: string;
}

// A single playable source for a channel.
export interface Stream {
  url: string;
  quality: string | null;
  label: string | null;
  userAgent: string | null;
  referrer: string | null;
}

// Normalized, view-ready channel: metadata joined with its playable streams.
export interface Channel {
  id: string;
  name: string;
  logo: string | null;
  country: string | null; // display name
  countryCode: string | null;
  flag: string | null;
  categories: string[]; // display names
  categoryIds: string[];
  languages: string[]; // display names
  isNsfw: boolean;
  website: string | null;
  network: string | null;
  streams: Stream[];
  bestQuality: string | null;
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
  flag?: string;
}

export interface Filters {
  countries: FilterOption[];
  categories: FilterOption[];
  languages: FilterOption[];
  qualities: FilterOption[];
  totalChannels: number;
}

export interface ChannelQuery {
  search?: string;
  countries?: string[];
  categories?: string[];
  languages?: string[];
  qualities?: string[];
  sort?: "name" | "country" | "quality";
  nsfw?: boolean;
  page?: number;
  pageSize?: number;
}

export interface Stats {
  totalChannels: number;
  totalStreams: number;
  totalCountries: number;
  totalCategories: number;
  totalLanguages: number;
  channelsWithLogo: number;
  nsfwCount: number;
  multiSourceCount: number;
  topCountries: FilterOption[];
  topCategories: FilterOption[];
  topLanguages: FilterOption[];
  qualityDistribution: { label: string; count: number }[];
}

export interface ChannelPage {
  items: Channel[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
