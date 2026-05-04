"use client";

import { useEffect, useRef, useState } from "react";
import type { AssetType } from "@prisma/client";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";

interface SearchHit {
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange: string | null;
  sector: string | null;
}

interface Props {
  id?: string;
  name: string;
  required?: boolean;
  autoFocus?: boolean;
  defaultValue?: string;
  // Filters provider results when set. Matching the form's assetType select
  // gives more relevant suggestions.
  assetType?: AssetType;
  onSelect?: (hit: SearchHit) => void;
  // Bypass network when the host page wants to render a static input (tests).
  disableSearch?: boolean;
  className?: string;
}

const TYPE_BADGE: Record<AssetType, string> = {
  STOCK: "bg-fg-muted/15 text-fg-muted",
  CRYPTO: "bg-amber-500/15 text-amber-300",
  FOREX: "bg-indigo-400/15 text-indigo-300",
};

export function TickerAutocomplete({
  id,
  name,
  required,
  autoFocus,
  defaultValue = "",
  assetType,
  onSelect,
  disableSearch,
  className,
}: Props) {
  const [value, setValue] = useState(defaultValue);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search.
  useEffect(() => {
    if (disableSearch) return;
    const q = value.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (assetType) params.set("assetType", assetType);
        const res = await fetch(`/api/tickers/search?${params.toString()}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; results: SearchHit[] };
        if (data.ok) {
          setHits(data.results);
          setHighlight(0);
        }
      } catch {
        // Aborted or network — ignore.
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [value, assetType, disableSearch]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(hit: SearchHit) {
    setValue(hit.symbol);
    setOpen(false);
    onSelect?.(hit);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || hits.length === 0) {
      if (e.key === "Escape") setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => (h + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => (h - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      // If a hit is highlighted, prefer it; otherwise let the form submit
      // with whatever the user typed (free-text fallback).
      if (hits[highlight]) {
        e.preventDefault();
        pick(hits[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && (loading || hits.length > 0 || value.trim().length > 0);

  return (
    <div className="relative" ref={containerRef}>
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => {
          setValue(e.target.value.toUpperCase());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="AAPL"
        autoComplete="off"
        spellCheck={false}
        required={required}
        autoFocus={autoFocus}
        aria-autocomplete="list"
        aria-expanded={showDropdown}
        className={cn("uppercase", className)}
      />
      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-bg-card shadow-xl overflow-hidden">
          {hits.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-fg-subtle">
              {loading ? "Searching…" : `Press Enter to use "${value.trim().toUpperCase()}"`}
            </div>
          ) : (
            <ul role="listbox" className="max-h-64 overflow-y-auto scrollbar-thin">
              {hits.map((h, i) => (
                <li
                  key={`${h.symbol}:${h.assetType}`}
                  role="option"
                  aria-selected={i === highlight}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(h);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 cursor-pointer text-sm",
                    i === highlight ? "bg-bg-elevated" : "",
                  )}
                >
                  <span className="font-mono font-semibold w-16 truncate">{h.symbol}</span>
                  <span className="flex-1 min-w-0 truncate text-fg-muted text-xs">
                    {h.name}
                    {h.exchange && h.assetType === "STOCK" && (
                      <span className="ml-1 text-fg-subtle">· {h.exchange}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider",
                      TYPE_BADGE[h.assetType],
                    )}
                  >
                    {h.assetType}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border px-3 py-1.5 text-[10px] text-fg-subtle flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span>esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}
