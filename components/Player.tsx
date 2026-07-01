"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import Hls from "hls.js";
import type { Stream } from "@/lib/types";
import { proxyUrl } from "@/lib/proxy";
import {
  AlertIcon,
  CheckIcon,
  FullscreenIcon,
  MinimizeIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  VolumeIcon,
} from "./icons";

interface PlayerProps {
  stream: Stream;
  poster?: string | null;
}

type QualityLevel = { index: number; height: number };

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

const cn = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

const formatTime = (s: number) => {
  if (!isFinite(s) || s < 0) s = 0;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
};

export default function Player({ stream, poster }: PlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Muted purely to satisfy the autoplay policy (not a user choice).
  const autoMutedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [isLive, setIsLive] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [atLiveEdge, setAtLiveEdge] = useState(true);

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [autoLevel, setAutoLevel] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [menu, setMenu] = useState<null | "main" | "quality" | "speed">(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHasError(false);
    setErrorMsg("");
    setIsLoading(true);
    setIsLive(false);
    setLevels([]);
    setCurrentLevel(-1);
    setAutoLevel(true);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.removeAttribute("src");

    let cancelled = false;

    const onWaiting = () => !cancelled && setIsLoading(true);
    const onCanPlay = () => !cancelled && setIsLoading(false);
    const onPlaying = () => {
      if (cancelled) return;
      setIsLoading(false);
      setIsPlaying(true);
    };
    const onPause = () => !cancelled && setIsPlaying(false);
    const onVolume = () => {
      if (cancelled) return;
      setIsMuted(video.muted);
      setVolume(video.volume);
    };
    const onTimeUpdate = () => {
      if (cancelled) return;
      setCurrentTime(video.currentTime);
      try {
        const b = video.buffered;
        if (b.length) setBuffered(b.end(b.length - 1));
      } catch {}
      const seekable = video.seekable;
      if (seekable.length && !isFinite(video.duration)) {
        setAtLiveEdge(seekable.end(seekable.length - 1) - video.currentTime < 10);
      }
    };
    const onLoadedMeta = () => {
      if (cancelled) return;
      setDuration(video.duration);
      if (!isFinite(video.duration)) setIsLive(true);
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("volumechange", onVolume);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMeta);

    const fail = (msg: string) => {
      if (cancelled) return;
      setHasError(true);
      setErrorMsg(msg);
      setIsLoading(false);
    };

    // Autoplay: try unmuted, fall back to muted so the browser never blocks
    // (blocked autoplay is the main source of startup delay).
    const tryPlay = () =>
      video.play().catch(() => {
        video.muted = true;
        autoMutedRef.current = true;
        setIsMuted(true);
        video.play().catch(() => setIsPlaying(false));
      });

    // Route through the server proxy: handles CORS, mixed content, and the
    // Referer / User-Agent headers many streams require.
    const src = proxyUrl(stream);
    const isNativeHls = video.canPlayType("application/vnd.apple.mpegurl");

    if (Hls.isSupported()) {
      let networkRetries = 0;
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // Fast start: prefetch the first fragment and keep the initial buffer
        // small so the first frame paints ASAP.
        startFragPrefetch: true,
        startLevel: -1,
        maxBufferLength: 15,
        maxMaxBufferLength: 60,
        backBufferLength: 30,
        liveSyncDurationCount: 3,
        maxBufferHole: 0.5,
        capLevelToPlayerSize: true,
        // Optimistic bandwidth guess avoids a slow low-quality probe on start.
        abrEwmaDefaultEstimate: 1_000_000,
        nudgeMaxRetry: 5,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        if (cancelled) return;
        setLevels(
          data.levels
            .map((l, i) => ({ index: i, height: l.height }))
            .filter((l) => l.height > 0)
            .sort((a, b) => b.height - a.height),
        );
        tryPlay();
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_e, data) => {
        if (!cancelled && data.details.live) setIsLive(true);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        if (!cancelled) setCurrentLevel(data.level);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            if (networkRetries++ < 3) {
              hls.startLoad();
            } else {
              hls.destroy();
              fail("Network error — this stream may be offline or geo-blocked.");
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            try {
              hls.recoverMediaError();
            } catch {
              fail("Media error — the stream format is not playable here.");
            }
            break;
          default:
            hls.destroy();
            fail("This stream could not be played.");
        }
      });
    } else if (isNativeHls) {
      video.src = src;
      video.addEventListener("error", () =>
        fail("This stream could not be played."),
      );
      tryPlay();
    } else {
      fail("Your browser does not support HLS playback.");
    }

    return () => {
      cancelled = true;
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("volumechange", onVolume);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMeta);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      video.removeAttribute("src");
      video.load();
    };
  }, [stream.url]);

  // Keep the media element in sync with state.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
    video.playbackRate = playbackRate;
  }, [volume, isMuted, playbackRate]);

  // Auto-unmute on the first user gesture (we start muted only to beat the
  // autoplay policy).
  useEffect(() => {
    const events = ["pointerdown", "keydown", "touchstart", "click", "scroll"];
    const unmute = () => {
      const video = videoRef.current;
      if (autoMutedRef.current && video) {
        autoMutedRef.current = false;
        video.muted = false;
        if (volume === 0) setVolume(1);
        setIsMuted(false);
      }
      events.forEach((e) => window.removeEventListener(e, unmute));
    };
    events.forEach((e) =>
      window.addEventListener(e, unmute, { once: true, passive: true }),
    );
    return () => events.forEach((e) => window.removeEventListener(e, unmute));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.url]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const seekBy = (delta: number) => {
    const v = videoRef.current;
    if (!v || isLive) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + delta));
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = parseFloat(e.target.value);
    v.currentTime = t;
    setCurrentTime(t);
  };

  const goLive = () => {
    const v = videoRef.current;
    if (!v) return;
    const seekable = v.seekable;
    if (seekable.length) {
      v.currentTime = seekable.end(seekable.length - 1);
      v.play().catch(() => {});
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    autoMutedRef.current = false;
    setVolume(val);
    setIsMuted(val === 0);
  };

  const toggleMute = () => {
    autoMutedRef.current = false;
    const next = !isMuted;
    setIsMuted(next);
    if (!next && volume === 0) setVolume(1);
  };

  const setQuality = (index: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = index;
    setAutoLevel(index === -1);
    setMenu(null);
  };

  const setSpeed = (rate: number) => {
    setPlaybackRate(rate);
    setMenu(null);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  };

  const revealControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !menu) setShowControls(false);
    }, 3000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case " ":
      case "k":
        e.preventDefault();
        togglePlay();
        break;
      case "m":
        toggleMute();
        break;
      case "f":
        toggleFullscreen();
        break;
      case "j":
      case "ArrowLeft":
        seekBy(e.key === "j" ? -10 : -5);
        break;
      case "l":
      case "ArrowRight":
        seekBy(e.key === "l" ? 10 : 5);
        break;
      case "ArrowUp":
        e.preventDefault();
        handleVolumeChange({
          target: { value: String(Math.min(1, volume + 0.05)) },
        } as React.ChangeEvent<HTMLInputElement>);
        break;
      case "ArrowDown":
        e.preventDefault();
        handleVolumeChange({
          target: { value: String(Math.max(0, volume - 0.05)) },
        } as React.ChangeEvent<HTMLInputElement>);
        break;
    }
    revealControls();
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration ? (buffered / duration) * 100 : 0;
  const activeQuality = autoLevel
    ? "Auto"
    : `${levels.find((l) => l.index === currentLevel)?.height ?? ""}p`;
  const barVisible = showControls || !isPlaying || !!menu;

  const ctlBtn =
    "flex items-center justify-center rounded-full p-2 text-white transition hover:bg-white/15 active:scale-90";

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className={cn(
        "group relative aspect-video w-full overflow-hidden rounded-xl bg-black outline-none select-none",
        !barVisible && isPlaying ? "cursor-none" : "cursor-default",
      )}
      onMouseMove={revealControls}
      onMouseLeave={() => isPlaying && !menu && setShowControls(false)}
      onKeyDown={handleKeyDown}
    >
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center">
          <AlertIcon className="h-8 w-8 text-amber-400" />
          <p className="max-w-sm text-sm text-zinc-300">{errorMsg}</p>
          <p className="text-xs text-zinc-500">
            Try another source below if available.
          </p>
        </div>
      ) : (
        <video
          ref={videoRef}
          poster={poster ?? undefined}
          className="h-full w-full bg-black"
          playsInline
          autoPlay
          preload="auto"
          onClick={togglePlay}
          onDoubleClick={toggleFullscreen}
        />
      )}

      {/* LIVE badge */}
      {!hasError && isLive && (
        <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 backdrop-blur">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white">
            Live
          </span>
        </div>
      )}

      {/* tap to unmute */}
      {!hasError && isMuted && (
        <button
          onClick={toggleMute}
          className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-full bg-white/10 py-1.5 pr-4 pl-1.5 text-[13px] font-semibold text-white ring-1 ring-white/15 backdrop-blur-md transition hover:bg-white/15"
          aria-label="Unmute"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-600 shadow-md">
            <MuteIcon className="h-4 w-4" />
          </span>
          <span className="tracking-wide">Tap to unmute</span>
        </button>
      )}

      {/* loading spinner */}
      {!hasError && isLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
        </div>
      )}

      {/* center play (paused) */}
      {!hasError && !isLoading && !isPlaying && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/75">
            <PlayIcon className="ml-1 h-8 w-8" />
          </span>
        </button>
      )}

      {/* menu click-away */}
      {menu && (
        <div className="absolute inset-0 z-10" onClick={() => setMenu(null)} />
      )}

      {/* CONTROLS */}
      {!hasError && (
        <div
          className={cn(
            "absolute right-0 bottom-0 left-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-2 pt-12 transition-opacity duration-200",
            barVisible ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          {/* progress bar (VOD only) */}
          {!isLive && (
            <div className="group/seek relative mx-2 flex h-4 items-center">
              <div className="relative h-[3px] w-full rounded-full bg-white/30 transition-all group-hover/seek:h-[5px]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white/50"
                  style={{ width: `${bufferedPct}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-red-600"
                  style={{ width: `${progressPct}%` }}
                />
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-red-600 transition-transform group-hover/seek:scale-100"
                  style={{ left: `${progressPct}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step="any"
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Seek"
              />
            </div>
          )}

          {/* button row */}
          <div className="flex items-center gap-0.5 px-1 pb-1.5">
            <button
              onClick={togglePlay}
              className={ctlBtn}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <PauseIcon className="h-6 w-6" />
              ) : (
                <PlayIcon className="h-6 w-6" />
              )}
            </button>

            <div className="group/vol flex items-center">
              <button
                onClick={toggleMute}
                className={ctlBtn}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? (
                  <MuteIcon className="h-6 w-6" />
                ) : (
                  <VolumeIcon className="h-6 w-6" />
                )}
              </button>
              <div className="flex items-center overflow-hidden">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="h-1 w-0 cursor-pointer accent-white opacity-0 transition-all duration-200 group-hover/vol:mr-2 group-hover/vol:w-16 group-hover/vol:opacity-100"
                  aria-label="Volume"
                />
              </div>
            </div>

            {/* time / live */}
            <div className="ml-1 text-[13px] font-medium text-white tabular-nums">
              {isLive ? (
                <button
                  onClick={goLive}
                  className="flex items-center gap-1.5"
                  aria-label={atLiveEdge ? "Live" : "Go to live"}
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full",
                      atLiveEdge ? "bg-red-600" : "bg-white/50",
                    )}
                  />
                  <span className={atLiveEdge ? "" : "text-white/60"}>Live</span>
                </button>
              ) : (
                <span>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              )}
            </div>

            <div className="grow" />

            {/* settings */}
            <div className="relative">
              <button
                onClick={() => setMenu(menu ? null : "main")}
                className={cn(ctlBtn, menu && "bg-white/15")}
                aria-label="Settings"
              >
                <SettingsIcon
                  className={cn(
                    "h-6 w-6 transition-transform duration-300",
                    menu && "rotate-[30deg]",
                  )}
                />
              </button>

              {menu && (
                <div className="absolute right-0 bottom-12 min-w-[210px] overflow-hidden rounded-xl bg-black/70 py-2 text-[13px] text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-md">
                  {menu === "main" && (
                    <>
                      <button
                        onClick={() => setMenu("quality")}
                        className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-white/10"
                      >
                        <span>Quality</span>
                        <span className="text-white/60">{activeQuality}</span>
                      </button>
                      {!isLive && (
                        <button
                          onClick={() => setMenu("speed")}
                          className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-white/10"
                        >
                          <span>Playback speed</span>
                          <span className="text-white/60">
                            {playbackRate === 1 ? "Normal" : `${playbackRate}x`}
                          </span>
                        </button>
                      )}
                    </>
                  )}

                  {menu === "quality" && (
                    <div className="max-h-56 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <button
                        onClick={() => setMenu("main")}
                        className="mb-1 flex w-full items-center gap-2 border-b border-white/10 px-4 py-2 font-medium hover:bg-white/10"
                      >
                        ‹ Quality
                      </button>
                      <MenuRow
                        label="Auto"
                        active={autoLevel}
                        onClick={() => setQuality(-1)}
                      />
                      {levels.map((l) => (
                        <MenuRow
                          key={l.index}
                          label={`${l.height}p`}
                          active={!autoLevel && currentLevel === l.index}
                          onClick={() => setQuality(l.index)}
                        />
                      ))}
                    </div>
                  )}

                  {menu === "speed" && (
                    <div className="max-h-56 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      <button
                        onClick={() => setMenu("main")}
                        className="mb-1 flex w-full items-center gap-2 border-b border-white/10 px-4 py-2 font-medium hover:bg-white/10"
                      >
                        ‹ Playback speed
                      </button>
                      {SPEEDS.map((s) => (
                        <MenuRow
                          key={s}
                          label={s === 1 ? "Normal" : `${s}x`}
                          active={playbackRate === s}
                          onClick={() => setSpeed(s)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              className={ctlBtn}
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <MinimizeIcon className="h-6 w-6" />
              ) : (
                <FullscreenIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const MenuRow = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-white/10"
  >
    <CheckIcon
      className={cn("h-4 w-4", active ? "opacity-100" : "opacity-0")}
    />
    <span>{label}</span>
  </button>
);
