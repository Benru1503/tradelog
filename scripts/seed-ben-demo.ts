// One-shot demo seeder for Ben's account on the prod DB.
// Idempotent: aborts cleanly if any trade tagged with the [demo] marker
// already exists. To remove the demo data later:
//
//   await prisma.trade.deleteMany({
//     where: { userId, notes: { contains: "[demo]" } },
//   });
//   await prisma.cashFlow.deleteMany({
//     where: { userId, note: { contains: "[demo]" } },
//   });
//   await prisma.simSnapshot.deleteMany({ where: { userId } });
//   // tags + watchitems are upserted, delete by name if you want them gone

import {
  PrismaClient,
  type AssetType,
  type Direction,
  type CashFlowType,
} from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();
const USER_ID = "40bfe2c9-661a-4f2a-921b-9e8f4b8a5144";
const MARKER = "[demo]";

const NOW = new Date();
function daysAgo(d: number): Date {
  const t = new Date(NOW);
  t.setDate(t.getDate() - d);
  return t;
}

interface SymbolDef {
  symbol: string;
  name: string;
  assetType: AssetType;
  exchange: string | null;
  sector: string | null;
  industry: string | null;
  dividendYield: string | null;
  price: number;
  changePct: number;
}

const SYMBOLS: SymbolDef[] = [
  { symbol: "NVDA", name: "NVIDIA Corp", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors", dividendYield: "0.0003", price: 542.10, changePct: 1.85 },
  { symbol: "AAPL", name: "Apple Inc", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Consumer Electronics", dividendYield: "0.0048", price: 218.40, changePct: -0.42 },
  { symbol: "MSFT", name: "Microsoft Corp", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Software", dividendYield: "0.0072", price: 428.90, changePct: 0.55 },
  { symbol: "AMD", name: "Advanced Micro Devices Inc", assetType: "STOCK", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors", dividendYield: null, price: 122.30, changePct: -2.10 },
  { symbol: "GOOGL", name: "Alphabet Inc", assetType: "STOCK", exchange: "NASDAQ", sector: "Communication Services", industry: "Internet Content & Information", dividendYield: "0.0040", price: 178.65, changePct: 0.95 },
  { symbol: "NFLX", name: "Netflix Inc", assetType: "STOCK", exchange: "NASDAQ", sector: "Communication Services", industry: "Entertainment", dividendYield: null, price: 612.40, changePct: -1.30 },
  { symbol: "TSLA", name: "Tesla Inc", assetType: "STOCK", exchange: "NASDAQ", sector: "Consumer Cyclical", industry: "Auto Manufacturers", dividendYield: null, price: 264.80, changePct: 3.40 },
  { symbol: "JPM", name: "JPMorgan Chase & Co", assetType: "STOCK", exchange: "NYSE", sector: "Financial Services", industry: "Banks", dividendYield: "0.0245", price: 215.50, changePct: 0.20 },
  { symbol: "LLY", name: "Eli Lilly & Co", assetType: "STOCK", exchange: "NYSE", sector: "Healthcare", industry: "Drug Manufacturers", dividendYield: "0.0061", price: 824.10, changePct: 1.05 },
  { symbol: "XOM", name: "Exxon Mobil Corp", assetType: "STOCK", exchange: "NYSE", sector: "Energy", industry: "Oil & Gas Integrated", dividendYield: "0.0331", price: 113.70, changePct: -0.85 },
  { symbol: "BTC", name: "Bitcoin", assetType: "CRYPTO", exchange: "bitcoin", sector: null, industry: null, dividendYield: null, price: 92450.00, changePct: 2.10 },
  { symbol: "ETH", name: "Ethereum", assetType: "CRYPTO", exchange: "ethereum", sector: null, industry: null, dividendYield: null, price: 3185.20, changePct: 0.65 },
  { symbol: "SOL", name: "Solana", assetType: "CRYPTO", exchange: "solana", sector: null, industry: null, dividendYield: null, price: 158.90, changePct: -3.40 },
  { symbol: "EUR/USD", name: "Euro / US Dollar", assetType: "FOREX", exchange: "OANDA:EUR_USD", sector: null, industry: null, dividendYield: null, price: 1.0875, changePct: 0.12 },
];

interface TradeDef {
  asset: string;
  assetType: AssetType;
  direction: Direction;
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  fees: number;
  daysAgoOpen: number;
  daysAgoClose: number | null;
  notes?: string;
  isShared?: boolean;
  tagNames?: string[];
}

const TRADES: TradeDef[] = [
  // Closed winners
  { asset: "NVDA", assetType: "STOCK", direction: "LONG", entryPrice: 475.00, exitPrice: 528.50, quantity: 25, fees: 2.50, daysAgoOpen: 75, daysAgoClose: 52, notes: "[demo] Breakout above 470 with strong volume. Held through earnings.", tagNames: ["breakout", "earnings"] },
  { asset: "AAPL", assetType: "STOCK", direction: "LONG", entryPrice: 184.20, exitPrice: 210.40, quantity: 50, fees: 1.80, daysAgoOpen: 88, daysAgoClose: 62, notes: "[demo] Pullback to 200 EMA. Trim at +14%.", isShared: true, tagNames: ["swing"] },
  { asset: "BTC", assetType: "CRYPTO", direction: "LONG", entryPrice: 61200.00, exitPrice: 78900.00, quantity: 0.15, fees: 12.00, daysAgoOpen: 65, daysAgoClose: 18, notes: "[demo] Halving thesis playing out. Sized small.", tagNames: ["macro", "crypto"] },
  { asset: "MSFT", assetType: "STOCK", direction: "LONG", entryPrice: 398.00, exitPrice: 415.20, quantity: 20, fees: 1.50, daysAgoOpen: 70, daysAgoClose: 50, notes: "[demo] Steady accumulation, took the small win.", tagNames: ["swing"] },
  { asset: "EUR/USD", assetType: "FOREX", direction: "LONG", entryPrice: 1.0712, exitPrice: 1.0888, quantity: 10000, fees: 0.50, daysAgoOpen: 40, daysAgoClose: 22, notes: "[demo] ECB pause priced in.", tagNames: ["macro"] },
  // Closed shorter winner
  { asset: "NFLX", assetType: "STOCK", direction: "SHORT", entryPrice: 645.00, exitPrice: 588.00, quantity: 10, fees: 2.00, daysAgoOpen: 35, daysAgoClose: 20, notes: "[demo] Sub-growth scare, covered at support.", tagNames: ["earnings"] },
  // Closed losers
  { asset: "AMD", assetType: "STOCK", direction: "LONG", entryPrice: 152.30, exitPrice: 132.10, quantity: 30, fees: 1.80, daysAgoOpen: 60, daysAgoClose: 45, notes: "[demo] Failed breakout. Stop hit, moved on.", tagNames: ["stopped-out"] },
  { asset: "SOL", assetType: "CRYPTO", direction: "LONG", entryPrice: 195.00, exitPrice: 162.00, quantity: 8, fees: 3.50, daysAgoOpen: 50, daysAgoClose: 32, notes: "[demo] Chased the breakout, paid for it.", tagNames: ["crypto", "stopped-out"] },
  { asset: "JPM", assetType: "STOCK", direction: "LONG", entryPrice: 218.00, exitPrice: 212.50, quantity: 15, fees: 1.20, daysAgoOpen: 45, daysAgoClose: 38, notes: "[demo] Rate-cut delay, scratched the trade.", tagNames: ["swing"] },
  // Open positions — single leg
  { asset: "TSLA", assetType: "STOCK", direction: "LONG", entryPrice: 245.00, exitPrice: null, quantity: 20, fees: 2.00, daysAgoOpen: 25, daysAgoClose: null, notes: "[demo] Robotaxi catalyst trade.", tagNames: ["catalyst"] },
  { asset: "GOOGL", assetType: "STOCK", direction: "LONG", entryPrice: 168.40, exitPrice: null, quantity: 30, fees: 1.50, daysAgoOpen: 18, daysAgoClose: null, notes: "[demo] Core long-term holding.", tagNames: ["long-term"] },
  { asset: "ETH", assetType: "CRYPTO", direction: "LONG", entryPrice: 2950.00, exitPrice: null, quantity: 1.5, fees: 4.50, daysAgoOpen: 30, daysAgoClose: null, notes: "[demo] ETF flows starting to pick up.", tagNames: ["crypto"] },
  { asset: "LLY", assetType: "STOCK", direction: "LONG", entryPrice: 780.00, exitPrice: null, quantity: 5, fees: 1.20, daysAgoOpen: 12, daysAgoClose: null, notes: "[demo] GLP-1 thesis, sized small.", tagNames: ["long-term"] },
  // Open multi-leg position (averaging up on NVDA)
  { asset: "NVDA", assetType: "STOCK", direction: "LONG", entryPrice: 495.00, exitPrice: null, quantity: 15, fees: 1.80, daysAgoOpen: 22, daysAgoClose: null, notes: "[demo] Re-entered post-correction.", tagNames: ["breakout"] },
  { asset: "NVDA", assetType: "STOCK", direction: "LONG", entryPrice: 525.00, exitPrice: null, quantity: 10, fees: 1.20, daysAgoOpen: 8, daysAgoClose: null, notes: "[demo] Averaging up after reclaiming 520.", tagNames: ["breakout"] },
];

interface TagDef {
  name: string;
  color: string;
}
const TAGS: TagDef[] = [
  { name: "breakout", color: "#5fd0f5" },
  { name: "earnings", color: "#a855f7" },
  { name: "swing", color: "#22c55e" },
  { name: "macro", color: "#f59e0b" },
  { name: "crypto", color: "#fb923c" },
  { name: "stopped-out", color: "#ef4444" },
  { name: "long-term", color: "#10b981" },
  { name: "catalyst", color: "#ec4899" },
];

interface CashFlowDef {
  type: CashFlowType;
  amount: string;
  occurredDaysAgo: number;
  assetSymbol?: string | null;
  note: string;
}
const CASHFLOWS: CashFlowDef[] = [
  { type: "DEPOSIT", amount: "10000", occurredDaysAgo: 95, note: "[demo] Initial funding" },
  { type: "DEPOSIT", amount: "5000", occurredDaysAgo: 60, note: "[demo] Top-up" },
  { type: "DEPOSIT", amount: "2500", occurredDaysAgo: 28, note: "[demo] Monthly contribution" },
  { type: "WITHDRAWAL", amount: "1500", occurredDaysAgo: 14, note: "[demo] Cash out for IRL stuff" },
  { type: "DIVIDEND", amount: "12.50", occurredDaysAgo: 55, assetSymbol: "AAPL", note: "[demo] Quarterly dividend" },
  { type: "DIVIDEND", amount: "18.00", occurredDaysAgo: 30, assetSymbol: "MSFT", note: "[demo] Quarterly dividend" },
  { type: "DIVIDEND", amount: "9.20", occurredDaysAgo: 10, assetSymbol: "JPM", note: "[demo] Quarterly dividend" },
  { type: "FEE_ADJUST", amount: "3.50", occurredDaysAgo: 7, note: "[demo] Wire fee adjustment" },
];

interface WatchDef {
  asset: string;
  assetType: AssetType;
  targetPrice: string | null;
  targetDirection: "BUY" | "SELL" | null;
  note: string;
}
const WATCH: WatchDef[] = [
  { asset: "ARM", assetType: "STOCK", targetPrice: "120.00", targetDirection: "BUY", note: "[demo] Wait for pullback to support" },
  { asset: "META", assetType: "STOCK", targetPrice: "550.00", targetDirection: "BUY", note: "[demo] Reload zone" },
  { asset: "AMD", assetType: "STOCK", targetPrice: "150.00", targetDirection: "SELL", note: "[demo] Re-short on rejection" },
  { asset: "AVAX", assetType: "CRYPTO", targetPrice: "30.00", targetDirection: "BUY", note: "[demo] Layer-1 dip buy" },
];

async function main() {
  console.log(`Seeding demo data for ${USER_ID}…`);

  const existingDemo = await prisma.trade.count({
    where: { userId: USER_ID, notes: { contains: MARKER } },
  });
  if (existingDemo > 0) {
    console.log(
      `Found ${existingDemo} existing demo trades. Skipping to avoid duplicates.`,
    );
    return;
  }

  // 1. AssetSymbol + AssetPrice (upsert — safe alongside cached symbols)
  for (const s of SYMBOLS) {
    const sym = await prisma.assetSymbol.upsert({
      where: { symbol_assetType: { symbol: s.symbol, assetType: s.assetType } },
      create: {
        symbol: s.symbol,
        name: s.name,
        assetType: s.assetType,
        exchange: s.exchange,
        sector: s.sector,
        industry: s.industry,
        dividendYield: s.dividendYield,
      },
      update: {
        name: s.name,
        exchange: s.exchange,
        sector: s.sector,
        industry: s.industry,
        dividendYield: s.dividendYield,
        refreshedAt: new Date(),
      },
    });
    await prisma.assetPrice.upsert({
      where: { symbolId: sym.id },
      create: {
        symbolId: sym.id,
        price: s.price.toString(),
        changePct: s.changePct.toString(),
      },
      update: {
        price: s.price.toString(),
        changePct: s.changePct.toString(),
        fetchedAt: new Date(),
      },
    });
  }
  console.log(`✓ Upserted ${SYMBOLS.length} symbols + prices`);

  // 2. Tags
  const tagsByName = new Map<string, string>();
  for (const t of TAGS) {
    const tag = await prisma.tag.upsert({
      where: { userId_name: { userId: USER_ID, name: t.name } },
      create: { userId: USER_ID, name: t.name, color: t.color },
      update: { color: t.color },
    });
    tagsByName.set(t.name, tag.id);
  }
  console.log(`✓ Upserted ${TAGS.length} tags`);

  // 3. Trades + Positions (transactional per trade so positions stay consistent)
  let tradeCount = 0;
  for (const t of TRADES) {
    const entryDate = daysAgo(t.daysAgoOpen);
    const exitDate = t.daysAgoClose != null ? daysAgo(t.daysAgoClose) : null;
    const status = exitDate ? "CLOSED" : "OPEN";

    let pnl: string | null = null;
    let pnlPercent: string | null = null;
    if (t.exitPrice != null) {
      const sign = t.direction === "LONG" ? 1 : -1;
      const gross = new Decimal(t.exitPrice)
        .minus(t.entryPrice)
        .times(t.quantity)
        .times(sign);
      pnl = gross.minus(t.fees).toFixed(2);
      pnlPercent = new Decimal(t.exitPrice - t.entryPrice)
        .dividedBy(t.entryPrice)
        .times(100)
        .times(sign)
        .toFixed(4);
    }

    await prisma.$transaction(async (tx) => {
      // Find or create the position. We attach OPEN trades and CLOSED trades
      // alike — for a closed trade we just pass openedAt = entryDate so the
      // position's openedAt aggregates correctly.
      let position = await tx.position.findFirst({
        where: {
          userId: USER_ID,
          asset: t.asset,
          direction: t.direction,
          status: "OPEN",
        },
      });
      if (!position && status === "CLOSED") {
        // For a standalone closed trade, open a position then close it.
        position = await tx.position.create({
          data: {
            userId: USER_ID,
            asset: t.asset,
            assetType: t.assetType,
            direction: t.direction,
            status: "OPEN",
            openedAt: entryDate,
            avgCost: "0",
            totalQty: "0",
            realizedPnl: "0",
          },
        });
      } else if (!position) {
        position = await tx.position.create({
          data: {
            userId: USER_ID,
            asset: t.asset,
            assetType: t.assetType,
            direction: t.direction,
            status: "OPEN",
            openedAt: entryDate,
            avgCost: "0",
            totalQty: "0",
            realizedPnl: "0",
          },
        });
      }

      const trade = await tx.trade.create({
        data: {
          userId: USER_ID,
          positionId: position.id,
          asset: t.asset,
          assetType: t.assetType,
          direction: t.direction,
          entryPrice: t.entryPrice.toString(),
          exitPrice: t.exitPrice != null ? t.exitPrice.toString() : null,
          quantity: t.quantity.toString(),
          entryDate,
          exitDate,
          status,
          pnl,
          pnlPercent,
          fees: t.fees.toString(),
          notes: t.notes ?? null,
          isShared: t.isShared ?? false,
        },
      });

      if (t.tagNames && t.tagNames.length > 0) {
        for (const tagName of t.tagNames) {
          const tagId = tagsByName.get(tagName);
          if (tagId) {
            await tx.tradeTag.create({
              data: { tradeId: trade.id, tagId },
            });
          }
        }
      }

      // Recompute position snapshot
      const allLegs = await tx.trade.findMany({
        where: { positionId: position.id, deletedAt: null },
      });
      const openLegs = allLegs.filter((x) => x.status === "OPEN");
      const closedLegs = allLegs.filter((x) => x.status === "CLOSED");
      const totalQty = openLegs.reduce(
        (a, x) => a.plus(x.quantity.toString()),
        new Decimal(0),
      );
      const totalCost = openLegs.reduce(
        (a, x) =>
          a.plus(
            new Decimal(x.entryPrice.toString()).times(x.quantity.toString()),
          ),
        new Decimal(0),
      );
      const avgCost = totalQty.gt(0)
        ? totalCost.dividedBy(totalQty)
        : new Decimal(0);
      const realizedPnl = closedLegs.reduce(
        (a, x) => a.plus(x.pnl ? x.pnl.toString() : 0),
        new Decimal(0),
      );
      const newStatus = openLegs.length > 0 ? "OPEN" : "CLOSED";
      const earliest = allLegs.reduce<Date>(
        (a, x) => (x.entryDate < a ? x.entryDate : a),
        allLegs[0]!.entryDate,
      );
      const latestExit =
        closedLegs.length > 0
          ? closedLegs.reduce<Date | null>(
              (a, x) =>
                !a || (x.exitDate && x.exitDate > a) ? (x.exitDate ?? a) : a,
              null,
            )
          : null;
      await tx.position.update({
        where: { id: position.id },
        data: {
          avgCost: avgCost.toString(),
          totalQty: totalQty.toString(),
          realizedPnl: realizedPnl.toString(),
          status: newStatus,
          openedAt: earliest,
          closedAt: newStatus === "CLOSED" ? latestExit : null,
        },
      });
    });
    tradeCount++;
  }
  console.log(`✓ Created ${tradeCount} trades + positions`);

  // 4. CashFlows
  for (const cf of CASHFLOWS) {
    await prisma.cashFlow.create({
      data: {
        userId: USER_ID,
        type: cf.type,
        amount: cf.amount,
        currency: "USD",
        occurredAt: daysAgo(cf.occurredDaysAgo),
        assetSymbol: cf.assetSymbol ?? null,
        note: cf.note,
      },
    });
  }
  console.log(`✓ Created ${CASHFLOWS.length} cash flows`);

  // 5. Watch items (skip duplicates via upsert)
  for (const w of WATCH) {
    await prisma.watchItem.upsert({
      where: { userId_asset: { userId: USER_ID, asset: w.asset } },
      create: {
        userId: USER_ID,
        asset: w.asset,
        assetType: w.assetType,
        targetPrice: w.targetPrice,
        targetDirection: w.targetDirection ?? undefined,
        note: w.note,
      },
      update: {},
    });
  }
  console.log(`✓ Upserted ${WATCH.length} watchlist items`);

  // 6. Sim snapshots — one What-if and one DCA, just to populate the page.
  await prisma.simSnapshot.create({
    data: {
      userId: USER_ID,
      kind: "WHAT_IF",
      params: {
        asset: "BTC",
        assetType: "CRYPTO",
        assetName: "Bitcoin",
        buyAmount: "10000",
        buyDate: daysAgo(120).toISOString().slice(0, 10),
        sellDate: null,
      },
      result: {
        buyTime: Math.floor(daysAgo(120).getTime() / 1000),
        buyPrice: 58400.0,
        sellTime: Math.floor(NOW.getTime() / 1000),
        sellPrice: 92450.0,
        shares: 0.1712,
        saleValue: 15830.7,
        pnl: 5830.7,
        pnlPct: 58.31,
      },
    },
  });
  await prisma.simSnapshot.create({
    data: {
      userId: USER_ID,
      kind: "DCA",
      params: {
        asset: "ETH",
        assetType: "CRYPTO",
        assetName: "Ethereum",
        amount: "200",
        cadence: "MONTHLY",
        from: daysAgo(180).toISOString().slice(0, 10),
        to: null,
      },
      result: {
        contributions: [],
        totalInvested: 1200,
        finalValue: 1382.4,
        totalShares: 0.434,
        pnl: 182.4,
        pnlPct: 15.2,
        cagrPct: 32.8,
        fromTime: Math.floor(daysAgo(180).getTime() / 1000),
        toTime: Math.floor(NOW.getTime() / 1000),
      },
    },
  });
  console.log("✓ Created 2 sim snapshots");

  // 7. Trade revisions (edit history for the activity feed)
  const sampleTrade = await prisma.trade.findFirst({
    where: { userId: USER_ID, asset: "AAPL", exitPrice: { not: null } },
  });
  if (sampleTrade) {
    await prisma.tradeRevision.createMany({
      data: [
        {
          tradeId: sampleTrade.id,
          userId: USER_ID,
          fieldName: "exitPrice",
          oldValue: "208.10",
          newValue: "210.40",
          changedAt: daysAgo(60),
        },
        {
          tradeId: sampleTrade.id,
          userId: USER_ID,
          fieldName: "notes",
          oldValue: null,
          newValue: "[demo] Pullback to 200 EMA. Trim at +14%.",
          changedAt: daysAgo(60),
        },
      ],
    });
    console.log("✓ Added 2 trade revisions");
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
