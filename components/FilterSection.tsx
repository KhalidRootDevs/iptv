"use client";

import { useMemo, useState } from "react";
import type { FilterOption } from "@/lib/types";

interface Props {
  title: string;
  icon: React.ReactNode;
  options: FilterOption[];
  values: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  searchable?: boolean;
}

export default function FilterSection({
  title,
  icon,
  options,
  values,
  onToggle,
  onClear,
  searchable,
}: Props) {
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(false);
  const selected = new Set(values);

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
        {values.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 normal-case">
            <span className="rounded-full bg-[var(--color-accent)]/20 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
              {values.length}
            </span>
            <button
              onClick={onClear}
              className="text-[10px] font-medium text-[var(--color-muted)] hover:text-zinc-200"
            >
              Clear
            </button>
          </span>
        )}
      </div>

      {searchable && options.length > LIMIT && (
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          className="mb-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-[var(--color-accent)]"
        />
      )}

      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto pr-1">
        {visible.map((o) => (
          <FilterRow
            key={o.value}
            label={o.flag ? `${o.flag}  ${o.label}` : o.label}
            count={o.count}
            active={selected.has(o.value)}
            onClick={() => onToggle(o.value)}
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
      className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        active
          ? "bg-[var(--color-accent)]/15 font-medium text-white"
          : "text-zinc-300 hover:bg-[var(--color-surface-2)]"
      }`}
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
          active
            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
            : "border-[var(--color-border)]"
        }`}
      >
        {active && (
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="4">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="line-clamp-1 flex-1">{label}</span>
      {count !== undefined && (
        <span className="shrink-0 text-xs text-zinc-500">{count}</span>
      )}
    </button>
  );
}
