"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, ArrowDownCircle, ArrowUpCircle, Coins } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CashFlowModal } from "@/components/cashflows/CashFlowModal";
import { cn } from "@/lib/utils";

export function AddMenu() {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<null | "DEPOSIT" | "WITHDRAWAL" | "DIVIDEND">(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div className="relative" ref={containerRef}>
        <Button onClick={() => setOpen((o) => !o)}>
          <Plus size={16} /> Add
        </Button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-border bg-bg-card shadow-xl py-1.5"
          >
            <Link
              href="/trades/new"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-bg-elevated"
            >
              <Plus size={14} className="text-accent" />
              New trade
            </Link>
            <div className="my-1 border-t border-border" />
            <MenuButton
              icon={<ArrowDownCircle size={14} className="text-profit" />}
              label="Deposit"
              onClick={() => {
                setOpen(false);
                setModal("DEPOSIT");
              }}
            />
            <MenuButton
              icon={<ArrowUpCircle size={14} className="text-loss" />}
              label="Withdrawal"
              onClick={() => {
                setOpen(false);
                setModal("WITHDRAWAL");
              }}
            />
            <MenuButton
              icon={<Coins size={14} className="text-fg-muted" />}
              label="Dividend"
              onClick={() => {
                setOpen(false);
                setModal("DIVIDEND");
              }}
            />
          </div>
        )}
      </div>
      <CashFlowModal
        open={modal !== null}
        onClose={() => setModal(null)}
        defaultType={modal ?? "DEPOSIT"}
      />
    </>
  );
}

function MenuButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-bg-elevated text-left",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
