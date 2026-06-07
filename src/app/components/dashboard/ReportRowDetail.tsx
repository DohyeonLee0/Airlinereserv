"use client";

import { X } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/cn";

type ReportKey =
  | "revenue-flight"
  | "revenue-month"
  | "revenue-quarter"
  | "load-factor"
  | "revenue-route"
  | "revenue-class";

const REPORT_TITLES: Record<ReportKey, string> = {
  "revenue-flight": "Flight Revenue Detail",
  "revenue-month": "Monthly Revenue Detail",
  "revenue-quarter": "Quarterly Revenue Detail",
  "load-factor": "Load Factor Detail",
  "revenue-route": "Route Revenue Detail",
  "revenue-class": "Seat Class Revenue Detail"
};

const FIELD_LABELS: Record<string, string> = {
  airline_id: "Airline",
  flight_number: "Flight number",
  flight_id: "Flight ID",
  itinerary_id: "Itinerary ID",
  flight_date: "Flight date",
  dep_airport: "Departure",
  arr_airport: "Arrival",
  tickets_sold: "Tickets sold",
  total_revenue: "Total revenue",
  monthly_revenue: "Monthly revenue",
  quarterly_revenue: "Quarterly revenue",
  route_revenue: "Route revenue",
  class_revenue: "Class revenue",
  revenue_month: "Revenue month",
  revenue_year: "Year",
  revenue_quarter: "Quarter",
  sold_seats: "Seats sold",
  total_seats: "Total seats",
  load_factor_percent: "Load factor",
  class_name: "Seat class",
  revenue_percentage: "Revenue share"
};

const MONEY_FIELDS = new Set([
  "total_revenue",
  "monthly_revenue",
  "quarterly_revenue",
  "route_revenue",
  "class_revenue"
]);

const PERCENT_FIELDS = new Set(["load_factor_percent", "revenue_percentage"]);

function formatLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function formatValue(key: string, value: unknown): string {
  if (value == null || value === "") return "—";

  if (MONEY_FIELDS.has(key)) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return String(value);
    return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  if (PERCENT_FIELDS.has(key)) {
    const pct = Number(value);
    if (!Number.isFinite(pct)) return String(value);
    return `${pct.toFixed(2)}%`;
  }

  if (key === "flight_date") return formatDate(value);
  if (key.endsWith("_time") || key === "booking_time") return formatDateTime(value);

  if (key === "revenue_month" && /^\d{4}-\d{2}$/.test(String(value))) {
    const [year, mon] = String(value).split("-");
    const date = new Date(Number(year), Number(mon) - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  if (key === "revenue_quarter") return `Q${value}`;

  return String(value);
}

function detailHeadline(reportKey: ReportKey, row: Record<string, unknown>): string {
  switch (reportKey) {
    case "load-factor":
    case "revenue-flight":
      return `${row.flight_number ?? "Flight"} · ${row.dep_airport ?? "?"} → ${row.arr_airport ?? "?"}`;
    case "revenue-month":
      return `${formatValue("revenue_month", row.revenue_month)} · ${row.airline_id ?? "Airline"}`;
    case "revenue-quarter":
      return `${row.airline_id ?? "Airline"} · ${row.revenue_year ?? "?"} Q${row.revenue_quarter ?? "?"}`;
    case "revenue-route":
      return `${row.dep_airport ?? "?"} → ${row.arr_airport ?? "?"}`;
    case "revenue-class":
      return String(row.class_name ?? "Seat class");
    default:
      return "Selected row";
  }
}

function summaryText(reportKey: ReportKey, row: Record<string, unknown>): string {
  switch (reportKey) {
    case "load-factor": {
      const sold = Number(row.sold_seats ?? 0);
      const total = Number(row.total_seats ?? 0);
      const pct = Number(row.load_factor_percent ?? 0);
      return `${sold.toLocaleString("en-US")} of ${total.toLocaleString("en-US")} seats sold (${pct.toFixed(1)}% utilization).`;
    }
    case "revenue-flight":
      return `${Number(row.tickets_sold ?? 0).toLocaleString("en-US")} tickets · ${formatValue("total_revenue", row.total_revenue)} total revenue.`;
    case "revenue-month":
      return `${Number(row.tickets_sold ?? 0).toLocaleString("en-US")} tickets in ${formatValue("revenue_month", row.revenue_month)}.`;
    case "revenue-quarter":
      return `${Number(row.tickets_sold ?? 0).toLocaleString("en-US")} tickets in quarter ${row.revenue_quarter ?? "?"}.`;
    case "revenue-route":
      return `${Number(row.tickets_sold ?? 0).toLocaleString("en-US")} tickets on this city pair.`;
    case "revenue-class":
      return `${Number(row.tickets_sold ?? 0).toLocaleString("en-US")} tickets · ${formatValue("revenue_percentage", row.revenue_percentage)} of network revenue.`;
    default:
      return "Full breakdown for the selected report row.";
  }
}

export function reportRowKey(reportKey: ReportKey, row: Record<string, unknown>): string {
  switch (reportKey) {
    case "load-factor":
    case "revenue-flight":
      return `flight-${row.flight_id}`;
    case "revenue-month":
      return `month-${row.airline_id}-${row.revenue_month}`;
    case "revenue-quarter":
      return `quarter-${row.airline_id}-${row.revenue_year}-${row.revenue_quarter}`;
    case "revenue-route":
      return `route-${row.dep_airport}-${row.arr_airport}`;
    case "revenue-class":
      return `class-${row.class_name}`;
    default:
      return JSON.stringify(row);
  }
}

export default function ReportRowDetail({
  reportKey,
  row,
  onClose
}: {
  reportKey: ReportKey;
  row: Record<string, unknown>;
  onClose: () => void;
}) {
  const entries = Object.entries(row);
  const loadFactor = Number(row.load_factor_percent ?? 0);
  const revenueShare = Number(row.revenue_percentage ?? 0);

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">{REPORT_TITLES[reportKey]}</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-900">{detailHeadline(reportKey, row)}</h2>
          <p className="mt-1 text-sm text-zinc-500">{summaryText(reportKey, row)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          <X className="size-4" />
          Close
        </button>
      </div>

      {reportKey === "load-factor" && Number.isFinite(loadFactor) ? (
        <div className="mb-5 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>Seat utilization</span>
            <span>{loadFactor.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                loadFactor >= 75 ? "bg-emerald-500" : loadFactor >= 50 ? "bg-brand" : "bg-amber-500"
              )}
              style={{ width: `${Math.min(100, loadFactor)}%` }}
            />
          </div>
        </div>
      ) : null}

      {reportKey === "revenue-class" && Number.isFinite(revenueShare) ? (
        <div className="mb-5 rounded-xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-600">
            <span>Share of total revenue</span>
            <span>{revenueShare.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.min(100, revenueShare)}%` }} />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{formatLabel(key)}</p>
            <p className="mt-1.5 text-sm font-semibold tabular-nums text-zinc-900">{formatValue(key, value)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
