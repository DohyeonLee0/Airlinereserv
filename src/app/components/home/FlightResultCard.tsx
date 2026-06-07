import Link from "next/link";
import { Plane, Tag } from "lucide-react";
import { cn } from "@/lib/cn";

type RouteRow = {
  route_type?: "DIRECT" | "ONE_STOP";
  flight_id?: number;
  first_flight_id?: number;
  first_flight_number?: string;
  second_flight_id?: number | null;
  flight_number?: string;
  second_flight_number?: string | null;
  dep_airport: string;
  arr_airport: string;
  connection_airport?: string | null;
  available_seats: number;
  lowest_available_price?: number;
  lowest_price?: number;
  total_lowest_price?: number;
  original_lowest_price?: number;
  final_lowest_price?: number;
  discount_percent?: number;
  applied_promo_code?: string;
  promo_description?: string;
  recommendation_score?: number;
};

function priceOf(row: RouteRow) {
  return row.final_lowest_price ?? row.total_lowest_price ?? row.lowest_price ?? row.lowest_available_price ?? 0;
}

function routeLabel(row: RouteRow) {
  return `${row.dep_airport} → ${row.connection_airport ? `${row.connection_airport} → ` : ""}${row.arr_airport}`;
}

function seatHref(row: RouteRow) {
  const first = row.first_flight_id ?? row.flight_id;
  if (row.route_type === "ONE_STOP" && first && row.second_flight_id) {
    return `/seats?flight_ids=${first},${row.second_flight_id}`;
  }
  return `/seats?flight_id=${first ?? ""}`;
}

export default function FlightResultCard({ row, index }: { row: RouteRow; index: number }) {
  const isDeal = Boolean(row.applied_promo_code || row.discount_percent);
  const isDirect = row.route_type !== "ONE_STOP";

  return (
    <article
      className={cn(
        "group rounded-2xl border bg-white p-6 transition-all duration-200 hover:border-zinc-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]",
        isDeal ? "border-emerald-200/80" : "border-zinc-100"
      )}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                isDeal ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"
              )}
            >
              {row.applied_promo_code ? (
                <>
                  <Tag className="size-3" strokeWidth={1.75} />
                  {row.applied_promo_code}
                </>
              ) : isDirect ? (
                "Direct"
              ) : (
                "1 stop"
              )}
            </span>
            {index === 0 ? (
              <span className="rounded-full bg-deep-space-blue px-2.5 py-1 text-xs font-semibold text-white">Best match</span>
            ) : null}
          </div>

          <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">{routeLabel(row)}</h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">
            <Plane className="size-3.5 shrink-0" strokeWidth={1.75} />
            {row.first_flight_number ?? row.flight_number}
            {row.second_flight_number ? ` · ${row.second_flight_number}` : ""}
          </p>
          {row.promo_description ? <p className="mt-2 text-[15px] text-emerald-700">{row.promo_description}</p> : null}
          {row.recommendation_score !== undefined ? (
            <p className="mt-2 text-xs font-semibold text-cerulean-700">Smart score · {row.recommendation_score}</p>
          ) : null}
          <p className="mt-2 text-xs text-zinc-400">{row.available_seats} seats remaining</p>
        </div>

        <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">
          <div className="text-right">
            {row.original_lowest_price && row.final_lowest_price ? (
              <p className="text-xs text-zinc-400 line-through">${Number(row.original_lowest_price).toLocaleString("en-US")}</p>
            ) : null}
            <p className="text-3xl font-bold tabular-nums text-zinc-900">${priceOf(row).toLocaleString("en-US")}</p>
            {row.discount_percent ? (
              <p className="text-xs font-semibold text-emerald-700">Save {row.discount_percent}%</p>
            ) : null}
          </div>
          <Link
            className="inline-flex h-11 items-center justify-center rounded-xl bg-deep-space-blue px-5 text-sm font-medium text-white shadow-sm transition hover:bg-yale-blue-2-500"
            href={seatHref(row)}
          >
            Choose seats
          </Link>
        </div>
      </div>
    </article>
  );
}

export type { RouteRow };
export { priceOf, routeLabel, seatHref };
