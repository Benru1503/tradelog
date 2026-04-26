"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LineChart, Users, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: LineChart },
  { href: "/shared", label: "Shared", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ user }: { user: { displayName: string | null; email: string; avatarUrl: string | null } }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-bg-elevated">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-lg">
          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
          TradeLog
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-bg-card text-fg"
                  : "text-fg-muted hover:text-fg hover:bg-bg-card/50",
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-3 border-t border-border">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 rounded-full bg-bg-card border border-border overflow-hidden flex items-center justify-center text-xs">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (user.displayName || user.email).charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm truncate">{user.displayName || user.email}</div>
            <form action="/auth/signout" method="post">
              <button type="submit" className="text-xs text-fg-subtle hover:text-fg flex items-center gap-1">
                <LogOut size={12} /> Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
