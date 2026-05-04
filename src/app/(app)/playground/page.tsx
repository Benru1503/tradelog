import { FlaskConical } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PlaygroundTabs } from "@/components/playground/PlaygroundTabs";
import {
  SnapshotsList,
  type SnapshotRow,
} from "@/components/playground/SnapshotsList";
import { formatCurrency, formatDate } from "@/lib/utils";

interface WhatIfParamsJson {
  asset?: string;
  assetName?: string;
  buyAmount?: string;
  buyDate?: string;
  sellDate?: string | null;
}
interface WhatIfResultJson {
  pnl?: number;
  pnlPct?: number;
}
interface DcaParamsJson {
  asset?: string;
  assetName?: string;
  amount?: string;
  cadence?: "WEEKLY" | "MONTHLY";
  from?: string;
  to?: string | null;
}
interface DcaResultJson {
  pnl?: number;
  pnlPct?: number;
}

export default async function PlaygroundPage() {
  const user = await requireUser();
  const snapshots = await prisma.simSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const rows: SnapshotRow[] = snapshots.map((s) => {
    if (s.kind === "WHAT_IF") {
      const params = s.params as WhatIfParamsJson;
      const result = s.result as WhatIfResultJson;
      const summary = `${formatCurrency(params.buyAmount ?? "0")} on ${
        params.buyDate ? formatDate(params.buyDate) : "?"
      } → ${params.sellDate ? formatDate(params.sellDate) : "today"}`;
      return {
        id: s.id,
        kind: "WHAT_IF",
        asset: params.asset ?? "—",
        assetName: params.assetName ?? "",
        summary,
        pnl: typeof result.pnl === "number" ? result.pnl : 0,
        pnlPct: typeof result.pnlPct === "number" ? result.pnlPct : 0,
        createdAt: s.createdAt.toISOString(),
      };
    }
    const params = s.params as DcaParamsJson;
    const result = s.result as DcaResultJson;
    const cadenceLabel =
      params.cadence === "WEEKLY" ? "wk" : params.cadence === "MONTHLY" ? "mo" : "?";
    const summary = `${formatCurrency(params.amount ?? "0")}/${cadenceLabel}, ${
      params.from ? formatDate(params.from) : "?"
    } → ${params.to ? formatDate(params.to) : "today"}`;
    return {
      id: s.id,
      kind: "DCA",
      asset: params.asset ?? "—",
      assetName: params.assetName ?? "",
      summary,
      pnl: typeof result.pnl === "number" ? result.pnl : 0,
      pnlPct: typeof result.pnlPct === "number" ? result.pnlPct : 0,
      createdAt: s.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Playground"
        subtitle="Sandbox — none of this affects your portfolio"
        action={<FlaskConical size={20} className="text-fg-subtle" />}
      />

      <PlaygroundTabs />

      <Card>
        <CardHeader>
          <CardTitle>Saved snapshots</CardTitle>
        </CardHeader>
        <SnapshotsList rows={rows} />
      </Card>
    </div>
  );
}
