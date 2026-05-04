"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { NAV_FLAT } from "./nav";

export function MobileHeader() {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/settings");
  return (
    <div className="md:hidden border-b border-border bg-bg">
      <div className="flex items-center justify-between px-4 py-3">
        <Logo />
        <Link
          href="/settings"
          aria-label="Settings"
          className={cn(
            "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            settingsActive
              ? "bg-bg-elevated text-fg ring-1 ring-inset ring-border"
              : "text-fg-muted hover:text-fg hover:bg-bg-elevated",
          )}
        >
          <Settings size={16} />
        </Link>
      </div>
      <nav className="flex items-center gap-1 px-3 pb-3 overflow-x-auto scrollbar-thin">
        {NAV_FLAT.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors",
                active
                  ? "bg-bg-elevated text-fg ring-1 ring-inset ring-border"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <Icon size={14} className={active ? "text-accent" : "text-fg-subtle"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
