import type { FilterOption } from "@/lib/types";

// Horizontal ranked bar list (top countries / categories / languages).
export default function StatBar({
  title,
  items,
}: {
  title: string;
  items: FilterOption[];
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((i) => (
          <li key={i.value} className="flex items-center gap-3 text-sm">
            <span className="flex w-32 shrink-0 items-center gap-1.5 truncate text-zinc-300">
              {i.flag && <span>{i.flag}</span>}
              <span className="truncate">{i.label}</span>
            </span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-accent)]"
                style={{ width: `${(i.count / max) * 100}%` }}
              />
            </span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-[var(--color-muted)]">
              {i.count.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
