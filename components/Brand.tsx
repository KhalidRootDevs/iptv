import Link from "next/link";
import { TvIcon } from "./icons";

export default function Brand() {
  return (
    <Link
      href="/"
      aria-label="Kbin IPTV — home"
      className="group flex items-center gap-2.5 font-semibold tracking-tight text-zinc-100"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white shadow-sm shadow-[var(--color-accent)]/30 transition-transform group-hover:scale-105">
        <TvIcon className="h-5 w-5" />
      </span>
      <span className="text-lg leading-none">
        Kbin
        <span className="font-medium text-[var(--color-muted)]"> IPTV</span>
      </span>
    </Link>
  );
}
