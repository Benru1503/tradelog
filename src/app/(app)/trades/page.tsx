import Link from "next/link";
import { Plus, LineChart } from "lucide-react";
import { Prisma, type AssetType, type Direction, type TradeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { TradesTable } from "@/components/trades/TradesTable";
import { TradeFilters } from "@/components/trades/TradeFilters";

const SORT_FIELDS = ["entryDate", "exitDate", "asset", "pnl", "pnlPercent"] as const;
type SortField = (typeof SORT_FIELDS)[number];

function parseSearchParams(sp: { [k: string]: string | string[] | undefined }) {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]);
  const sortRaw = get("sort");
  const dirRaw = get("dir");
  const sort: SortField = (SORT_FIELDS as readonly string[]).includes(sortRaw ?? "")
    ? (sortRaw as SortField)
    : "entryDate";
  const dir: "asc" | "desc" = dirRaw === "asc" ? "asc" : "desc";

  return {
    assetType: get("assetType") as AssetType | undefined,
    direction: get("direction") as Direction | undefined,
    status: get("status") as TradeStatus | undefined,
    from: get("from"),
    to: get("to"),
    sort,
    dir,
  };
}

export default async function TradesPage({
  searchParams,
}: {
  searchParams: { [k: string]: string | string[] | undefined };
}) {
  const user = await requireUser();
  const f = parseSearchParams(searchParams);

  const where: Prisma.TradeWhereInput = { userId: user.id, deletedAt: null };
  if (f.assetType) where.assetType = f.assetType;
  if (f.direction) where.direction = f.direction;
  if (f.status) where.status = f.status;
  if (f.from || f.to) {
    where.entryDate = {};
    if (f.from) where.entryDate.gte = new Date(f.from);
    if (f.to) {
      const to = new Date(f.to);
      to.setHours(23, 59, 59, 999);
      where.entryDate.lte = to;
    }
  }

  const trades = await prisma.trade.findMany({
    where,
    orderBy: { [f.sort]: f.dir },
  });

  const openCount = trades.filter((t) => t.status === "OPEN").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trades"
        subtitle={`${trades.length} total · ${openCount} open`}
        action={
          <Link href="/trades/new">
            <Button>
              <Plus size={16} /> Add Trade
            </Button>
          </Link>
        }
      />

      <TradeFilters />

      {trades.length === 0 ? (
        <EmptyState
          icon={<LineChart size={32} />}
          title="No trades yet"
          description="Log your first trade to start tracking performance."
          action={
            <Link href="/trades/new">
              <Button>
                <Plus size={16} /> Add a trade
              </Button>
            </Link>
          }
        />
      ) : (
        <TradesTable trades={trades} />
      )}
    </div>
  );
}
