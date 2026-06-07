"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { cn } from "@/lib/cn";

const CHART_COLORS = ["#0770e3", "#002060", "#38bdf8", "#6366f1", "#0ea5e9", "#1d4ed8"];

function formatCurrency(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatMonthLabel(month: string) {
  const [year, mon] = month.split("-");
  if (!year || !mon) return month;
  const date = new Date(Number(year), Number(mon) - 1, 1);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

type TooltipPayload = { color?: string; name?: string; value?: number; dataKey?: string };

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  valueFormatter?: (value: number, dataKey?: string) => [string, string];
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
      {label ? <p className="mb-1.5 text-xs font-medium text-zinc-500">{formatMonthLabel(String(label)) || label}</p> : null}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const raw = Number(entry.value ?? 0);
          const [formatted, name] = valueFormatter
            ? valueFormatter(raw, entry.dataKey)
            : [formatCurrency(raw), String(entry.name ?? entry.dataKey ?? "Value")];
          return (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-zinc-600">
                <span className="size-2 rounded-full" style={{ backgroundColor: entry.color ?? "#0770e3" }} />
                {name}
              </span>
              <span className="font-semibold tabular-nums text-zinc-900">{formatted}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ChartPanel({
  title,
  description,
  children,
  className
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm", className)}>
      <div className="border-b border-zinc-100 bg-zinc-50/50 px-5 py-4">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        {description ? <p className="mt-0.5 text-xs text-zinc-500">{description}</p> : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

type MonthlyPoint = { month: string; revenue: number; tickets: number };
type ClassPoint = { name: string; value: number; percent: number };
type RoutePoint = { route: string; revenue: number };
type LoadPoint = { label: string; loadFactor: number; revenue: number; soldSeats?: number; totalSeats?: number };

export function MonthlyRevenueChart({ data }: { data: MonthlyPoint[] }) {
  const chartData = data.map((row) => ({ ...row, monthLabel: formatMonthLabel(row.month) }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0770e3" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#0770e3" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "#71717a" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v / 1000}k`}
          width={48}
        />
        <Tooltip
          content={
            <ChartTooltip
              valueFormatter={(value, key) =>
                key === "tickets" ? [String(value), "Tickets"] : [formatCurrency(value), "Revenue"]
              }
            />
          }
        />
        <Area
          type="monotone"
          dataKey="revenue"
          name="Revenue"
          stroke="#0770e3"
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
          dot={{ r: 3, fill: "#0770e3", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#002060" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SeatClassChart({ data }: { data: ClassPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="46%"
          innerRadius={68}
          outerRadius={102}
          paddingAngle={2}
          stroke="white"
          strokeWidth={2}
        >
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={(v) => [formatCurrency(v), "Revenue"]} />} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-zinc-600">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopRoutesChart({ data }: { data: RoutePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#71717a" }}
          tickLine={false}
          axisLine={{ stroke: "#e4e4e7" }}
          tickFormatter={(v) => `$${v / 1000}k`}
        />
        <YAxis
          type="category"
          dataKey="route"
          width={88}
          tick={{ fontSize: 11, fill: "#52525b" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => [formatCurrency(v), "Revenue"]} />} />
        <Bar dataKey="revenue" name="Revenue" fill="#002060" radius={[0, 4, 4, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LoadFactorChart({ data }: { data: LoadPoint[] }) {
  const maxLoad = Math.max(...data.map((row) => row.loadFactor), 0);
  const yMax = Math.min(100, Math.max(20, Math.ceil(maxLoad * 1.15)));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 52 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#71717a" }}
          angle={-28}
          textAnchor="end"
          height={56}
          interval={0}
          tickLine={false}
          axisLine={{ stroke: "#e4e4e7" }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#71717a" }}
          unit="%"
          domain={[0, yMax]}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0]?.payload as LoadPoint;
            return (
              <div className="rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
                <p className="mb-1.5 text-xs font-medium text-zinc-500">{label}</p>
                <p className="text-xs text-zinc-600">
                  Load factor:{" "}
                  <span className="font-semibold text-zinc-900">{Number(row.loadFactor).toFixed(1)}%</span>
                </p>
                {row.soldSeats != null && row.totalSeats != null ? (
                  <p className="mt-1 text-xs text-zinc-600">
                    Seats sold:{" "}
                    <span className="font-semibold text-zinc-900">
                      {row.soldSeats.toLocaleString("en-US")} / {row.totalSeats.toLocaleString("en-US")}
                    </span>
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-zinc-600">
                  Revenue: <span className="font-semibold text-zinc-900">{formatCurrency(row.revenue)}</span>
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="loadFactor" name="Load factor" fill="#0770e3" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

const ACCENT_STYLES = {
  default: {
    icon: "bg-zinc-100 text-zinc-600",
    value: "text-zinc-900",
    ring: "ring-zinc-200/60"
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    value: "text-emerald-700",
    ring: "ring-emerald-200/60"
  },
  sky: {
    icon: "bg-sky-50 text-sky-600",
    value: "text-sky-700",
    ring: "ring-sky-200/60"
  },
  amber: {
    icon: "bg-amber-50 text-amber-600",
    value: "text-amber-700",
    ring: "ring-amber-200/60"
  },
  navy: {
    icon: "bg-brand-light text-brand",
    value: "text-navy",
    ring: "ring-brand/20"
  }
} as const;

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "default",
  trend,
  size = "default"
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: keyof typeof ACCENT_STYLES;
  trend?: { label: string; positive?: boolean };
  size?: "default" | "hero";
}) {
  const styles = ACCENT_STYLES[accent];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm ring-1",
        styles.ring,
        size === "hero" ? "p-5 sm:p-6" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
          <p className={cn("mt-2 font-bold tabular-nums tracking-tight", styles.value, size === "hero" ? "text-3xl" : "text-2xl")}>
            {value}
          </p>
          {hint ? <p className="mt-1.5 text-xs text-zinc-500">{hint}</p> : null}
          {trend ? (
            <p
              className={cn(
                "mt-2 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
                trend.positive === true && "bg-emerald-50 text-emerald-700",
                trend.positive === false && "bg-red-50 text-red-700",
                trend.positive === undefined && "bg-zinc-100 text-zinc-600"
              )}
            >
              {trend.label}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", styles.icon)}>
            <Icon className="size-5" strokeWidth={1.75} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
