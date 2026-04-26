import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { computeEquityCurve, computeStats } from "@/lib/stats";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { EquityCurve } from "@/components/dashboard/EquityCurve";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();

  const [allTrades, recentTrades] = await Promise.all([
    prisma.trade.findMany({ where: { userId: user.id } }),
    prisma.trade.findMany({
      where: { userId: user.id },
      orderBy: { entryDate: "desc" },
      take: 8,
    }),
  ]);

  const stats = computeStats(allTrades);
  const equity = computeEquityCurve(allTrades);

  const greeting = user.displayName?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {greeting}</h1>
          <p className="text-sm text-fg-muted mt-1">
            {stats.openTrades} open · {stats.closedTrades} closed
          </p>
        </div>
        <Link href="/trades/new">
          <Button>
            <Plus size={16} /> New trade
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatsCard
          label="Total P&L"
          value={formatCurrency(stats.totalPnl, { signed: true })}
          tone={stats.totalPnl > 0 ? "profit" : stats.totalPnl < 0 ? "loss" : "neutral"}
          hint={`${stats.closedTrades} closed`}
        />
        <StatsCard
          label="Win rate"
          value={stats.closedTrades === 0 ? "—" : formatPercent(stats.winRate)}
          hint={stats.closedTrades === 0 ? "No closed trades" : undefined}
        />
        <StatsCard
          label="Best trade"
          value={stats.bestTrade ? formatCurrency(stats.bestTrade, { signed: true }) : "—"}
          tone={stats.bestTrade > 0 ? "profit" : "neutral"}
        />
        <StatsCard
          label="Worst trade"
          value={stats.worstTrade ? formatCurrency(stats.worstTrade, { signed: true }) : "—"}
          tone={stats.worstTrade < 0 ? "loss" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Equity curve</CardTitle>
        </CardHeader>
        <EquityCurve data={equity} />
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent trades</CardTitle>
            <Link href="/trades" className="text-xs text-fg-muted hover:text-fg">
              View all →
            </Link>
          </div>
        </CardHeader>
        <RecentTrades trades={recentTrades} />
      </Card>
    </div>
  );
}
