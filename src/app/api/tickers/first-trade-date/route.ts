import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { firstTradeDateSchema } from "@/lib/validators";
import { yahooProvider } from "@/lib/marketdata/providers/yahoo";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/tickers/first-trade-date?symbol=AAPL&assetType=STOCK
// Earliest daily bar available for this symbol, so the Playground date
// pickers can be capped to when the asset actually started trading instead
// of letting a user pick, say, 1800. Crypto goes through Yahoo's
// "<TICKER>-USD" too (years of history for majors); a long-tail coin Yahoo
// doesn't track just returns null and the caller leaves the picker
// unrestricted, same as any other lookup failure.
const LOOKUPS_PER_MINUTE = 30;

export async function GET(req: Request) {
  const user = await requireUser();

  const limit = rateLimit(`tickers:first-trade-date:${user.id}`, LOOKUPS_PER_MINUTE, 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many lookups — give it a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(req.url);
  const parsed = firstTradeDateSchema.safeParse({
    symbol: url.searchParams.get("symbol") ?? "",
    assetType: url.searchParams.get("assetType") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid query" }, { status: 400 });
  }
  const { symbol, assetType } = parsed.data;

  const firstTradeDate = await yahooProvider.getEarliestDate(symbol, assetType);
  return NextResponse.json({ ok: true, firstTradeDate });
}
