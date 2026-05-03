import {
  LayoutDashboard,
  Briefcase,
  Star,
  List,
  History,
  BarChart3,
  FlaskConical,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  // Items flagged disabled render as muted "coming soon" rows. Used for Phase 3/4
  // entries we want to surface but not yet route to.
  disabled?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/positions", label: "Positions", icon: Briefcase },
      { href: "/watchlist", label: "Watchlist", icon: Star },
    ],
  },
  {
    label: "Records",
    items: [
      { href: "/trades", label: "Trades", icon: List },
      { href: "/activity", label: "Activity", icon: History },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/playground", label: "Playground", icon: FlaskConical, disabled: true },
    ],
  },
  {
    label: "Social",
    items: [{ href: "/shared", label: "Shared", icon: Users }],
  },
];

// Flat list for the mobile horizontal scroll — no section labels.
export const NAV_FLAT: NavItem[] = NAV_SECTIONS.flatMap((s) =>
  s.items.filter((i) => !i.disabled),
);
