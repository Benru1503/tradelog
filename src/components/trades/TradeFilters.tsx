"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

export function TradeFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.replace(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="w-40">
        <label className="block text-xs text-fg-muted mb-1.5">Asset Type</label>
        <Select
          value={params.get("assetType") ?? ""}
          onChange={(e) => update("assetType", e.target.value)}
        >
          <option value="">All</option>
          <option value="STOCK">Stock</option>
          <option value="CRYPTO">Crypto</option>
          <option value="FOREX">Forex</option>
        </Select>
      </div>
      <div className="w-32">
        <label className="block text-xs text-fg-muted mb-1.5">Direction</label>
        <Select
          value={params.get("direction") ?? ""}
          onChange={(e) => update("direction", e.target.value)}
        >
          <option value="">All</option>
          <option value="LONG">Long</option>
          <option value="SHORT">Short</option>
        </Select>
      </div>
      <div className="w-32">
        <label className="block text-xs text-fg-muted mb-1.5">Status</label>
        <Select
          value={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
        >
          <option value="">All</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>
      <div className="w-44">
        <label className="block text-xs text-fg-muted mb-1.5">From</label>
        <Input
          type="date"
          value={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
        />
      </div>
      <div className="w-44">
        <label className="block text-xs text-fg-muted mb-1.5">To</label>
        <Input
          type="date"
          value={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
        />
      </div>
    </div>
  );
}
