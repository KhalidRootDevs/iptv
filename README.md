# Kbin IPTV

A modern web app to browse and watch thousands of free, publicly available
live TV channels from around the world. Built with **Next.js 16**, **React 19**,
**Tailwind CSS v4** and **hls.js**.

Data comes from the community-maintained
[iptv-org](https://github.com/iptv-org) project via its public JSON API
(`https://iptv-org.github.io/api`). No streams are hosted here — the app only
links to publicly available sources.

## Features

- 🌍 **Multi-select filters** — country, category, language, and quality (OR within a facet, AND across) with live counts
- 🏷️ Horizontal **category chip bar** at the top of the list
- 🔎 Instant **search** across channel and country names
- ↕️ **Sort** by name, country, or stream quality
- ▶️ Dedicated **watch page** with an HLS player (hls.js + native Safari)
- 🔴 **Live** indicator replacing the seek bar for live streams; custom controls
- ⌨️ **Keyboard shortcuts** — space/k play, m mute, f fullscreen, arrows volume/seek
- ⭐ **Favorites** + 🕘 **recently watched** (localStorage, synced across tabs)
- 🔗 **Copy stream link** / open in external player
- 🧭 **Related channels** by country & category on the watch page
- 📊 **Dashboard** with catalog stats, quality distribution, and top lists
- 🔁 **Multi-source** channels — switch between alternate streams if one is down
- 🖼️ Channel **logos**, quality badges, NSFW filtering
- 📱 Fully **responsive** with independent scroll panes and a mobile filter drawer
- 🎨 Modern minimal dark UI, graceful error states

## Architecture

```
app/
  page.tsx              Server component — SSR initial filters + first page
  watch/[id]/page.tsx   Dedicated watch page (SSR channel by id + metadata)
  layout.tsx            Root layout + metadata
  globals.css           Tailwind v4 theme + animations
  api/
    channels/route.ts   Paginated, filtered channel query
    filters/route.ts    Country/category/language facets with counts
    stream/route.ts     HLS proxy (CORS, mixed content, Referer/User-Agent)
components/
  Browser.tsx           Client orchestrator (state, fetch, infinite "load more")
  ChannelCard.tsx       Channel tile — links to /watch/[id]
  WatchView.tsx         Player page body: player, source switcher, channel info
  Player.tsx            hls.js wrapper with recovery + error handling
  FilterSection.tsx     Searchable/collapsible facet list
  Brand.tsx             Logo / wordmark
  icons.tsx             Inline SVG icon set
lib/
  iptv.ts               Data layer: fetch + join + cache + query
  proxy.ts              Build proxied playback URL for a stream
  types.ts              Shared types (raw API + normalized view models)
```

### Stream proxy

Live streams play through `/api/stream`, which fetches the playlist and
segments server-side. This is required because browsers block direct playback
in three common cases: cross-origin requests without CORS headers, HTTP
segments on an HTTPS page (mixed content), and streams that need a `Referer`
or `User-Agent` (headers JS is not allowed to set). The proxy rewrites every
`.m3u8` so segments, keys, and variant playlists also route back through it,
carrying the stream's required headers.

### Data layer

`lib/iptv.ts` fetches the six iptv-org endpoints (`channels`, `streams`,
`countries`, `categories`, `languages`, `logos`), joins them into normalized
`Channel` objects (each with its playable `streams`, best logo, country flag,
and derived languages), and caches the result in-process. Upstream data is
re-fetched at most every 6 hours.

> The raw JSON files are large (channels ~13 MB, logos ~9 MB), which exceeds
> Next.js's 2 MB on-disk fetch-cache limit — hence the in-process cache. This
> is expected; you'll see a harmless "items over 2MB can not be cached" notice
> during build.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
```

## Production

```bash
npm run build
npm start
```

## Legal

This project does not host or distribute any video content. All stream links
are sourced from the public iptv-org database. If a link infringes your rights,
report it upstream at the [iptv-org/iptv](https://github.com/iptv-org/iptv)
repository.

