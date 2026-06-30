import type { Stream } from "./types";

// Build the proxied URL for a stream so playback goes through /api/stream,
// which handles CORS, mixed content, and required Referer/User-Agent headers.
export function proxyUrl(stream: Stream): string {
  const params = new URLSearchParams({ url: stream.url });
  if (stream.userAgent) params.set("ua", stream.userAgent);
  if (stream.referrer) params.set("ref", stream.referrer);
  return `/api/stream?${params.toString()}`;
}
