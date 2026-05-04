"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { WhatIfPanel } from "@/components/playground/WhatIfPanel";
import { DcaPanel } from "@/components/playground/DcaPanel";

type Tab = "WHAT_IF" | "DCA";

export function PlaygroundTabs() {
  const [tab, setTab] = useState<Tab>("WHAT_IF");
  return (
    <div className="space-y-3">
      <div role="tablist" className="inline-flex rounded-lg border border-border bg-bg-elevated/40 p-1">
        <TabButton active={tab === "WHAT_IF"} onClick={() => setTab("WHAT_IF")}>
          What if
        </TabButton>
        <TabButton active={tab === "DCA"} onClick={() => setTab("DCA")}>
          Dollar-cost average
        </TabButton>
      </div>
      {tab === "WHAT_IF" ? <WhatIfPanel /> : <DcaPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm rounded-md transition-colors",
        active
          ? "bg-bg-elevated text-fg ring-1 ring-border-strong"
          : "text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
