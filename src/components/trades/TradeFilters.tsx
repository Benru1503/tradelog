"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { FilterChip } from "@/components/ui/FilterChip";

const STATUS_OPTIONS = [
  { value: "", label: "Status" },
  { value: "OPEN", label: "Open" },
  { value: "CLOSED", label: "Closed" },
];

const ASSET_TYPE_OPTIONS = [
  { value: "STOCK", label: "Stock" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "FOREX", label: "Forex" },
];

export function TradeFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  const status = params.get("status") ?? "";
  const assetType = params.get("assetType") ?? "";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {STATUS_OPTIONS.map((opt) => (
        <FilterChip
          key={opt.value || "all"}
          active={status === opt.value}
          onClick={() => set("status", opt.value)}
        >
          {opt.label}
        </FilterChip>
      ))}

      <span aria-hidden className="h-6 w-px bg-border mx-2" />

      {ASSET_TYPE_OPTIONS.map((opt) => (
        <FilterChip
          key={opt.value}
          active={assetType === opt.value}
          onClick={() => set("assetType", assetType === opt.value ? "" : opt.value)}
          className="uppercase tracking-wider text-[11px] font-semibold"
        >
          {opt.label}
        </FilterChip>
      ))}
    </div>
  );
}
