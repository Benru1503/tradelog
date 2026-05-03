import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TradeForm } from "@/components/trades/TradeForm";

interface PageProps {
  searchParams: { asset?: string; assetType?: string; direction?: string };
}

export default async function NewTradePage({ searchParams }: PageProps) {
  const user = await requireUser();

  // Pre-fetch all open positions so the form can intercept with the averaging
  // preview when the user enters a trade for an asset they already hold. Tags
  // come from the same prefetch so the picker can render inline.
  const [openPositions, tags] = await Promise.all([
    prisma.position.findMany({
      where: { userId: user.id, status: "OPEN" },
      select: {
        id: true,
        asset: true,
        assetType: true,
        direction: true,
        totalQty: true,
        avgCost: true,
      },
    }),
    prisma.tag.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
    }),
  ]);

  const positionsForForm = openPositions.map((p) => ({
    id: p.id,
    asset: p.asset,
    assetType: p.assetType,
    direction: p.direction,
    totalQty: new Decimal(p.totalQty.toString()).toString(),
    avgCost: new Decimal(p.avgCost.toString()).toString(),
  }));

  const defaults = {
    asset: searchParams.asset?.toUpperCase(),
    assetType: ["STOCK", "CRYPTO", "FOREX"].includes(searchParams.assetType ?? "")
      ? (searchParams.assetType as "STOCK" | "CRYPTO" | "FOREX")
      : undefined,
    direction: ["LONG", "SHORT"].includes(searchParams.direction ?? "")
      ? (searchParams.direction as "LONG" | "SHORT")
      : undefined,
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href="/trades"
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={14} /> Back to trades
        </Link>
        <h1 className="text-2xl font-semibold mt-3">New trade</h1>
      </div>
      <TradeForm openPositions={positionsForForm} defaults={defaults} tags={tags} />
    </div>
  );
}
