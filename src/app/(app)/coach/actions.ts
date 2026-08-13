"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  buildCoachFacts,
  hasEnoughHistory,
  MIN_CLOSED_TRADES,
  type CoachFacts,
  type TradeWithTags,
} from "@/lib/coach/facts";
import { generateCoachReport, hashFacts } from "@/lib/coach/report";
import { isCoachConfigured } from "@/lib/coach/gemini";
import type { CoachReportBody } from "@/lib/coach/schema";

/** Per-user daily cap on Gemini calls. Reads of cached reports don't count. */
const MAX_COACH_RUNS_PER_DAY = 10;

export interface CoachReportDto {
  id: string;
  report: CoachReportBody;
  facts: CoachFacts;
  model: string;
  tradesCount: number;
  createdAt: string;
  /** True when an unchanged history let us reuse a stored report instead of calling Gemini. */
  reused: boolean;
}

export type CoachResponse =
  | { ok: true; report: CoachReportDto }
  | { ok: false; error: string; needsMoreTrades?: boolean };

/** Load the user's history and reduce it to the deterministic fact sheet. */
async function loadFacts(userId: string): Promise<CoachFacts> {
  const [trades, cashFlows] = await Promise.all([
    prisma.trade.findMany({
      where: { userId, deletedAt: null },
      include: { tags: { include: { tag: true } } },
      orderBy: { entryDate: "asc" },
    }),
    prisma.cashFlow.findMany({ where: { userId } }),
  ]);

  const withTags: TradeWithTags[] = trades.map(({ tags, ...trade }) => ({
    ...trade,
    tagNames: tags.map((tt) => tt.tag.name),
  }));

  return buildCoachFacts(withTags, cashFlows);
}

/**
 * Generate (or reuse) a coaching report for the signed-in user.
 * Passing `force` skips the cache and always calls the model.
 */
export async function runCoachReport(force = false): Promise<CoachResponse> {
  const user = await requireUser();

  if (!isCoachConfigured()) {
    return {
      ok: false,
      error: "The coach isn't configured yet — add GEMINI_API_KEY to .env.local and restart.",
    };
  }

  const facts = await loadFacts(user.id);
  if (!hasEnoughHistory(facts)) {
    return {
      ok: false,
      needsMoreTrades: true,
      error: `The coach needs at least ${MIN_CLOSED_TRADES} closed trades to find patterns — you have ${facts.summary.closedTrades}.`,
    };
  }

  const factsHash = hashFacts(facts);

  if (!force) {
    const existing = await prisma.coachReport.findFirst({
      where: { userId: user.id, factsHash },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      return {
        ok: true,
        report: {
          id: existing.id,
          report: existing.report as unknown as CoachReportBody,
          facts: existing.facts as unknown as CoachFacts,
          model: existing.model,
          tradesCount: existing.tradesCount,
          createdAt: existing.createdAt.toISOString(),
          reused: true,
        },
      };
    }
  }

  // Signup is open, so anyone can reach this action. Each run spends real
  // quota on a single shared Gemini key, and `force` deliberately skips the
  // cache above — without a cap, one account could exhaust the day's quota
  // and break the coach for everybody. Cached reads never reach here.
  const runsToday = await prisma.coachReport.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  if (runsToday >= MAX_COACH_RUNS_PER_DAY) {
    return {
      ok: false,
      error: `You've generated ${runsToday} reports in the last 24 hours. The coach is limited to ${MAX_COACH_RUNS_PER_DAY} a day — your existing reports are still below.`,
    };
  }

  const generated = await generateCoachReport(facts);
  if (!generated.ok) return { ok: false, error: generated.error };

  const row = await prisma.coachReport.create({
    data: {
      userId: user.id,
      factsHash,
      facts: JSON.parse(JSON.stringify(facts)),
      report: JSON.parse(JSON.stringify(generated.report)),
      model: generated.model,
      tradesCount: facts.summary.totalTrades,
    },
  });

  revalidatePath("/coach");

  return {
    ok: true,
    report: {
      id: row.id,
      report: generated.report,
      facts,
      model: row.model,
      tradesCount: row.tradesCount,
      createdAt: row.createdAt.toISOString(),
      reused: false,
    },
  };
}

export type DeleteCoachReportResult = { ok: true } | { ok: false; error: string };

export async function deleteCoachReport(id: string): Promise<DeleteCoachReportResult> {
  const user = await requireUser();
  const existing = await prisma.coachReport.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return { ok: false, error: "Report not found." };
  }
  await prisma.coachReport.delete({ where: { id } });
  revalidatePath("/coach");
  return { ok: true };
}
