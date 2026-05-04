import Link from "next/link";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  Pencil,
} from "lucide-react";
import { cn, formatCurrency, formatNumber, pnlColorClass } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";

export type ActivityEvent =
  | {
      kind: "trade-entry";
      id: string;
      tradeId: string;
      occurredAt: Date;
      asset: string;
      direction: "LONG" | "SHORT";
      quantity: string;
      entryPrice: string;
      positionId: string | null;
    }
  | {
      kind: "trade-exit";
      id: string;
      tradeId: string;
      occurredAt: Date;
      asset: string;
      direction: "LONG" | "SHORT";
      quantity: string;
      exitPrice: string;
      pnl: string | null;
      positionId: string | null;
    }
  | {
      kind: "cash";
      id: string;
      occurredAt: Date;
      type: "DEPOSIT" | "WITHDRAWAL" | "DIVIDEND" | "FEE_ADJUST";
      amount: string;
      currency: string;
      assetSymbol: string | null;
      note: string | null;
    }
  | {
      kind: "edit";
      id: string;
      tradeId: string;
      occurredAt: Date;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      asset: string;
    };

export function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Your trades, cash flows, and edits will appear here as a unified timeline."
      />
    );
  }

  // Group by day. Server already sorts desc, so iteration is in reverse-chrono.
  const groups = new Map<string, ActivityEvent[]>();
  for (const e of events) {
    const key = e.occurredAt.toISOString().slice(0, 10);
    const existing = groups.get(key) ?? [];
    existing.push(e);
    groups.set(key, existing);
  }

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {Array.from(groups.entries()).map(([day, dayEvents]) => (
        <div key={day}>
          <h2 className="text-xs uppercase tracking-wider text-fg-subtle mb-3">
            {day === today
              ? "Today"
              : day === yesterday
                ? "Yesterday"
                : new Date(day).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year:
                      new Date(day).getFullYear() === new Date().getFullYear()
                        ? undefined
                        : "numeric",
                  })}
          </h2>
          <ul className="space-y-1.5">
            {dayEvents.map((e) => (
              <li key={`${e.kind}-${e.id}`}>
                <Row event={e} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function Row({ event }: { event: ActivityEvent }) {
  const time = event.occurredAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  const inner = (
    <div className="flex items-center gap-4 py-2.5 px-3 rounded-lg hover:bg-bg-elevated/50 transition-colors">
      <span className="text-xs text-fg-subtle font-mono w-14 shrink-0 tabular-nums">{time}</span>
      <Icon event={event} />
      <div className="flex-1 min-w-0">{renderBody(event)}</div>
    </div>
  );

  switch (event.kind) {
    case "trade-entry":
    case "trade-exit":
    case "edit":
      return (
        <Link
          href={`/trades/${event.tradeId}`}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-lg"
        >
          {inner}
        </Link>
      );
    default:
      return inner;
  }
}

function Icon({ event }: { event: ActivityEvent }) {
  const base = "h-7 w-7 shrink-0 rounded-full flex items-center justify-center";
  switch (event.kind) {
    case "trade-entry":
      return (
        <span className={cn(base, "bg-accent/15 text-accent")}>
          {event.direction === "LONG" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
        </span>
      );
    case "trade-exit":
      return (
        <span className={cn(base, "bg-fg-muted/15 text-fg-muted")}>
          {event.direction === "LONG" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
        </span>
      );
    case "cash":
      if (event.type === "DEPOSIT")
        return (
          <span className={cn(base, "bg-profit/15 text-profit")}>
            <ArrowDownCircle size={14} />
          </span>
        );
      if (event.type === "WITHDRAWAL")
        return (
          <span className={cn(base, "bg-loss/15 text-loss")}>
            <ArrowUpCircle size={14} />
          </span>
        );
      if (event.type === "DIVIDEND")
        return (
          <span className={cn(base, "bg-profit/15 text-profit")}>
            <Coins size={14} />
          </span>
        );
      return (
        <span className={cn(base, "bg-fg-muted/15 text-fg-muted")}>
          <Coins size={14} />
        </span>
      );
    case "edit":
      return (
        <span className={cn(base, "bg-fg-muted/15 text-fg-muted")}>
          <Pencil size={12} />
        </span>
      );
  }
}

function renderBody(event: ActivityEvent) {
  switch (event.kind) {
    case "trade-entry":
      return (
        <div className="text-sm">
          <span className="font-medium">
            {event.direction === "LONG" ? "Bought" : "Sold short"} {event.asset}
          </span>{" "}
          <span className="text-fg-muted font-mono">
            {formatNumber(event.quantity, 4)} @ {formatCurrency(event.entryPrice)}
          </span>
        </div>
      );
    case "trade-exit": {
      const pnlClass = pnlColorClass(event.pnl);
      return (
        <div className="text-sm flex items-center gap-2">
          <span className="font-medium">
            Closed {event.asset}{" "}
            <span className="text-fg-muted font-mono">
              {formatNumber(event.quantity, 4)} @ {formatCurrency(event.exitPrice)}
            </span>
          </span>
          {event.pnl && (
            <span className={cn("text-xs font-mono tabular-nums", pnlClass)}>
              {formatCurrency(event.pnl, { signed: true })}
            </span>
          )}
        </div>
      );
    }
    case "cash": {
      const label =
        event.type === "DEPOSIT"
          ? "Deposit"
          : event.type === "WITHDRAWAL"
            ? "Withdrawal"
            : event.type === "DIVIDEND"
              ? "Dividend"
              : "Fee";
      return (
        <div className="text-sm flex items-center gap-2">
          <span className="font-medium">{label}</span>
          {event.assetSymbol && (
            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-bg-elevated text-fg-muted">
              {event.assetSymbol}
            </span>
          )}
          <span
            className={cn(
              "font-mono tabular-nums text-sm",
              event.type === "WITHDRAWAL" || event.type === "FEE_ADJUST"
                ? "text-loss"
                : "text-profit",
            )}
          >
            {event.type === "WITHDRAWAL" || event.type === "FEE_ADJUST" ? "−" : "+"}
            {formatCurrency(event.amount)}
          </span>
          {event.note && <span className="text-xs text-fg-subtle truncate">{event.note}</span>}
        </div>
      );
    }
    case "edit":
      return (
        <div className="text-sm text-fg-muted truncate">
          Edited <span className="font-medium text-fg">{event.asset}</span> · changed{" "}
          <span className="font-mono">{event.fieldName}</span>{" "}
          <span className="text-fg-subtle font-mono">
            {event.oldValue ?? "—"} → {event.newValue ?? "—"}
          </span>
        </div>
      );
  }
}
