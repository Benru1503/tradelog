"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Users, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: LineChart },
  { href: "/shared", label: "Shared", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileHeader() {
  const pathname = usePathname();
  return (
    <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-bg-elevated">
      <Link href="/dashboard" className="font-semibold flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-accent" />
        TradeLog
      </Link>
      <nav className="flex items-center gap-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "p-2 rounded-md",
                active ? "bg-bg-card text-fg" : "text-fg-muted hover:text-fg",
              )}
            >
              <Icon size={18} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
