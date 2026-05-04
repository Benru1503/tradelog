import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActivityTimeline, type ActivityEvent } from "@/components/activity/ActivityTimeline";
import { ActivityFilters } from "@/components/activity/ActivityFilters";

interface PageProps {
  searchParams: { filter?: string };
}

const FIELD_LABELS: Record<string, string> = {
  entryPrice: "entry price",
  exitPrice: "exit price",
  quantity: "qty",
  direction: "direction",
  entryDate: "entry date",
  exitDate: "exit date",
};

export default async function ActivityPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const filter = searchParams.filter ?? "all";

  const wantTrades = filter === "all" || filter === "trades";
  const wantCash = filter === "all" || filter === "cash";
  const wantEdits = filter === "all" || filter === "edits";

  const [trades, cashFlows, edits] = await Promise.all([
    wantTrades
      ? prisma.trade.findMany({
          where: { userId: user.id, deletedAt: null },
          orderBy: { entryDate: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    wantCash
      ? prisma.cashFlow.findMany({
          where: { userId: user.id },
          orderBy: { occurredAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
    wantEdits
      ? prisma.tradeRevision.findMany({
          where: { userId: user.id },
          orderBy: { changedAt: "desc" },
          take: 200,
          include: {
            trade: { select: { asset: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const events: ActivityEvent[] = [];

  for (const t of trades) {
    events.push({
      kind: "trade-entry",
      id: `${t.id}-entry`,
      tradeId: t.id,
      occurredAt: t.entryDate,
      asset: t.asset,
      direction: t.direction,
      quantity: t.quantity.toString(),
      entryPrice: t.entryPrice.toString(),
      positionId: t.positionId,
    });
    if (t.status === "CLOSED" && t.exitDate && t.exitPrice) {
      events.push({
        kind: "trade-exit",
        id: `${t.id}-exit`,
        tradeId: t.id,
        occurredAt: t.exitDate,
        asset: t.asset,
        direction: t.direction,
        quantity: t.quantity.toString(),
        exitPrice: t.exitPrice.toString(),
        pnl: t.pnl?.toString() ?? null,
        positionId: t.positionId,
      });
    }
  }

  for (const f of cashFlows) {
    events.push({
      kind: "cash",
      id: f.id,
      occurredAt: f.occurredAt,
      type: f.type,
      amount: f.amount.toString(),
      currency: f.currency,
      assetSymbol: f.assetSymbol,
      note: f.note,
    });
  }

  for (const r of edits) {
    events.push({
      kind: "edit",
      id: r.id,
      tradeId: r.tradeId,
      occurredAt: r.changedAt,
      fieldName: FIELD_LABELS[r.fieldName] ?? r.fieldName,
      oldValue: r.oldValue,
      newValue: r.newValue,
      asset: r.trade.asset,
    });
  }

  events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());

  return (
    <div className="space-y-6">
      <PageHeader title="Activity" subtitle="Every trade, cash flow, and edit in one timeline" />
      <ActivityFilters />
      <ActivityTimeline events={events.slice(0, 300)} />
    </div>
  );
}
