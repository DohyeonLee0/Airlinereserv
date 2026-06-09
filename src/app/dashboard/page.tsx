"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Gauge,
  LayoutDashboard,
  Plane,
  ShieldCheck,
  Ticket,
  Users
} from "lucide-react";
import {
  ChartPanel,
  LoadFactorChart,
  MonthlyRevenueChart,
  SeatClassChart,
  StatCard,
  TopRoutesChart
} from "@/app/components/dashboard/DashboardCharts";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { formatDateTime } from "@/lib/formatDate";

type OverviewData = {
  kpis: {
    active_bookings: number;
    tickets_sold: number;
    total_revenue: number;
    scheduled_flights: number;
    pending_approvals: number;
    active_customers: number;
    avg_load_factor: number;
  };
  monthlyRevenue: Array<{ month: string; revenue: number; tickets: number }>;
  seatClass: Array<{ name: string; value: number; percent: number }>;
  topRoutes: Array<{ route: string; revenue: number }>;
  loadFactorTop: Array<{ label: string; loadFactor: number; revenue: number; soldSeats: number; totalSeats: number }>;
};

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function priorMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const prior = new Date(year, month - 2, 1);
  return currentMonthKey(prior);
}

function revenueTrend(monthly: OverviewData["monthlyRevenue"]) {
  if (!monthly.length) return undefined;

  const byMonth = new Map(monthly.map((row) => [row.month, row]));
  const currentMonth = currentMonthKey();
  const previousMonth = priorMonthKey(currentMonth);
  const latest = byMonth.get(currentMonth);
  const previous = byMonth.get(previousMonth);

  if (!latest || !previous || !previous.revenue) return undefined;

  const change = ((latest.revenue - previous.revenue) / previous.revenue) * 100;
  const positive = change >= 0;
  return {
    positive,
    label: `${positive ? "+" : ""}${change.toFixed(1)}% vs prior month`
  };
}

const quickLinks = [
  { href: "/dashboard/reports", label: "Analytics & Reports", description: "Revenue, load factor, route breakdowns", icon: BarChart3 },
  { href: "/dashboard/bookings", label: "All Bookings", description: "Customer reservations and activity logs", icon: ClipboardList },
  { href: "/dashboard/master/schedules", label: "Flight Schedules", description: "Create routes and generate bookable flights", icon: Plane }
] as const;

export default function DashboardOverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    fetch("/api/staff/dashboard/overview")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.message ?? "Failed to load dashboard");
          return;
        }
        setData(json.data);
        setLoadedAt(new Date());
      })
      .catch(() => setError("Failed to load dashboard"));
  }, []);

  const trend = useMemo(() => (data ? revenueTrend(data.monthlyRevenue) : undefined), [data]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-zinc-200" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
      </div>
    );
  }

  const { kpis } = data;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-hero-gradient px-6 py-6 text-white shadow-lg sm:px-8 sm:py-7">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-20 right-24 size-48 rounded-full bg-brand/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Operations Center</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Network Performance</h1>
            <p className="mt-2 max-w-xl text-sm text-white/75">
              Real-time snapshot of revenue, seat utilization, and booking activity across all routes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 font-medium backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live data
            </span>
            {loadedAt ? (
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-white/70 backdrop-blur-sm">
                Updated {formatDateTime(loadedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatCard
          size="hero"
          label="Total Revenue (2026)"
          value={`$${Number(kpis.total_revenue).toLocaleString("en-US")}`}
          hint="Confirmed ticket seat prices"
          icon={DollarSign}
          accent="emerald"
          trend={trend}
        />
        <StatCard
          size="hero"
          label="Tickets Sold"
          value={String(kpis.tickets_sold)}
          hint={`${kpis.active_bookings} active bookings`}
          icon={Ticket}
          accent="navy"
        />
        <StatCard
          size="hero"
          label="Avg Load Factor"
          value={`${Number(kpis.avg_load_factor).toFixed(1)}%`}
          hint="Network-wide seat utilization"
          icon={Gauge}
          accent="amber"
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Scheduled Flights" value={String(kpis.scheduled_flights)} icon={Plane} accent="sky" />
        <StatCard label="Active Customers" value={String(kpis.active_customers)} icon={Users} />
        <StatCard
          label="Pending Approvals"
          value={String(kpis.pending_approvals)}
          icon={ShieldCheck}
          accent={kpis.pending_approvals > 0 ? "amber" : "default"}
          hint={kpis.pending_approvals > 0 ? "Requires admin review" : "All caught up"}
        />
        <StatCard
          label="Reporting Period"
          value={data.monthlyRevenue.length ? `${data.monthlyRevenue.length} mo.` : "—"}
          icon={CalendarDays}
          hint="Monthly revenue history"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <ChartPanel
          title="Monthly Revenue"
          description="Ticket revenue trend across the network"
          className="xl:col-span-2"
        >
          <MonthlyRevenueChart data={data.monthlyRevenue} />
        </ChartPanel>
        <ChartPanel title="Revenue by Seat Class" description="Cabin mix contribution">
          <SeatClassChart data={data.seatClass} />
        </ChartPanel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ChartPanel title="Top Routes" description="Highest-grossing city pairs">
          <TopRoutesChart data={data.topRoutes} />
        </ChartPanel>
        <ChartPanel title="Load Factor Leaders" description="Flights with strongest utilization">
          <LoadFactorChart data={data.loadFactorTop} />
        </ChartPanel>
      </section>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <LayoutDashboard className="size-4 text-brand" />
          <h2 className="text-sm font-semibold text-zinc-900">Quick Actions</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 transition-colors hover:border-brand/30 hover:bg-brand-light/40"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm ring-1 ring-zinc-200/80">
                  <Icon className="size-4" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-sm font-semibold text-zinc-900 group-hover:text-navy">
                    {link.label}
                    <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">{link.description}</p>
                </div>
              </Link>
            );
          })}
          {kpis.pending_approvals > 0 ? (
            <Link
              href="/dashboard/approvals"
              className="group flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 transition-colors hover:bg-amber-50"
            >
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm ring-1 ring-amber-200/80">
                <ShieldCheck className="size-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  {kpis.pending_approvals} Pending Approval{kpis.pending_approvals === 1 ? "" : "s"}
                </p>
                <p className="mt-0.5 text-xs text-amber-700/80">Review staff registration requests</p>
              </div>
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
