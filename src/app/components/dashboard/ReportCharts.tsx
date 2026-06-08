"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  ChartPanel,
  LoadFactorChart,
  MonthlyRevenueChart,
  SeatClassChart,
  TopRoutesChart
} from "@/app/components/dashboard/DashboardCharts";

export type ReportChartKey =
  | "revenue-flight"
  | "revenue-month"
  | "revenue-quarter"
  | "load-factor"
  | "revenue-route"
  | "revenue-class";

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

function MoneyTooltip({
  active,
  payload,
  label,
  valueLabel = "Value"
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string }>;
  label?: string;
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
      {label ? <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p> : null}
      <p className="text-xs text-zinc-600">
        {valueLabel}: <span className="font-semibold text-zinc-900">{formatCurrency(value)}</span>
      </p>
    </div>
  );
}

function CountTooltip({
  active,
  payload,
  label,
  valueLabel = "Tickets"
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  const value = Number(payload[0]?.value ?? 0);
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm">
      {label ? <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p> : null}
      <p className="text-xs text-zinc-600">
        {valueLabel}: <span className="font-semibold text-zinc-900">{value.toLocaleString("en-US")}</span>
      </p>
    </div>
  );
}

function aggregateMonthly(rows: Record<string, unknown>[]) {
  const map = new Map<string, { month: string; revenue: number; tickets: number }>();
  for (const row of rows) {
    const month = String(row.revenue_month ?? "");
    if (!month) continue;
    const current = map.get(month) ?? { month, revenue: 0, tickets: 0 };
    current.revenue += Number(row.monthly_revenue ?? 0);
    current.tickets += Number(row.tickets_sold ?? 0);
    map.set(month, current);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function aggregateQuarterly(rows: Record<string, unknown>[]) {
  const map = new Map<string, { label: string; revenue: number; tickets: number }>();
  for (const row of rows) {
    const year = String(row.revenue_year ?? "");
    const quarter = String(row.revenue_quarter ?? "");
    if (!year || !quarter) continue;
    const key = `${year}-Q${quarter}`;
    const current = map.get(key) ?? { label: `Q${quarter} ${year}`, revenue: 0, tickets: 0 };
    current.revenue += Number(row.quarterly_revenue ?? 0);
    current.tickets += Number(row.tickets_sold ?? 0);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function topFlightRevenue(rows: Record<string, unknown>[], limit = 12) {
  return [...rows]
    .map((row) => ({
      route: `${row.flight_number ?? "—"} · ${row.dep_airport ?? "?"}→${row.arr_airport ?? "?"}`,
      revenue: Number(row.total_revenue ?? 0),
      tickets: Number(row.tickets_sold ?? 0)
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function loadFactorPoints(rows: Record<string, unknown>[], limit = 14) {
  return [...rows]
    .map((row) => ({
      label: `${row.flight_number ?? "—"} (${row.dep_airport ?? "?"}→${row.arr_airport ?? "?"})`,
      loadFactor: Number(row.load_factor_percent ?? 0),
      revenue: Number(row.total_revenue ?? 0),
      soldSeats: Number(row.sold_seats ?? 0),
      totalSeats: Number(row.total_seats ?? 0)
    }))
    .sort((a, b) => b.loadFactor - a.loadFactor)
    .slice(0, limit);
}

function routeRevenuePoints(rows: Record<string, unknown>[], limit = 10) {
  return [...rows]
    .map((row) => ({
      route: `${row.dep_airport ?? "?"} → ${row.arr_airport ?? "?"}`,
      revenue: Number(row.route_revenue ?? 0)
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function seatClassPoints(rows: Record<string, unknown>[]) {
  return rows.map((row) => ({
    name: String(row.class_name ?? "Unknown"),
    value: Number(row.class_revenue ?? 0),
    percent: Number(row.revenue_percentage ?? 0)
  }));
}

function MonthlyTicketsChart({ data }: { data: Array<{ month: string; tickets: number }> }) {
  const chartData = data.map((row) => ({
    ...row,
    monthLabel: formatMonthLabel(row.month)
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        <XAxis dataKey="monthLabel" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} width={40} />
        <Tooltip content={<CountTooltip valueLabel="Tickets sold" />} />
        <Line
          type="monotone"
          dataKey="tickets"
          name="Tickets sold"
          stroke="#002060"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#002060", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function QuarterlyRevenueChart({ data }: { data: Array<{ label: string; revenue: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
        <YAxis
          tick={{ fontSize: 11, fill: "#71717a" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${v / 1000}k`}
          width={48}
        />
        <Tooltip content={<MoneyTooltip valueLabel="Revenue" />} />
        <Bar dataKey="revenue" name="Revenue" fill="#0770e3" radius={[6, 6, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FlightTicketsChart({ data }: { data: Array<{ route: string; tickets: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={{ stroke: "#e4e4e7" }} />
        <YAxis
          type="category"
          dataKey="route"
          width={112}
          tick={{ fontSize: 10, fill: "#52525b" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CountTooltip valueLabel="Tickets sold" />} />
        <Bar dataKey="tickets" name="Tickets sold" fill="#38bdf8" radius={[0, 4, 4, 0]} maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ReportCharts({ reportKey, rows }: { reportKey: ReportChartKey; rows: Record<string, unknown>[] }) {
  const monthly = useMemo(() => aggregateMonthly(rows), [rows]);
  const quarterly = useMemo(() => aggregateQuarterly(rows), [rows]);
  const flights = useMemo(() => topFlightRevenue(rows), [rows]);
  const loadFactor = useMemo(() => loadFactorPoints(rows), [rows]);
  const routes = useMemo(() => routeRevenuePoints(rows), [rows]);
  const seatClasses = useMemo(() => seatClassPoints(rows), [rows]);

  if (!rows.length) return null;

  return (
    <div className="mt-8 space-y-6 border-t border-zinc-100 pt-8">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Visual summary</h2>
        <p className="mt-1 text-sm text-zinc-500">Charts reflect the full dataset behind the table above.</p>
      </div>

      {reportKey === "revenue-month" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartPanel title="Revenue trend" description="Total monthly revenue across all airlines">
            <MonthlyRevenueChart data={monthly} />
          </ChartPanel>
          <ChartPanel title="Tickets sold" description="Monthly ticket volume">
            <MonthlyTicketsChart data={monthly} />
          </ChartPanel>
        </div>
      ) : null}

      {reportKey === "revenue-quarter" ? (
        <ChartPanel title="Quarterly revenue" description="Revenue aggregated by calendar quarter">
          <QuarterlyRevenueChart data={quarterly} />
        </ChartPanel>
      ) : null}

      {reportKey === "revenue-flight" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartPanel title="Top flights by revenue" description="Highest earning flights in the report">
            <TopRoutesChart data={flights} />
          </ChartPanel>
          <ChartPanel title="Tickets by flight" description="Top flights by seats sold">
            <FlightTicketsChart data={flights} />
          </ChartPanel>
        </div>
      ) : null}

      {reportKey === "load-factor" ? (
        <ChartPanel title="Load factor by flight" description="Top flights ranked by seat utilization %">
          <LoadFactorChart data={loadFactor} />
        </ChartPanel>
      ) : null}

      {reportKey === "revenue-route" ? (
        <ChartPanel title="Top routes by revenue" description="Best performing city pairs">
          <TopRoutesChart data={routes} />
        </ChartPanel>
      ) : null}

      {reportKey === "revenue-class" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <ChartPanel title="Revenue share by class" description="Distribution of paid ticket revenue">
            <SeatClassChart data={seatClasses} />
          </ChartPanel>
          <ChartPanel title="Class revenue comparison" description="Absolute revenue by cabin">
            <QuarterlyRevenueChart
              data={seatClasses.map((row) => ({ label: row.name, revenue: row.value }))}
            />
          </ChartPanel>
        </div>
      ) : null}
    </div>
  );
}
