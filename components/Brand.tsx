import Link from "next/link";
import { TvIcon } from "./icons";

export default function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2 font-semibold tracking-tight text-zinc-100"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white">
        <TvIcon className="h-5 w-5" />
      </span>
      <span className="text-base">
        Kbin<span className="text-[var(--color-muted)]"> IPTV</span>
      </span>
    </Link>
  );
}
