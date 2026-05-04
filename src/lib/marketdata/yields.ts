// Backfills `AssetSymbol.dividendYield` for held stock symbols. Mirrors
// `enrichStockSectors` — best-effort, server-side, called from page render.
// Misses leave the column null; the analytics widget treats null as "no
// projection available" rather than zero.

import type { AssetSymbol } from "@prisma/client";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { finnhubProvider } from "./providers/finnhub";

// Refresh yields older than this. Dividend policies don't change daily, so a
// week is plenty and keeps us inside Finnhub's free-tier rate limits.
const YIELD_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function enrichStockYields(symbols: AssetSymbol[]): Promise<void> {
  const stale = symbols.filter((s) => {
    if (s.assetType !== "STOCK") return false;
    if (s.dividendYield == null) return true;
    return Date.now() - s.refreshedAt.getTime() > YIELD_TTL_MS;
  });
  if (stale.length === 0) return;

  await Promise.all(
    stale.map(async (s) => {
      const yieldPct = await finnhubProvider.getDividendYield(s.symbol);
      if (yieldPct == null) return;
      const decimal = new Decimal(yieldPct.toFixed(6));
      await prisma.assetSymbol.update({
        where: { id: s.id },
        data: { dividendYield: decimal },
      });
      // Mutate the in-memory copy so the caller sees the value immediately.
      s.dividendYield = decimal;
    }),
  );
}
