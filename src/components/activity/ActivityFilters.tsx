"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "trades", label: "Trades" },
  { value: "cash", label: "Cash" },
  { value: "edits", label: "Edits" },
];

export function ActivityFilters() {
  const params = useSearchParams();
  const pathname = usePathname();
  const active = params.get("filter") ?? "all";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {FILTERS.map((f) => {
        const next = new URLSearchParams(params.toString());
        if (f.value === "all") next.delete("filter");
        else next.set("filter", f.value);
        const href =
          next.toString().length > 0 ? `${pathname}?${next.toString()}` : pathname;
        return (
          <Link
            key={f.value}
            href={href}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs transition-colors ring-1 ring-inset",
              active === f.value
                ? "bg-accent/15 text-accent ring-accent/40"
                : "ring-border text-fg-muted hover:text-fg hover:bg-bg-elevated",
            )}
          >
            {f.label}
          </Link>
        );
      })}
    </div>
  );
}
