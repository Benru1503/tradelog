// Backfills `AssetSymbol.sector` for held stock symbols that don't have one.
// Crypto/forex don't get sector data — they're bucketed by asset class on the
// heatmap UI side.
//
// Designed to be called from server pages on render. Misses just leave the
// sector null; the heatmap renders those holdings under "Stocks (other)".

import type { AssetSymbol } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { finnhubProvider } from "./providers/finnhub";

export async function enrichStockSectors(symbols: AssetSymbol[]): Promise<void> {
  const missing = symbols.filter((s) => s.assetType === "STOCK" && !s.sector);
  if (missing.length === 0) return;

  await Promise.all(
    missing.map(async (s) => {
      const industry = await finnhubProvider.getIndustry(s.symbol);
      if (!industry) return;
      await prisma.assetSymbol.update({
        where: { id: s.id },
        data: { sector: industry },
      });
      // Mutate the in-memory copy too so the caller sees the value immediately.
      s.sector = industry;
    }),
  );
}
