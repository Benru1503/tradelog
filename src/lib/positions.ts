import Decimal from "decimal.js";
import type { Prisma, Position, AssetType, Direction } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────
// Position math.
//
// In our Trade model, a Trade is a complete round-trip (entry, optional exit).
// A Position aggregates multiple Trades on the same (asset, direction) while
// any of them is OPEN. Each open Trade contributes its quantity at its entry
// price; closed Trades contribute realized P&L.
//
// "How big is my NVDA position right now?" = sum of qty across OPEN legs.
// "What's my average cost?" = weighted avg of entry prices across OPEN legs.
// "How much have I realized?" = sum of pnl across CLOSED legs.
// ─────────────────────────────────────────────────────────────────────────

type Tx = Prisma.TransactionClient;

interface AveragingPreview {
  beforeQty: Decimal;
  beforeAvg: Decimal;
  beforeCost: Decimal;
  addingQty: Decimal;
  addingPrice: Decimal;
  addingCost: Decimal;
  afterQty: Decimal;
  afterAvg: Decimal;
  afterCost: Decimal;
}

// Project what the position numbers will look like if the user adds a leg —
// used by the averaging-up modal. Pure math, no DB writes.
export function previewAveraging(
  position: Pick<Position, "totalQty" | "avgCost">,
  addQty: Decimal | string | number,
  addPrice: Decimal | string | number,
): AveragingPreview {
  const beforeQty = new Decimal(position.totalQty.toString());
  const beforeAvg = new Decimal(position.avgCost.toString());
  const beforeCost = beforeQty.times(beforeAvg);
  const addingQty = new Decimal(addQty.toString());
  const addingPrice = new Decimal(addPrice.toString());
  const addingCost = addingQty.times(addingPrice);
  const afterQty = beforeQty.plus(addingQty);
  const afterCost = beforeCost.plus(addingCost);
  const afterAvg = afterQty.gt(0) ? afterCost.dividedBy(afterQty) : new Decimal(0);
  return {
    beforeQty,
    beforeAvg,
    beforeCost,
    addingQty,
    addingPrice,
    addingCost,
    afterQty,
    afterAvg,
    afterCost,
  };
}

// Recompute a position's snapshot fields from its current trade legs.
// Deletes the position entirely if no trades remain (the user removed every leg).
// Always called inside a transaction so the snapshot stays consistent with trades.
export async function recomputePosition(tx: Tx, positionId: string): Promise<void> {
  const position = await tx.position.findUnique({
    where: { id: positionId },
    include: { trades: { where: { deletedAt: null } } },
  });
  if (!position) return;

  if (position.trades.length === 0) {
    await tx.position.delete({ where: { id: positionId } });
    return;
  }

  const openLegs = position.trades.filter((t) => t.status === "OPEN");
  const closedLegs = position.trades.filter((t) => t.status === "CLOSED");

  const totalQty = openLegs.reduce((acc, t) => acc.plus(t.quantity.toString()), new Decimal(0));
  const totalCost = openLegs.reduce(
    (acc, t) => acc.plus(new Decimal(t.entryPrice.toString()).times(t.quantity.toString())),
    new Decimal(0),
  );
  const avgCost = totalQty.gt(0) ? totalCost.dividedBy(totalQty) : new Decimal(0);
  const realizedPnl = closedLegs.reduce(
    (acc, t) => acc.plus(t.pnl ? t.pnl.toString() : 0),
    new Decimal(0),
  );

  const status = openLegs.length > 0 ? "OPEN" : "CLOSED";
  const earliestEntry = position.trades.reduce<Date>(
    (acc, t) => (t.entryDate < acc ? t.entryDate : acc),
    position.trades[0]!.entryDate,
  );
  const latestExit =
    closedLegs.length > 0
      ? closedLegs.reduce<Date | null>(
          (acc, t) => (!acc || (t.exitDate && t.exitDate > acc) ? (t.exitDate ?? acc) : acc),
          null,
        )
      : null;

  await tx.position.update({
    where: { id: positionId },
    data: {
      avgCost: avgCost.toString(),
      totalQty: totalQty.toString(),
      realizedPnl: realizedPnl.toString(),
      status,
      openedAt: earliestEntry,
      closedAt: status === "CLOSED" ? latestExit : null,
    },
  });
}

// Find the open position a new trade should attach to, or create one.
// Match key: (userId, asset upper-cased, direction) with status=OPEN.
//
// Why direction matters: a long and a short on the same ticker are conceptually
// different positions — closing one does not net against the other.
export async function getOrCreateOpenPosition(
  tx: Tx,
  args: {
    userId: string;
    asset: string;
    assetType: AssetType;
    direction: Direction;
    openedAt: Date;
  },
): Promise<Position> {
  const existing = await tx.position.findFirst({
    where: {
      userId: args.userId,
      asset: args.asset,
      direction: args.direction,
      status: "OPEN",
    },
  });
  if (existing) return existing;

  return tx.position.create({
    data: {
      userId: args.userId,
      asset: args.asset,
      assetType: args.assetType,
      direction: args.direction,
      status: "OPEN",
      openedAt: args.openedAt,
      avgCost: "0",
      totalQty: "0",
      realizedPnl: "0",
    },
  });
}

// Convenience for the read side: take a list of positions and a price-by-symbol
// map, return derived display values (market value, unrealized P&L, etc).
export interface PositionRow {
  position: Position;
  marketPrice: number | null;
  priceFetchedAt: Date | null;
  marketValue: number | null;
  costBasis: number;
  unrealizedPnl: number | null;
  unrealizedPct: number | null;
}

export function decoratePosition(
  position: Position,
  price: { price: number; fetchedAt: Date } | null,
): PositionRow {
  const totalQty = new Decimal(position.totalQty.toString());
  const avgCost = new Decimal(position.avgCost.toString());
  const costBasis = totalQty.times(avgCost).toNumber();
  if (!price || totalQty.lte(0)) {
    return {
      position,
      marketPrice: price?.price ?? null,
      priceFetchedAt: price?.fetchedAt ?? null,
      marketValue: null,
      costBasis,
      unrealizedPnl: null,
      unrealizedPct: null,
    };
  }
  const mktPrice = new Decimal(price.price);
  const marketValue = totalQty.times(mktPrice).toNumber();
  // For SHORT positions, gain when price drops below avg cost.
  const sign = position.direction === "SHORT" ? -1 : 1;
  const unrealized = mktPrice.minus(avgCost).times(totalQty).times(sign);
  const unrealizedPct = avgCost.gt(0)
    ? unrealized.dividedBy(avgCost.times(totalQty)).times(100).toNumber()
    : null;
  return {
    position,
    marketPrice: price.price,
    priceFetchedAt: price.fetchedAt,
    marketValue,
    costBasis,
    unrealizedPnl: unrealized.toNumber(),
    unrealizedPct,
  };
}
