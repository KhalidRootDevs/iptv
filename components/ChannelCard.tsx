"use client";

import Link from "next/link";
import { useState } from "react";
import type { Channel } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";
import { PlayIcon, TvIcon } from "./icons";

export default function ChannelCard({ channel }: { channel: Channel }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = channel.logo && !imgFailed;

  return (
    <Link
      href={`/watch/${encodeURIComponent(channel.id)}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors duration-200 hover:border-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
    >
      {/* Logo / thumbnail */}
      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-[var(--color-surface-2)] p-6">
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.logo!}
            alt={channel.name}
            loading="lazy"
            onError={() => setImgFailed(true)}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <TvIcon className="h-8 w-8 text-zinc-600" />
        )}

        {channel.bestQuality && (
          <span className="absolute right-2 top-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-200 backdrop-blur">
            {channel.bestQuality}
          </span>
        )}

        <FavoriteButton
          channel={channel}
          className="absolute left-2 top-2 rounded-md bg-black/45 p-1 backdrop-blur"
        />

        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-black shadow-lg">
            <PlayIcon className="ml-0.5 h-5 w-5" />
          </span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-1 flex-col gap-0.5 px-3 py-2.5">
        <h3
          className="line-clamp-1 text-sm font-medium text-zinc-100"
          title={channel.name}
        >
          {channel.name}
        </h3>
        <div className="flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
          {channel.flag && <span>{channel.flag}</span>}
          <span className="line-clamp-1">
            {channel.country ?? "Unknown"}
            {channel.categories[0] ? ` · ${channel.categories[0]}` : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
