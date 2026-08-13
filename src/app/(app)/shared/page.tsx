import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { DirectionBadge } from "@/components/ui/DirectionBadge";
import { Users } from "lucide-react";
import { cn, formatCurrency, pnlColorClass } from "@/lib/utils";

export default async function SharedPage() {
  await requireUser();

  const shared = await prisma.trade.findMany({
    where: { isShared: true, deletedAt: null, status: "CLOSED" },
    orderBy: { exitDate: "desc" },
    take: 50,
    include: {
      // Deliberately no `email` — the shared feed is visible to every signed-in
      // account, so an email here would publish it to strangers. Not selecting
      // it at all means it can't be rendered by accident later.
      user: { select: { displayName: true, avatarUrl: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Shared Feed" subtitle="Trades shared by friends" />

      {shared.length === 0 ? (
        <EmptyState
          icon={<Users size={32} />}
          title="No shared trades yet"
          description="When friends share trades, they'll show up here. Mark a trade as shared from its detail page."
        />
      ) : (
        <ul className="space-y-4">
          {shared.map((t) => {
            const author = t.user.displayName?.trim() || "A trader";
            const dateLabel = (t.exitDate ?? t.entryDate).toISOString().slice(0, 10);
            return (
              <li
                key={t.id}
                className="rounded-2xl border border-border bg-bg-card p-6 hover:border-border-strong transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar name={author} src={t.user.avatarUrl} size="md" />
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{author}</div>
                      <div className="text-xs text-fg-muted font-mono">{dateLabel}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <DirectionBadge direction={t.direction} />
                    <span
                      className={cn(
                        "text-base font-mono tabular-nums font-semibold",
                        pnlColorClass(t.pnl),
                      )}
                    >
                      {t.pnl ? formatCurrency(t.pnl, { signed: true }) : "—"}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-base font-bold">{t.asset}</span>
                  <span className="text-[11px] uppercase tracking-wider text-fg-subtle">
                    {t.assetType}
                  </span>
                </div>

                {t.notes && (
                  <p className="mt-2 text-sm text-fg-muted whitespace-pre-wrap">{t.notes}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
