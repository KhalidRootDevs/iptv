"use client";

import type { Channel } from "@/lib/types";
import { toggleFavorite, useFavorites } from "@/lib/store";
import { StarIcon } from "./icons";

export default function FavoriteButton({
  channel,
  className = "",
  withLabel = false,
}: {
  channel: Channel;
  className?: string;
  withLabel?: boolean;
}) {
  const favs = useFavorites();
  const active = favs.some((c) => c.id === channel.id);

  const onClick = (e: React.MouseEvent) => {
    // Prevent navigation when nested inside a card link.
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(channel);
  };

  return (
    <button
      onClick={onClick}
      aria-label={active ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={active}
      title={active ? "Remove from favorites" : "Add to favorites"}
      className={`inline-flex items-center gap-1.5 transition-colors ${
        active ? "text-amber-400" : "text-zinc-300 hover:text-amber-400"
      } ${className}`}
    >
      <StarIcon
        className="h-4 w-4"
        fill={active ? "currentColor" : "none"}
      />
      {withLabel && (
        <span className="text-sm font-medium">
          {active ? "Favorited" : "Favorite"}
        </span>
      )}
    </button>
  );
}
