import { NextResponse } from "next/server";
import type { AssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tickerSearchSchema } from "@/lib/validators";
import { getMarketDataProvider } from "@/lib/marketdata/client";

// GET /api/tickers/search?q=AAPL[&assetType=STOCK]
// Returns up to 10 ticker matches by combining the local AssetSymbol cache
// with the configured market-data provider. Provider results are folded into
// the cache so subsequent searches are fast.
export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const parsed = tickerSearchSchema.safeParse({
    q: url.searchParams.get("q") ?? "",
    assetType: url.searchParams.get("assetType") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid query" }, { status: 400 });
  }

  const { q, assetType } = parsed.data;
  const upper = q.toUpperCase();

  // Cached matches first — these are instant.
  const cached = await prisma.assetSymbol.findMany({
    where: {
      OR: [
        { symbol: { startsWith: upper, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
      ],
      ...(assetType ? { assetType: assetType as AssetType } : {}),
    },
    take: 10,
    orderBy: { symbol: "asc" },
  });

  // If we already have plenty of cached matches, skip the network call.
  if (cached.length >= 5) {
    return NextResponse.json({
      ok: true,
      results: cached.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        assetType: s.assetType,
        exchange: s.exchange,
        sector: s.sector,
      })),
    });
  }

  // Otherwise hit the provider and fold results into cache.
  const provider = getMarketDataProvider();
  const fresh = await provider.searchSymbols(q, assetType as AssetType | undefined);

  if (fresh.length > 0) {
    await Promise.all(
      fresh.map((r) =>
        prisma.assetSymbol.upsert({
          where: {
            symbol_assetType: { symbol: r.symbol, assetType: r.assetType },
          },
          create: {
            symbol: r.symbol,
            name: r.name,
            assetType: r.assetType,
            exchange: r.exchange ?? null,
            sector: r.sector ?? null,
          },
          update: {
            name: r.name,
            exchange: r.exchange ?? null,
            sector: r.sector ?? null,
            refreshedAt: new Date(),
          },
        }),
      ),
    );
  }

  // Merge cache + fresh, dedupe.
  const seen = new Set<string>();
  const merged: Array<{
    symbol: string;
    name: string;
    assetType: AssetType;
    exchange: string | null;
    sector: string | null;
  }> = [];
  for (const s of [...cached, ...fresh]) {
    const k = `${s.symbol}:${s.assetType}`;
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push({
      symbol: s.symbol,
      name: s.name,
      assetType: s.assetType,
      exchange: s.exchange ?? null,
      sector: "sector" in s ? (s.sector ?? null) : null,
    });
  }

  return NextResponse.json({ ok: true, results: merged.slice(0, 10) });
}
