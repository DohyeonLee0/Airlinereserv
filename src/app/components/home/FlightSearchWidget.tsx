"use client";

import { FormEvent } from "react";
import { ArrowLeftRight, Tag } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { cn } from "@/lib/cn";
import type { JourneyType } from "@/lib/flightSearch";

type SeatClass = "" | "Economy" | "Business" | "First";

export type FlightSearchForm = {
  dep_airport: string;
  arr_airport: string;
  flight_date: string;
  return_date: string;
  journey_type: JourneyType;
  class_name: SeatClass;
  max_price: string;
  apply_promotions: boolean;
};

type FlightSearchWidgetProps = {
  form: FlightSearchForm;
  loading: boolean;
  onFormChange: (patch: Partial<FlightSearchForm>) => void;
  onSubmit: (event: FormEvent) => void;
  onSwapAirports: () => void;
};

export default function FlightSearchWidget({
  form,
  loading,
  onFormChange,
  onSubmit,
  onSwapAirports
}: FlightSearchWidgetProps) {
  const isRoundTrip = form.journey_type === "round_trip";

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Search flights</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        {(
          [
            ["one_way", "One-way"],
            ["round_trip", "Round-trip"]
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onFormChange({ journey_type: key })}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              form.journey_type === key
                ? "bg-deep-space-blue text-white shadow-sm"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-5">
        <div className="grid gap-4 rounded-xl bg-zinc-50/80 p-4 lg:grid-cols-[1fr_auto_1fr] lg:items-end">
          <label className="block text-sm font-medium text-zinc-700">
            From
            <input
              value={form.dep_airport}
              onChange={(e) => onFormChange({ dep_airport: e.target.value.toUpperCase() })}
              placeholder="ICN"
              required
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
              required
              className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xl font-bold tracking-wide text-zinc-900 outline-none focus:border-cerulean-500 focus:ring-2 focus:ring-cerulean-500/20"
            />
          </label>
        </div>

        <div
          className={cn(
            "mt-4 grid gap-4",
            isRoundTrip ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4"
          )}
        >
          <label className="block text-sm font-medium text-zinc-700">
            Departure date
            <input
              type="date"
              lang="en-US"
              value={form.flight_date}
              onChange={(e) => onFormChange({ flight_date: e.target.value })}
              required
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
            />
          </label>

          {isRoundTrip ? (
            <label className="block text-sm font-medium text-zinc-700">
              Return date
              <input
                type="date"
                lang="en-US"
                value={form.return_date}
                min={form.flight_date}
                onChange={(e) => onFormChange({ return_date: e.target.value })}
                required
                className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
              />
            </label>
          ) : null}

          <label className="block text-sm font-medium text-zinc-700">
            Cabin (optional)
            <select
              value={form.class_name}
              onChange={(e) => onFormChange({ class_name: e.target.value as SeatClass })}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
            >
              <option value="">Any class</option>
              <option value="Economy">Economy</option>
              <option value="Business">Business</option>
              <option value="First">First</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-zinc-700">
            Max price (optional)
            <input
              type="number"
              min={0}
              value={form.max_price}
              onChange={(e) => onFormChange({ max_price: e.target.value })}
              placeholder="No limit"
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              aria-pressed={form.apply_promotions}
              onClick={() => onFormChange({ apply_promotions: !form.apply_promotions })}
              className={cn(
                "inline-flex h-[42px] w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition sm:w-auto",
                form.apply_promotions
                  ? "bg-deep-space-blue text-white shadow-sm"
                  : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              )}
            >
              <Tag className="size-3.5" strokeWidth={1.75} />
              Promotions
            </button>
          </div>
        </div>

        <Button type="submit" disabled={loading} size="lg" className="mt-4 w-full sm:w-auto">
          {loading ? "Searching…" : "Search flights"}
        </Button>
      </form>
    </div>
  );
}
