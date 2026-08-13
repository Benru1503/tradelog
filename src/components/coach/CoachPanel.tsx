"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn, formatCurrency, formatDateTime } from "@/lib/utils";
import { runCoachReport, type CoachReportDto } from "@/app/(app)/coach/actions";
import type { FindingSeverity } from "@/lib/coach/schema";

const SEVERITY_STYLES: Record<FindingSeverity, string> = {
  HIGH: "bg-loss/10 text-loss ring-loss/30",
  MEDIUM: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  LOW: "bg-fg-subtle/10 text-fg-muted ring-border",
};

const CATEGORY_LABELS: Record<string, string> = {
  EXIT_DISCIPLINE: "Exit discipline",
  RISK_MANAGEMENT: "Risk management",
  POSITION_SIZING: "Position sizing",
  ENTRY_TIMING: "Entry timing",
  CONSISTENCY: "Consistency",
  COSTS: "Costs",
  JOURNALING: "Journaling",
};

interface Props {
  initialReport: CoachReportDto | null;
  configured: boolean;
  closedTrades: number;
  minClosedTrades: number;
}

export function CoachPanel({ initialReport, configured, closedTrades, minClosedTrades }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [report, setReport] = useState<CoachReportDto | null>(initialReport);
  const [error, setError] = useState<string | null>(null);

  const enoughTrades = closedTrades >= minClosedTrades;
  const canRun = configured && enoughTrades;

  function run(force: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await runCoachReport(force);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setReport(res.report);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle>Performance review</CardTitle>
            <span className="text-[11px] text-fg-subtle">
              Every figure is computed from your trades · the model only interprets
            </span>
          </div>
        </CardHeader>

        {!configured && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
            The coach needs a Gemini API key. Add <code className="font-mono">GEMINI_API_KEY</code>{" "}
            to <code className="font-mono">.env.local</code> and restart the dev server.
          </div>
        )}

        {configured && !enoughTrades && (
          <div className="rounded-md border border-border bg-bg-elevated/50 px-3 py-2 text-sm text-fg-muted">
            Log at least {minClosedTrades} closed trades and the coach can start finding patterns —
            you have {closedTrades}.
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
            <TriangleAlert size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={() => run(false)} disabled={pending || !canRun}>
            {pending ? "Analysing…" : report ? "Refresh review" : "Analyse my trading"}
          </Button>
          {report && (
            <Button variant="secondary" onClick={() => run(true)} disabled={pending || !canRun}>
              <RefreshCw size={14} />
              Regenerate
            </Button>
          )}
          {report && (
            <span className="text-xs text-fg-subtle">
              {report.reused ? "Cached — your trades haven't changed since" : "Generated"}{" "}
              {formatDateTime(report.createdAt)} · {report.model}
            </span>
          )}
        </div>
      </Card>

      {report && <ReportBody report={report} />}
    </div>
  );
}

function ReportBody({ report }: { report: CoachReportDto }) {
  const { summary, winLoss, holdTime } = report.facts;

  return (
    <>
      <Card>
        <div className="flex items-start gap-3">
          <Sparkles size={20} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-lg font-medium leading-snug">{report.report.headline}</p>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border pt-4">
          <Metric label="Closed trades" value={String(summary.closedTrades)} />
          <Metric
            label="Win rate"
            value={summary.winRatePct === null ? "—" : `${summary.winRatePct.toFixed(1)}%`}
          />
          <Metric
            label="Avg win / avg loss"
            value={winLoss.payoffRatio === null ? "—" : `${winLoss.payoffRatio.toFixed(2)}×`}
          />
          <Metric
            label="Hold ratio (L/W)"
            value={
              holdTime.loserToWinnerHoldRatio === null
                ? "—"
                : `${holdTime.loserToWinnerHoldRatio.toFixed(2)}×`
            }
          />
        </div>
      </Card>

      <div className="space-y-4">
        {report.report.findings.map((finding, i) => (
          <Card key={`${finding.title}-${i}`}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold">{finding.title}</h3>
                <span className="text-xs text-fg-subtle">
                  {CATEGORY_LABELS[finding.category] ?? finding.category}
                </span>
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                  SEVERITY_STYLES[finding.severity],
                )}
              >
                {finding.severity}
              </span>
            </div>

            <p className="mt-3 text-sm text-fg-muted leading-relaxed">{finding.observation}</p>

            {finding.evidence.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {finding.evidence.map((e, j) => (
                  <li
                    key={j}
                    className="rounded-md border border-border/60 bg-bg-elevated/50 px-2 py-1 font-mono text-[11px] text-fg-subtle"
                  >
                    {e}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent">
                Try this
              </span>
              <p className="mt-1 text-sm leading-relaxed">{finding.suggestion}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {report.report.strengths.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>What&apos;s working</CardTitle>
            </CardHeader>
            <ul className="space-y-2 text-sm text-fg-muted">
              {report.report.strengths.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-profit">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Focus this month</CardTitle>
          </CardHeader>
          <p className="text-sm leading-relaxed">{report.report.focusThisMonth}</p>
        </Card>
      </div>

      <details className="rounded-2xl border border-border bg-bg-card px-6 py-4 text-sm">
        <summary className="cursor-pointer select-none text-fg-muted">
          The numbers behind this review
        </summary>
        <div className="mt-4 space-y-3 text-xs text-fg-muted">
          <p>
            The model never sees your raw trades and never does arithmetic. It receives the
            pre-computed fact sheet below — built in TypeScript from your database rows — and is
            asked to interpret it. Every figure it quotes should appear here.
          </p>
          <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Fact label="Total P&L" value={formatCurrency(summary.totalPnl, { signed: true })} />
            <Fact
              label="Expectancy / trade"
              value={
                summary.expectancyPerTrade === null
                  ? "—"
                  : formatCurrency(summary.expectancyPerTrade, { signed: true })
              }
            />
            <Fact label="Avg win" value={formatCurrency(winLoss.avgWin)} />
            <Fact label="Avg loss" value={formatCurrency(winLoss.avgLoss)} />
            <Fact
              label="Avg hold — winners"
              value={
                holdTime.avgHoldHoursWinners === null
                  ? "—"
                  : `${holdTime.avgHoldHoursWinners.toFixed(1)}h`
              }
            />
            <Fact
              label="Avg hold — losers"
              value={
                holdTime.avgHoldHoursLosers === null
                  ? "—"
                  : `${holdTime.avgHoldHoursLosers.toFixed(1)}h`
              }
            />
          </dl>
          <details>
            <summary className="cursor-pointer select-none">Full fact sheet (JSON)</summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-bg-elevated/60 p-3 font-mono text-[10px] leading-relaxed">
              {JSON.stringify(report.facts, null, 2)}
            </pre>
          </details>
        </div>
      </details>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-fg-subtle">{label}</div>
      <div className="mt-0.5 font-mono tabular-nums text-lg">{value}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-fg-subtle">{label}</dt>
      <dd className="font-mono tabular-nums text-fg">{value}</dd>
    </div>
  );
}
