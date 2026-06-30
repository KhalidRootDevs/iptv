"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { Stream } from "@/lib/types";
import { proxyUrl } from "@/lib/proxy";
import {
  AlertIcon,
  FullscreenIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  VolumeIcon,
} from "./icons";

interface PlayerProps {
  stream: Stream;
  poster?: string | null;
}

type Status = "loading" | "playing" | "error";

export default function Player({ stream, poster }: PlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setStatus("loading");
    setErrorMsg("");
    setIsLive(false);

    let hls: Hls | null = null;
    let cancelled = false;

    const onPlaying = () => !cancelled && setStatus("playing");
    const onPlay = () => !cancelled && setPlaying(true);
    const onPause = () => !cancelled && setPlaying(false);
    const onVolume = () => {
      if (cancelled) return;
      setMuted(video.muted);
      setVolume(video.volume);
    };
    // A live HLS stream reports a non-finite (or sliding-window) duration.
    const onDuration = () => {
      if (!cancelled && !isFinite(video.duration)) setIsLive(true);
    };

    video.addEventListener("playing", onPlaying);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("durationchange", onDuration);

    const fail = (msg: string) => {
      if (cancelled) return;
      setStatus("error");
      setErrorMsg(msg);
    };

    const isNativeHls = video.canPlayType("application/vnd.apple.mpegurl");
    // Route through the server proxy: handles CORS, mixed content, and the
    // Referer / User-Agent headers many streams require.
    const src = proxyUrl(stream);

    if (Hls.isSupported()) {
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {
          /* autoplay may be blocked; user can press play */
        });
      });
      // hls.js knows authoritatively whether the playlist is live.
      hls.on(Hls.Events.LEVEL_LOADED, (_evt, data) => {
        if (!cancelled && data.details.live) setIsLive(true);
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            fail("Network error — this stream may be offline or geo-blocked.");
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            // Try to recover once before giving up.
            try {
              hls?.recoverMediaError();
            } catch {
              fail("Media error — the stream format is not playable here.");
            }
            break;
          default:
            fail("This stream could not be played.");
        }
      });
    } else if (isNativeHls) {
      video.src = src;
      video.addEventListener("error", () =>
        fail("This stream could not be played."),
      );
      video.play().catch(() => {});
    } else {
      fail("Your browser does not support HLS playback.");
    }

    return () => {
      cancelled = true;
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("durationchange", onDuration);
      if (hls) hls.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [stream.url]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const changeVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  }, []);

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black"
    >
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        // Native controls only for on-demand content; live uses the custom bar.
        controls={!isLive}
        playsInline
        autoPlay
        onClick={isLive ? togglePlay : undefined}
        className="h-full w-full bg-black"
      />

      {/* LIVE badge — shown whenever the source is live */}
      {isLive && status !== "error" && (
        <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white">
            Live
          </span>
        </div>
      )}

      {/* Custom control bar for live streams (no seek bar) */}
      {isLive && status !== "error" && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2.5 pt-8 opacity-0 transition-opacity duration-200 group-hover:opacity-100 [&:focus-within]:opacity-100">
          <button
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="text-white/90 transition-colors hover:text-white"
          >
            {playing ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleMute}
              aria-label={muted ? "Unmute" : "Mute"}
              className="text-white/90 transition-colors hover:text-white"
            >
              {muted || volume === 0 ? (
                <MuteIcon className="h-5 w-5" />
              ) : (
                <VolumeIcon className="h-5 w-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              className="h-1 w-20 cursor-pointer accent-[var(--color-accent)]"
            />
          </div>

          {/* Live status text in place of the progress bar */}
          <div className="ml-1 flex items-center gap-1.5 text-xs font-medium text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
            Live
          </div>

          <button
            onClick={toggleFullscreen}
            aria-label="Fullscreen"
            className="ml-auto text-white/90 transition-colors hover:text-white"
          >
            <FullscreenIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
          <AlertIcon className="h-8 w-8 text-amber-400" />
          <p className="max-w-sm text-sm text-zinc-300">{errorMsg}</p>
          <p className="text-xs text-zinc-500">
            Try another source below if available.
          </p>
        </div>
      )}
    </div>
  );
}
