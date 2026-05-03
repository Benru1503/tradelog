import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, asLink = true }: { className?: string; asLink?: boolean }) {
  const inner = (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent to-accent-hover shadow-[0_0_24px_-8px_theme(colors.accent.DEFAULT)]">
        <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
          <path
            d="M3 17 L9 11 L13 14 L21 6"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="21" cy="6" r="1.5" fill="white" />
        </svg>
      </span>
      <span className="text-lg font-semibold tracking-tight">
        <span className="text-fg">Trade</span>
        <span className="text-accent">Log</span>
      </span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link href="/dashboard" className="inline-flex">
      {inner}
    </Link>
  );
}
