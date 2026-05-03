import Link from "next/link";
import dynamic from "next/dynamic";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { decoratePosition } from "@/lib/positions";
import { computeCashOnHand } from "@/lib/portfolio";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { PositionsTable } from "@/components/positions/PositionsTable";
import { AddMenu } from "@/components/positions/AddMenu";
import { cn, formatCurrency } from "@/lib/utils";

const PositionDonut = dynamic(
  () => import("@/components/positions/PositionDonut").then((m) => m.PositionDonut),
  { loading: () => <div className="h-56 animate-pulse bg-bg-elevated/40 rounded" /> },
);

interface PageProps {
  searchParams: { tab?: "open" | "closed" };
}

export default async function PositionsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const tab = searchParams.tab === "closed" ? "closed" : "open";

  const [allPositions, cashFlows, allClosedTrades] = await Promise.all([
    prisma.position.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { openedAt: "desc" }],
    }),
    prisma.cashFlow.findMany({ where: { userId: user.id } }),
    prisma.trade.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        status: "CLOSED",
        exitDate: { not: null },
      },
    }),
  ]);

  // Scope price lookup to symbols the user actually holds. Dedupe (asset,
  // assetType) pairs across open + closed positions before querying.
  const heldKeys = new Set<string>();
  const heldPairs: { symbol: string; assetType: typeof allPositions[number]["assetType"] }[] = [];
  for (const p of allPositions) {
    const key = `${p.asset}:${p.assetType}`;
    if (heldKeys.has(key)) continue;
    heldKeys.add(key);
    heldPairs.push({ symbol: p.asset, assetType: p.assetType });
  }
  const prices =
    heldPairs.length === 0
      ? []
      : await prisma.assetSymbol.findMany({
          where: { OR: heldPairs },
          include: { prices: true },
        });

  // Build a price map keyed by "SYMBOL:TYPE" so we don't accidentally match
  // BTC stock with BTC crypto across asset types.
  const priceMap = new Map<string, { price: number; fetchedAt: Date }>();
  for (const sym of prices) {
    const p = sym.prices[0];
    if (!p) continue;
    priceMap.set(`${sym.symbol}:${sym.assetType}`, {
      price: new Decimal(p.price.toString()).toNumber(),
      fetchedAt: p.fetchedAt,
    });
  }

  const decorated = allPositions.map((p) => {
    const price = priceMap.get(`${p.asset}:${p.assetType}`) ?? null;
    return decoratePosition(p, price);
  });

  const open = decorated.filter((r) => r.position.status === "OPEN");
  const closed = decorated.filter((r) => r.position.status === "CLOSED");
  const visible = tab === "closed" ? closed : open;

  // KPI calculations.
  const openValue = open.reduce(
    (acc, r) => acc + (r.marketValue ?? r.costBasis),
    0,
  );
  const usedMarketPriceFor = open.filter((r) => r.marketValue != null).length;
  const openValueIsCostBasis = usedMarketPriceFor === 0 && open.length > 0;
  const unrealized = open.reduce((acc, r) => acc + (r.unrealizedPnl ?? 0), 0);
  const unrealizedHasData = open.some((r) => r.unrealizedPnl != null);

  const yearStart = new Date();
  yearStart.setMonth(0, 1);
  yearStart.setHours(0, 0, 0, 0);
  const realizedYtd = allClosedTrades
    .filter((t) => t.exitDate && t.exitDate >= yearStart)
    .reduce((acc, t) => acc + (t.pnl ? new Decimal(t.pnl.toString()).toNumber() : 0), 0);

  const openCostBasis = open.reduce((acc, r) => acc + r.costBasis, 0);
  const cashOnHand = computeCashOnHand(cashFlows, openCostBasis);

  // Allocation slices for the donut. Use marketValue when available, else cost basis.
  const totalAllocBase = open.reduce(
    (acc, r) => acc + (r.marketValue ?? r.costBasis),
    0,
  );
  const slices = open
    .map((r) => {
      const value = r.marketValue ?? r.costBasis;
      return {
        asset: r.position.asset,
        value,
        pct: totalAllocBase > 0 ? (value / totalAllocBase) * 100 : 0,
      };
    })
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Positions"
        subtitle="Current holdings and realized history"
        action={<AddMenu />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          label="Open value"
          value={open.length === 0 ? "—" : formatCurrency(openValue)}
          hint={
            open.length === 0
              ? "No open positions"
              : openValueIsCostBasis
                ? "Cost basis (no live prices)"
                : `${open.length} position${open.length === 1 ? "" : "s"}`
          }
        />
        <StatsCard
          label="Unrealized P&L"
          value={
            !unrealizedHasData
              ? "—"
              : formatCurrency(unrealized, { signed: true })
          }
          tone={
            !unrealizedHasData
              ? "neutral"
              : unrealized > 0
                ? "profit"
                : unrealized < 0
                  ? "loss"
                  : "neutral"
          }
          hint={
            !unrealizedHasData
              ? "Pending live prices"
              : "Open positions"
          }
        />
        <StatsCard
          label="Realized YTD"
          value={
            allClosedTrades.length === 0
              ? "—"
              : formatCurrency(realizedYtd, { signed: true })
          }
          tone={
            realizedYtd > 0 ? "profit" : realizedYtd < 0 ? "loss" : "neutral"
          }
          hint={`Closed ${new Date().getFullYear()}`}
        />
        <StatsCard
          label="Cash on hand"
          value={cashFlows.length === 0 ? "—" : formatCurrency(cashOnHand)}
          hint={
            cashFlows.length === 0
              ? "Add a deposit to start"
              : `${cashFlows.length} cash flow${cashFlows.length === 1 ? "" : "s"}`
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Allocation</CardTitle>
          </CardHeader>
          <PositionDonut slices={slices} />
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top holdings</CardTitle>
          </CardHeader>
          {slices.length === 0 ? (
            <div className="py-8 text-center text-sm text-fg-subtle">
              No open positions yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {slices.slice(0, 6).map((s) => (
                <li key={s.asset} className="flex items-center gap-3 text-sm">
                  <span className="font-semibold w-16 truncate">{s.asset}</span>
                  <div className="flex-1 h-2 rounded-full bg-bg-elevated overflow-hidden">
                    <div
                      className="h-full bg-accent/60 rounded-full"
                      style={{ width: `${Math.min(100, s.pct)}%` }}
                    />
                  </div>
                  <span className="text-xs text-fg-muted font-mono tabular-nums w-14 text-right">
                    {s.pct.toFixed(1)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <div className="flex items-center gap-1 mb-4">
          <TabLink href="/positions" label="Open" count={open.length} active={tab === "open"} />
          <TabLink
            href="/positions?tab=closed"
            label="Closed"
            count={closed.length}
            active={tab === "closed"}
          />
        </div>
        <PositionsTable rows={visible} />
      </div>
    </div>
  );
}

function TabLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-lg text-sm transition-colors",
        active
          ? "bg-bg-elevated text-fg ring-1 ring-inset ring-border"
          : "text-fg-muted hover:text-fg hover:bg-bg-elevated/60",
      )}
    >
      {label}
      <span className="ml-2 text-xs text-fg-subtle">{count}</span>
    </Link>
  );
}
