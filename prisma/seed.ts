import { PrismaClient, type AssetType, type Direction } from "@prisma/client";
import Decimal from "decimal.js";

const prisma = new PrismaClient();

const SEED_USER_ID = "00000000-0000-0000-0000-000000000001";
const SEED_USER_EMAIL = "seed@tradelog.local";

const ASSETS: Array<{ asset: string; assetType: AssetType }> = [
  { asset: "AAPL", assetType: "STOCK" },
  { asset: "TSLA", assetType: "STOCK" },
  { asset: "NVDA", assetType: "STOCK" },
  { asset: "BTC-USD", assetType: "CRYPTO" },
  { asset: "ETH-USD", assetType: "CRYPTO" },
  { asset: "SOL-USD", assetType: "CRYPTO" },
  { asset: "EUR-USD", assetType: "FOREX" },
  { asset: "GBP-JPY", assetType: "FOREX" },
];

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function calcPnL(entry: number, exit: number, qty: number, fees: number, direction: Direction) {
  const sign = direction === "LONG" ? 1 : -1;
  return new Decimal(exit - entry).times(qty).times(sign).minus(fees).toFixed(2);
}

async function main() {
  console.log("Seeding…");

  await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    create: {
      id: SEED_USER_ID,
      email: SEED_USER_EMAIL,
      displayName: "Seed User",
    },
    update: {},
  });

  await prisma.trade.deleteMany({ where: { userId: SEED_USER_ID } });

  const now = Date.now();
  const trades = Array.from({ length: 30 }, (_, i) => {
    const pick = ASSETS[i % ASSETS.length];
    const direction: Direction = Math.random() > 0.3 ? "LONG" : "SHORT";
    const entryPrice = randomBetween(50, 500);
    const isClosed = i < 25;
    const exitPrice = isClosed
      ? entryPrice * (1 + (Math.random() - 0.45) * 0.2)
      : null;
    const quantity = Math.round(randomBetween(1, 100));
    const fees = randomBetween(0, 5);
    const entryDate = new Date(now - (30 - i) * 24 * 60 * 60 * 1000);
    const exitDate = isClosed ? new Date(entryDate.getTime() + randomBetween(1, 5) * 86400000) : null;

    return {
      userId: SEED_USER_ID,
      asset: pick.asset,
      assetType: pick.assetType,
      direction,
      entryPrice: entryPrice.toFixed(4),
      exitPrice: exitPrice ? exitPrice.toFixed(4) : null,
      quantity: quantity.toString(),
      entryDate,
      exitDate,
      status: isClosed ? ("CLOSED" as const) : ("OPEN" as const),
      pnl: isClosed ? calcPnL(entryPrice, exitPrice!, quantity, fees, direction) : null,
      pnlPercent: isClosed
        ? new Decimal(exitPrice! - entryPrice).dividedBy(entryPrice).times(100).toFixed(4)
        : null,
      fees: fees.toFixed(2),
      notes: i % 4 === 0 ? "Breakout play. Held through earnings." : null,
      isShared: i % 5 === 0,
    };
  });

  await prisma.trade.createMany({ data: trades });

  console.log(`Seeded ${trades.length} trades for ${SEED_USER_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
