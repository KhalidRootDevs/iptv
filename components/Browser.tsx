"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Channel, ChannelPage, Filters } from "@/lib/types";
import Brand from "./Brand";
import ChannelCard from "./ChannelCard";
import FilterSection from "./FilterSection";
import {
  ChartIcon,
  FilterIcon,
  GlobeIcon,
  LangIcon,
  LayersIcon,
  SearchIcon,
  SortIcon,
  TvIcon,
} from "./icons";

interface Props {
  filters: Filters;
  initial: ChannelPage;
}

type Sort = "name" | "country" | "quality";

const PAGE_SIZE = 60;

function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function Browser({ filters, initial }: Props) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [countries, setCountries] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>("name");

  const [items, setItems] = useState<Channel[]>(initial.items);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(initial.totalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mobileFilters, setMobileFilters] = useState(false);

  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      const id = ++reqId.current;
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        page: String(pageNum),
        pageSize: String(PAGE_SIZE),
        sort,
      });
      if (debounced) params.set("search", debounced);
      if (countries.length) params.set("country", countries.join(","));
      if (categories.length) params.set("category", categories.join(","));
      if (languages.length) params.set("language", languages.join(","));

      try {
        const res = await fetch(`/api/channels?${params}`);
        if (!res.ok) throw new Error("Request failed");
        const data: ChannelPage = await res.json();
        if (id !== reqId.current) return;
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch {
        if (id === reqId.current)
          setError("Could not load channels. Please try again.");
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [debounced, countries, categories, languages, sort],
  );

  const isFirst = useRef(true);
  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    fetchPage(1, false);
  }, [fetchPage]);

  const hasMore = page < totalPages;

  const resetAll = () => {
    setSearch("");
    setCountries([]);
    setCategories([]);
    setLanguages([]);
    setSort("name");
  };

  const activeFilterCount =
    countries.length + categories.length + languages.length;

  const sidebar = (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-200">Filters</h2>
        {activeFilterCount > 0 && (
          <button
            onClick={resetAll}
            className="text-xs font-medium text-[var(--color-accent)] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>
      <FilterSection
        title="Country"
        icon={<GlobeIcon className="h-4 w-4" />}
        options={filters.countries}
        values={countries}
        onToggle={(v) => setCountries((c) => toggle(c, v))}
        onClear={() => setCountries([])}
        searchable
      />
      <FilterSection
        title="Category"
        icon={<LayersIcon className="h-4 w-4" />}
        options={filters.categories}
        values={categories}
        onToggle={(v) => setCategories((c) => toggle(c, v))}
        onClear={() => setCategories([])}
        searchable
      />
      <FilterSection
        title="Language"
        icon={<LangIcon className="h-4 w-4" />}
        options={filters.languages}
        values={languages}
        onToggle={(v) => setLanguages((c) => toggle(c, v))}
        onClear={() => setLanguages([])}
        searchable
      />
    </div>
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
        <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 sm:px-6">
          <Brand />

          <div className="relative ml-auto w-full max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels…"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-2.5 pl-10 pr-4 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-white/25"
            />
          </div>

          <Link
            href="/dashboard"
            className="hidden items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-zinc-200 transition-colors hover:border-white/25 sm:flex"
          >
            <ChartIcon className="h-4 w-4" />
            Dashboard
          </Link>

          <div className="hidden items-center gap-2 sm:flex">
            <SortIcon className="h-4 w-4 text-zinc-500" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm text-zinc-200 outline-none focus:border-white/25"
            >
              <option value="name">Name</option>
              <option value="country">Country</option>
              <option value="quality">Quality</option>
            </select>
          </div>

          <button
            onClick={() => setMobileFilters(true)}
            className="relative rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-zinc-300 lg:hidden"
            aria-label="Open filters"
          >
            <FilterIcon className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto flex w-full min-h-0 max-w-[1600px] flex-1 gap-8 px-4 sm:px-6">
        <aside className="hidden w-60 shrink-0 overflow-y-auto py-6 lg:block">
          {sidebar}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          {/* Category quick-filter bar — horizontal scroll */}
          <div className="shrink-0 border-b border-[var(--color-border)] py-3">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <Chip
                label="All"
                active={categories.length === 0}
                onClick={() => setCategories([])}
              />
              {filters.categories.map((c) => (
                <Chip
                  key={c.value}
                  label={c.label}
                  count={c.count}
                  active={categories.includes(c.value)}
                  onClick={() => setCategories((p) => toggle(p, c.value))}
                />
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-4">
            <div className="mb-4 flex items-baseline justify-between">
              <p className="text-sm text-[var(--color-muted)]">
                <span className="font-semibold text-zinc-100">
                  {total.toLocaleString()}
                </span>{" "}
                channels
              </p>
              {loading && (
                <span className="text-xs text-zinc-500">Loading…</span>
              )}
            </div>

            {error && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                {error}
              </div>
            )}

            {items.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <TvIcon className="h-10 w-10 text-zinc-700" />
                <p className="text-[var(--color-muted)]">
                  No channels match your filters.
                </p>
                <button
                  onClick={resetAll}
                  className="text-sm font-medium text-[var(--color-accent)] hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {items.map((ch) => (
                  <ChannelCard key={ch.id} channel={ch} />
                ))}
              </div>
            )}

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => fetchPage(page + 1, true)}
                  disabled={loading}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:border-white/25 disabled:opacity-50"
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {mobileFilters && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileFilters(false)}
          />
          <div className="animate-fade-in absolute right-0 top-0 h-full w-80 max-w-[85%] overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            {sidebar}
            <Link
              href="/dashboard"
              className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium text-zinc-200"
            >
              <ChartIcon className="h-4 w-4" /> Dashboard
            </Link>
            <button
              onClick={() => setMobileFilters(false)}
              className="mt-2 w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-medium text-white"
            >
              Show {total.toLocaleString()} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
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
      className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/15 text-white"
          : "border-[var(--color-border)] text-zinc-300 hover:border-white/25"
      }`}
    >
      {label}
      {count !== undefined && (
        <span className={active ? "text-white/70" : "text-zinc-500"}>
          {count}
        </span>
      )}
    </button>
  );
}
