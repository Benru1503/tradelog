import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { TradeForm } from "@/components/trades/TradeForm";

export default async function EditTradePage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const trade = await prisma.trade.findUnique({ where: { id: params.id } });
  if (!trade || trade.userId !== user.id) notFound();

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          href={`/trades/${trade.id}`}
          className="inline-flex items-center gap-1 text-sm text-fg-muted hover:text-fg"
        >
          <ArrowLeft size={14} /> Back to trade
        </Link>
        <h1 className="text-2xl font-semibold mt-3">Edit trade</h1>
      </div>
      <TradeForm trade={trade} />
    </div>
  );
}
