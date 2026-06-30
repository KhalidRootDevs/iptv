"use client";

import { useMemo, useState } from "react";
import type { FilterOption } from "@/lib/types";

interface Props {
  title: string;
  icon: React.ReactNode;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
}

export default function FilterSection({
  title,
  icon,
  options,
  value,
  onChange,
  searchable,
}: Props) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, q]);

  const LIMIT = 8;
  const visible = expanded || q ? filtered : filtered.slice(0, LIMIT);

  return (
    <div className="border-b border-[var(--color-border)] py-4 last:border-0">
      <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {icon}
        {title}
      </div>

      {searchable && options.length > LIMIT && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          className="mb-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[var(--color-accent)]"
        />
      )}

      <div className="flex flex-col gap-0.5">
        <FilterRow
          label="All"
          active={value === ""}
          onClick={() => onChange("")}
        />
        {visible.map((o) => (
          <FilterRow
            key={o.value}
            label={o.flag ? `${o.flag}  ${o.label}` : o.label}
            count={o.count}
            active={value === o.value}
            onClick={() => onChange(o.value)}
          />
        ))}
      </div>

      {!q && filtered.length > LIMIT && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
        >
          {expanded ? "Show less" : `Show all ${filtered.length}`}
        </button>
      )}
    </div>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-[var(--color-accent)]/15 font-medium text-white"
          : "text-zinc-300 hover:bg-[var(--color-surface-2)]"
      }`}
    >
      <span className="line-clamp-1">{label}</span>
      {count !== undefined && (
        <span className="ml-2 shrink-0 text-xs text-zinc-500">{count}</span>
      )}
    </button>
  );
}
