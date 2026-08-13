import { MessageSquareHeart } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { CoachPanel } from "@/components/coach/CoachPanel";
import { MIN_CLOSED_TRADES, type CoachFacts } from "@/lib/coach/facts";
import { isCoachConfigured } from "@/lib/coach/gemini";
import { coachReportSchema } from "@/lib/coach/schema";
import type { CoachReportDto } from "./actions";

export default async function CoachPage() {
  const user = await requireUser();

  const [latest, closedTrades] = await Promise.all([
    prisma.coachReport.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.trade.count({ where: { userId: user.id, deletedAt: null, status: "CLOSED" } }),
  ]);

  // Stored reports are validated on the way out too — a row written by an
  // older schema version shouldn't crash the page.
  let initialReport: CoachReportDto | null = null;
  if (latest) {
    const parsed = coachReportSchema.safeParse(latest.report);
    if (parsed.success) {
      initialReport = {
        id: latest.id,
        report: parsed.data,
        facts: latest.facts as unknown as CoachFacts,
        model: latest.model,
        tradesCount: latest.tradesCount,
        createdAt: latest.createdAt.toISOString(),
        reused: true,
      };
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Coach"
        subtitle="An AI review of how you trade — patterns, not predictions. Not financial advice."
        action={<MessageSquareHeart size={20} className="text-fg-subtle" />}
      />

      <CoachPanel
        initialReport={initialReport}
        configured={isCoachConfigured()}
        closedTrades={closedTrades}
        minClosedTrades={MIN_CLOSED_TRADES}
      />
    </div>
  );
}
