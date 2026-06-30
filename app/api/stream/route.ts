import { NextRequest, NextResponse } from "next/server";

// Proxy live HLS streams server-side. Solves three browser limitations:
//  1. CORS — most stream origins send no Access-Control-Allow-Origin.
//  2. Mixed content — an HTTPS page cannot load HTTP segments directly.
//  3. Forbidden headers — JS cannot set Referer / User-Agent on fetches,
//     but many streams require them.
// Playlists (.m3u8) are rewritten so every segment / key / variant URL also
// flows back through this proxy, carrying the same headers.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const PLAYLIST_CT = "application/vnd.apple.mpegurl";

function isPlaylist(url: string, contentType: string | null): boolean {
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes("mpegurl") || ct.includes("x-mpegurl")) return true;
    if (ct.includes("octet-stream")) {
      // some servers mislabel — fall through to extension check
    } else if (ct.startsWith("video/") || ct.startsWith("audio/")) {
      return false;
    }
  }
  return url.split("?")[0].toLowerCase().endsWith(".m3u8");
}

function proxied(
  uri: string,
  base: string,
  ua: string | null,
  ref: string | null,
): string {
  let absolute: string;
  try {
    absolute = new URL(uri, base).href;
  } catch {
    absolute = uri;
  }
  const params = new URLSearchParams({ url: absolute });
  if (ua) params.set("ua", ua);
  if (ref) params.set("ref", ref);
  return `/api/stream?${params.toString()}`;
}

function rewritePlaylist(
  text: string,
  base: string,
  ua: string | null,
  ref: string | null,
): string {
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#")) {
        // Rewrite URI="..." attributes (EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP, …)
        return line.replace(
          /URI="([^"]+)"/g,
          (_m, uri) => `URI="${proxied(uri, base, ua, ref)}"`,
        );
      }
      // Bare URI line: a segment or a variant playlist.
      return proxied(trimmed, base, ua, ref);
    })
    .join("\n");
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const target = sp.get("url");
  const ua = sp.get("ua");
  const ref = sp.get("ref");

  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
    if (targetUrl.protocol !== "http:" && targetUrl.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "User-Agent": ua || DEFAULT_UA,
    Accept: "*/*",
  };
  if (ref) {
    headers["Referer"] = ref;
    try {
      headers["Origin"] = new URL(ref).origin;
    } catch {
      /* ignore malformed referrer */
    }
  }
  // Forward Range for segment seeking / partial requests.
  const range = req.headers.get("range");
  if (range) headers["Range"] = range;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.href, {
      headers,
      redirect: "follow",
      cache: "no-store",
      // Streams have no useful caching; surface failures fast.
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    return NextResponse.json(
      { error: "Upstream fetch failed" },
      { status: 502 },
    );
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Upstream returned ${upstream.status}` },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type");
  // Base for resolving relative URIs = final URL after redirects.
  const base = upstream.url || targetUrl.href;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };

  if (isPlaylist(base, contentType)) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, base, ua, ref);
    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": PLAYLIST_CT,
        "Cache-Control": "no-store",
      },
    });
  }

  // Binary passthrough (segments, keys, init files) — stream the body.
  const passHeaders: Record<string, string> = {
    ...cors,
    "Content-Type": contentType || "application/octet-stream",
    "Cache-Control": "public, max-age=10",
  };
  for (const h of ["content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) passHeaders[h] = v;
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: passHeaders,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
