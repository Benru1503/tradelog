import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { computeStats } from "@/lib/stats";
import { computeDashboardSeries } from "@/lib/portfolio";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentTrades } from "@/components/dashboard/RecentTrades";
import { TopMoversStrip, type MoverTrade } from "@/components/dashboard/TopMoversStrip";
import { formatCurrency, formatPercent } from "@/lib/utils";

const EquityCurve = dynamic(
  () => import("@/components/dashboard/EquityCurve").then((m) => m.EquityCurve),
  {
    loading: () => <div className="h-72 animate-pulse bg-bg-elevated/40 rounded" />,
  },
);

export default async function DashboardPage() {
  const user = await requireUser();

  const [allTrades, recentTrades, cashFlows] = await Promise.all([
    prisma.trade.findMany({ where: { userId: user.id, deletedAt: null } }),
    prisma.trade.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { entryDate: "desc" },
      take: 5,
    }),
    prisma.cashFlow.findMany({ where: { userId: user.id } }),
  ]);

  const stats = computeStats(allTrades);
  const series = computeDashboardSeries(allTrades, cashFlows);

  const movers: MoverTrade[] = allTrades
    .filter((t) => t.status === "CLOSED" && t.pnl != null && t.exitDate != null)
    .map((t) => ({
      id: t.id,
      asset: t.asset,
      assetType: t.assetType,
      pnl: Number(t.pnl),
      pnlPercent: t.pnlPercent == null ? null : Number(t.pnlPercent),
      exitDate: t.exitDate!.toISOString(),
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        subtitle="Your trading overview"
        action={
          <Link href="/trades/new">
            <Button>
              <Plus size={16} /> New trade
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Total P&L"
          value={formatCurrency(stats.totalPnl, { signed: true })}
          tone={stats.totalPnl > 0 ? "profit" : stats.totalPnl < 0 ? "loss" : "neutral"}
          hint="Closed trades"
        />
        <StatsCard
          label="Win Rate"
          value={stats.closedTrades === 0 ? "—" : formatPercent(stats.winRate)}
          hint={
            stats.closedTrades === 0
              ? "No closed trades"
              : `${stats.winningTrades} of ${stats.closedTrades} trades`
          }
        />
        <StatsCard
          label="Total Trades"
          value={String(stats.totalTrades)}
          hint={`${stats.openTrades} open`}
        />
        <StatsCard
          label="Avg R:R"
          value={stats.avgRR ? `${stats.avgRR.toFixed(1)}×` : "—"}
          hint="Closed trades"
        />
      </div>

      <TopMoversStrip trades={movers} />

      <Card>
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
        </CardHeader>
        <EquityCurve data={series} />
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Trades</CardTitle>
            <Link href="/trades" className="text-xs text-fg-muted hover:text-fg transition-colors">
              View all →
            </Link>
          </div>
        </CardHeader>
        <RecentTrades trades={recentTrades} />
      </Card>
    </div>
  );
}
