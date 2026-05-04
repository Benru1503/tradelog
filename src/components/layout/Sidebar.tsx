"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import { NAV_SECTIONS } from "./nav";

export function Sidebar({
  user,
}: {
  user: { displayName: string | null; email: string; avatarUrl: string | null };
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-bg sticky top-0 h-screen">
      <div className="px-6 py-5 border-b border-border">
        <Logo />
      </div>

      <nav className="flex-1 px-3 py-5 space-y-5 overflow-y-auto scrollbar-thin">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="px-4 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active =
                  !item.disabled &&
                  (pathname === item.href || pathname.startsWith(item.href + "/"));
                const baseClass =
                  "flex items-center gap-3 px-4 py-2 rounded-lg text-[14px] transition-colors";
                if (item.disabled) {
                  return (
                    <div
                      key={item.href}
                      className={cn(baseClass, "text-fg-subtle/70 cursor-not-allowed")}
                      title="Coming soon"
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="flex-1">{item.label}</span>
                      <span className="text-[10px] text-fg-subtle/60">soon</span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      baseClass,
                      active
                        ? "bg-bg-elevated text-fg ring-1 ring-inset ring-border"
                        : "text-fg-muted hover:text-fg hover:bg-bg-elevated/60",
                    )}
                  >
                    <Icon
                      size={16}
                      className={cn("shrink-0", active ? "text-accent" : "text-fg-subtle")}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pb-4 pt-3 border-t border-border space-y-1">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-2 py-2 rounded-lg transition-colors",
            pathname.startsWith("/settings") ? "bg-bg-elevated" : "hover:bg-bg-elevated/60",
          )}
        >
          <Avatar name={user.displayName ?? user.email} src={user.avatarUrl} size="md" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{user.displayName || user.email}</div>
            <div className="text-xs text-fg-subtle flex items-center gap-1">
              <Settings size={11} />
              Settings
            </div>
          </div>
        </Link>
        <form action="/auth/signout" method="post" className="px-2">
          <button type="submit" className="text-xs text-fg-subtle hover:text-fg transition-colors">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
