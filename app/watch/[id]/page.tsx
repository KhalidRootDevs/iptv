import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Brand from "@/components/Brand";
import WatchView from "@/components/WatchView";
import { BackIcon } from "@/components/icons";
import { getChannel } from "@/lib/iptv";

export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const channel = await getChannel(decodeURIComponent(id));
  if (!channel) return { title: "Channel not found — Kbin IPTV" };
  return {
    title: `${channel.name} — Kbin IPTV`,
    description: `Watch ${channel.name}${
      channel.country ? ` from ${channel.country}` : ""
    } live on Kbin IPTV.`,
  };
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  const channel = await getChannel(decodeURIComponent(id));
  if (!channel || channel.streams.length === 0) notFound();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-[var(--color-muted)] transition-colors hover:text-zinc-100"
          >
            <BackIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <div className="ml-auto">
            <Brand />
          </div>
        </div>
      </header>

      <WatchView channel={channel} />
    </div>
  );
}
