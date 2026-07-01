"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Channel } from "@/lib/types";
import { pushRecent } from "@/lib/store";
import ChannelCard from "./ChannelCard";
import FavoriteButton from "./FavoriteButton";
import Player from "./Player";
import { ExternalIcon, TvIcon } from "./icons";

export default function WatchView({
  channel,
  related,
}: {
  channel: Channel;
  related: Channel[];
}) {
  const [sourceIdx, setSourceIdx] = useState(0);
  const stream = channel.streams[sourceIdx] ?? channel.streams[0];

  // Record this channel in watch history once on mount.
  useEffect(() => {
    pushRecent(channel);
  }, [channel]);

  return (
    <div className="animate-fade-in mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      {/* Header row above player: channel name left, favorite right */}
      <div className="mb-4 flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1.5">
          {channel.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={channel.logo}
              alt={channel.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <TvIcon className="h-6 w-6 text-zinc-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-zinc-50">
            {channel.flag && <span>{channel.flag}</span>}
            <span className="truncate">{channel.name}</span>
          </h1>
          <p className="mt-0.5 truncate text-sm text-[var(--color-muted)]">
            {[channel.country, channel.network, ...channel.categories]
              .filter(Boolean)
              .join(" · ") || "Live stream"}
          </p>
        </div>

        <FavoriteButton
          channel={channel}
          withLabel
          className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-2 hover:border-white/20"
        />
      </div>

      <Player key={stream.url} stream={stream} poster={channel.logo} />

      {/* Sources */}
      {channel.streams.length > 1 && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Sources
          </p>
          <div className="flex flex-wrap gap-2">
            {channel.streams.map((s, i) => (
              <button
                key={s.url + i}
                onClick={() => setSourceIdx(i)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === sourceIdx
                    ? "border-[var(--color-accent)] bg-[var(--color-accent)]/12 text-white"
                    : "border-[var(--color-border)] text-zinc-300 hover:border-white/20"
                }`}
              >
                Source {i + 1}
                {s.quality ? ` · ${s.quality}` : ""}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {(channel.categories.length > 0 ||
        channel.languages.length > 0 ||
        channel.website) && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {channel.categories.map((c) => (
            <span
              key={`cat-${c}`}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-zinc-300"
            >
              {c}
            </span>
          ))}
          {channel.languages.map((l) => (
            <span
              key={`lang-${l}`}
              className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)]"
            >
              {l}
            </span>
          ))}
          {channel.website && (
            <a
              href={channel.website}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] hover:underline"
            >
              Website <ExternalIcon className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {/* Related channels */}
      {related.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-zinc-200">
            Related channels
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {related.map((c) => (
              <ChannelCard key={c.id} channel={c} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-8 text-xs text-zinc-600">
        Stream provided by a public third-party source via the iptv-org
        database. Availability is not guaranteed.{" "}
        <Link href="/" className="text-[var(--color-accent)] hover:underline">
          Browse more channels
        </Link>
      </p>
    </div>
  );
}
