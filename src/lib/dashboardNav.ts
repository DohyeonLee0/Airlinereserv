import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  Layers3,
  LayoutDashboard,
  Plane,
  ShieldCheck,
  Tag,
  TowerControl
} from "lucide-react";

export type DashboardNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  children?: DashboardNavItem[];
};

export const dashboardNav: DashboardNavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  {
    href: "/dashboard/master",
    label: "Master Data",
    icon: Building2,
    children: [
      { href: "/dashboard/master/airlines", label: "Airlines", icon: Building2 },
      { href: "/dashboard/master/airports", label: "Airports", icon: TowerControl },
      { href: "/dashboard/master/aircraft", label: "Aircraft", icon: Plane },
      { href: "/dashboard/master/seat-templates", label: "Seat Templates", icon: Layers3 },
      { href: "/dashboard/master/schedules", label: "Flight Schedules", icon: CalendarClock }
    ]
  },
  { href: "/dashboard/schedules", label: "Schedule Tracker", icon: CalendarRange },
  { href: "/dashboard/promotions", label: "Promotions", icon: Tag },
  { href: "/dashboard/bookings", label: "All Bookings", icon: ClipboardList },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/approvals", label: "Staff Approvals", icon: ShieldCheck, adminOnly: true }
];

export function flattenDashboardNav(items: DashboardNavItem[]): DashboardNavItem[] {
  return items.flatMap((item) => (item.children?.length ? item.children : [item]));
}
