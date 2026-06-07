"use client";

import { FormEvent } from "react";
import { ArrowLeftRight, Sparkles, Tag } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { cn } from "@/lib/cn";

type SearchTab = "basic" | "promotions" | "recommend";
type SeatClass = "Economy" | "Business" | "First";

export type FlightSearchForm = {
  dep_airport: string;
  arr_airport: string;
  flight_date: string;
  class_name: SeatClass;
  max_price: string;
  promo_code: string;
};

type FlightSearchWidgetProps = {
  tab: SearchTab;
  form: FlightSearchForm;
  loading: boolean;
  quickPromos: readonly string[];
  onTabChange: (tab: SearchTab) => void;
  onFormChange: (patch: Partial<FlightSearchForm>) => void;
  onSubmit: (event: FormEvent) => void;
  onSwapAirports: () => void;
  onApplyPromo: (code: string) => void;
};

export default function FlightSearchWidget({
  tab,
  form,
  loading,
  quickPromos,
  onTabChange,
  onFormChange,
  onSubmit,
  onSwapAirports,
  onApplyPromo
}: FlightSearchWidgetProps) {
  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:p-6">
      <div className="mb-5 flex flex-wrap gap-2">
        {(
          [
            ["basic", "Flights", null],
            ["promotions", "Deals", Tag],
            ["recommend", "Smart picks", Sparkles]
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
              tab === key ? "bg-deep-space-blue text-white shadow-sm" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
          >
            {Icon ? <Icon className="size-3.5" strokeWidth={1.75} /> : null}
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit}>
        <div className="grid gap-4 rounded-xl bg-zinc-50/80 p-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
          <label className="block text-sm font-medium text-zinc-700">
            From
            <input
              value={form.dep_airport}
              onChange={(e) => onFormChange({ dep_airport: e.target.value.toUpperCase() })}
              placeholder="ICN"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold tracking-wide text-zinc-900 outline-none focus:border-cerulean-500 focus:ring-2 focus:ring-cerulean-500/20"
            />
          </label>

          <button
            type="button"
            onClick={onSwapAirports}
            aria-label="Swap airports"
            className="mx-auto flex size-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900 lg:mb-0.5"
          >
            <ArrowLeftRight className="size-4" strokeWidth={1.75} />
          </button>

          <label className="block text-sm font-medium text-zinc-700">
            To
            <input
              value={form.arr_airport}
              onChange={(e) => onFormChange({ arr_airport: e.target.value.toUpperCase() })}
              placeholder="JFK"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold tracking-wide text-zinc-900 outline-none focus:border-cerulean-500 focus:ring-2 focus:ring-cerulean-500/20"
            />
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-medium text-zinc-700">
            Depart
            <input
              type="date"
              lang="en-US"
              value={form.flight_date}
              onChange={(e) => onFormChange({ flight_date: e.target.value })}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
            />
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Cabin
            <select
              value={form.class_name}
              onChange={(e) => onFormChange({ class_name: e.target.value as SeatClass })}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
            >
              <option value="Economy">Economy</option>
              <option value="Business">Business</option>
              <option value="First">First</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-zinc-700">
            Max price (optional)
            <input
              type="number"
              value={form.max_price}
              onChange={(e) => onFormChange({ max_price: e.target.value })}
              placeholder="No limit"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
            />
          </label>
          {tab === "promotions" ? (
            <label className="block text-sm font-medium text-zinc-700">
              Promo code
              <input
                value={form.promo_code}
                onChange={(e) => onFormChange({ promo_code: e.target.value.toUpperCase() })}
                placeholder="SUMMER10"
                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
              />
            </label>
          ) : (
            <div className="flex items-end">
              <Button type="submit" disabled={loading} size="lg" className="w-full">
                {loading ? "Searching…" : "Search flights"}
              </Button>
            </div>
          )}
        </div>

        {tab === "promotions" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Try:</span>
            {quickPromos.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => onApplyPromo(code)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100"
              >
                {code}
              </button>
            ))}
          </div>
        )}

        {tab === "promotions" && (
          <Button type="submit" disabled={loading} size="lg" className="mt-4 w-full sm:w-auto">
            {loading ? "Searching…" : "Search deals"}
          </Button>
        )}
      </form>
    </div>
  );
}
