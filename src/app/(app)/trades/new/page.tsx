import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TradeForm } from "@/components/trades/TradeForm";

export default function NewTradePage() {
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
      <TradeForm />
    </div>
  );
}
