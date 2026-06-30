import Link from "next/link";
import type { Metadata } from "next";
import Brand from "@/components/Brand";
import StatBar from "@/components/StatBar";
import { BackIcon } from "@/components/icons";
import { getStats } from "@/lib/iptv";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Dashboard — Kbin IPTV",
  description: "Statistics and insights across the Kbin IPTV channel catalog.",
};

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-50">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-[var(--color-muted)]">{sub}</p>}
    </div>
  );
}

export default async function DashboardPage() {
  const stats = await getStats();
  const pct = (n: number) =>
    `${Math.round((n / Math.max(1, stats.totalChannels)) * 100)}%`;

  const qMax = Math.max(1, ...stats.qualityDistribution.map((q) => q.count));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-zinc-100"
          >
            <BackIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Channels</span>
          </Link>
          <div className="ml-auto">
            <Brand />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">
          Catalog overview
        </h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Live statistics across the iptv-org channel database.
        </p>

        {/* Headline stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label="Channels"
            value={stats.totalChannels.toLocaleString()}
          />
          <StatCard
            label="Streams"
            value={stats.totalStreams.toLocaleString()}
            sub={`${stats.multiSourceCount.toLocaleString()} multi-source`}
          />
          <StatCard
            label="Countries"
            value={stats.totalCountries.toLocaleString()}
          />
          <StatCard
            label="Categories"
            value={stats.totalCategories.toLocaleString()}
          />
          <StatCard
            label="Languages"
            value={stats.totalLanguages.toLocaleString()}
          />
          <StatCard
            label="With logo"
            value={stats.channelsWithLogo.toLocaleString()}
            sub={pct(stats.channelsWithLogo)}
          />
          <StatCard
            label="Avg sources"
            value={(stats.totalStreams / Math.max(1, stats.totalChannels)).toFixed(2)}
            sub="per channel"
          />
          <StatCard
            label="NSFW"
            value={stats.nsfwCount.toLocaleString()}
            sub={pct(stats.nsfwCount)}
          />
        </div>

        {/* Quality distribution */}
        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">
            Quality distribution
          </h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {stats.qualityDistribution.map((q) => (
              <div key={q.label} className="flex flex-col gap-2">
                <div className="flex items-end justify-between">
                  <span className="text-xs text-[var(--color-muted)]">
                    {q.label}
                  </span>
                  <span className="text-sm font-semibold text-zinc-100 tabular-nums">
                    {q.count.toLocaleString()}
                  </span>
                </div>
                <span className="relative h-2 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-accent)]"
                    style={{ width: `${(q.count / qMax) * 100}%` }}
                  />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Ranked lists */}
        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <StatBar title="Top countries" items={stats.topCountries} />
          <StatBar title="Top categories" items={stats.topCategories} />
          <StatBar title="Top languages" items={stats.topLanguages} />
        </div>

        <p className="mt-8 text-xs text-zinc-600">
          Data sourced from the{" "}
          <a
            href="https://github.com/iptv-org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline"
          >
            iptv-org
          </a>{" "}
          public database, refreshed periodically.
        </p>
      </main>
    </div>
  );
}
