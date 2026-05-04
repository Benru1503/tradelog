import { Star } from "lucide-react";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { getCachedPrices } from "@/lib/marketdata/cache";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { WatchlistTable, type WatchlistRow } from "@/components/watchlist/WatchlistTable";
import { AddWatchButton } from "@/components/watchlist/AddWatchButton";

export default async function WatchlistPage() {
  const user = await requireUser();

  const items = await prisma.watchItem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const symbols =
    items.length === 0
      ? []
      : await prisma.assetSymbol.findMany({
          where: {
            OR: items.map((i) => ({
              symbol: i.asset,
              assetType: i.assetType,
            })),
          },
        });
  const symbolByKey = new Map(symbols.map((s) => [`${s.symbol}:${s.assetType}`, s]));
  const priceById = await getCachedPrices(symbols);

  const rows: WatchlistRow[] = items.map((item) => {
    const sym = symbolByKey.get(`${item.asset}:${item.assetType}`);
    const p = sym ? priceById.get(sym.id) : null;
    return {
      item,
      lastPrice: p ? new Decimal(p.price.toString()).toNumber() : null,
      changePct: p?.changePct ? new Decimal(p.changePct.toString()).toNumber() : null,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist"
        subtitle="Track symbols you don't own yet"
        action={<AddWatchButton />}
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={<Star size={28} />}
          title="No symbols on your watchlist"
          description="Track tickers you're interested in. Set an optional target price and direction, and we'll flag when the market crosses it."
          action={<AddWatchButton />}
        />
      ) : (
        <WatchlistTable rows={rows} />
      )}
    </div>
  );
}
