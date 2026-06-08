"use client";

import { Search, X } from "lucide-react";
import { masterInputClass } from "@/app/components/dashboard/master/MasterFormField";
import type { AirlineRow, AirportRow, ScheduleRow } from "@/app/components/dashboard/master/useMasterLists";
import { cn } from "@/lib/cn";

export type ScheduleBrowseFilters = {
  query: string;
  depAirport: string;
  arrAirport: string;
  airlineId: string;
};

export const EMPTY_SCHEDULE_BROWSE_FILTERS: ScheduleBrowseFilters = {
  query: "",
  depAirport: "",
  arrAirport: "",
  airlineId: ""
};

function hasActiveFilters(filters: ScheduleBrowseFilters) {
  return Boolean(filters.query.trim() || filters.depAirport || filters.arrAirport || filters.airlineId);
}

function matchesQuery(values: Array<string | number | null | undefined>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return values.some((value) => String(value ?? "").toLowerCase().includes(q));
}

export function filterScheduleLegRow(row: ScheduleRow, filters: ScheduleBrowseFilters, operatingDaysLabel: string) {
  if (filters.depAirport && row.dep_airport !== filters.depAirport) return false;
  if (filters.arrAirport && row.arr_airport !== filters.arrAirport) return false;
  if (filters.airlineId && row.airline_id !== filters.airlineId) return false;

  return matchesQuery(
    [
      row.schedule_id,
      row.flight_number,
      row.dep_airport,
      row.arr_airport,
      row.airline_id,
      row.airline_name,
      operatingDaysLabel,
      String(row.valid_from).slice(0, 10),
      String(row.valid_to).slice(0, 10),
      String(row.dep_time).slice(0, 5),
      String(row.arr_time).slice(0, 5),
      `${row.dep_airport} → ${row.arr_airport}`,
      row.generated_flight_count
    ],
    filters.query
  );
}

export type ConnectingItineraryBrowseRow = {
  itinerary_id: number;
  departure_airport_code: string;
  arrival_airport_code: string;
  route_label: string | null;
  leg_summary: string | null;
  schedule_leg_count: number;
  generated_leg_count: number;
  operating_days?: unknown;
};

export function filterConnectingItineraryRow(
  row: ConnectingItineraryBrowseRow,
  filters: ScheduleBrowseFilters,
  operatingDaysLabel: string
) {
  if (filters.depAirport && row.departure_airport_code !== filters.depAirport) return false;
  if (filters.arrAirport && row.arrival_airport_code !== filters.arrAirport) return false;
  if (filters.airlineId && !(row.leg_summary ?? "").includes(filters.airlineId)) return false;

  return matchesQuery(
    [
      row.itinerary_id,
      row.route_label,
      row.leg_summary,
      row.departure_airport_code,
      row.arrival_airport_code,
      operatingDaysLabel,
      row.schedule_leg_count,
      row.generated_leg_count,
      `${row.departure_airport_code} → ${row.arrival_airport_code}`
    ],
    filters.query
  );
}

type ScheduleBrowseFiltersProps = {
  airports: AirportRow[];
  airlines: AirlineRow[];
  filters: ScheduleBrowseFilters;
  onChange: (patch: Partial<ScheduleBrowseFilters>) => void;
  onClear: () => void;
  itineraryCount: number;
  itineraryTotal: number;
  legCount: number;
  legTotal: number;
};

export function ScheduleBrowseFiltersBar({
  airports,
  airlines,
  filters,
  onChange,
  onClear,
  itineraryCount,
  itineraryTotal,
  legCount,
  legTotal
}: ScheduleBrowseFiltersProps) {
  const active = hasActiveFilters(filters);

  return (
    <div className={formCardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Search saved schedules</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Filter connecting itineraries and schedule legs by route, airline, flight number, or ID.
          </p>
        </div>
        {active ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="size-3.5" />
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block sm:col-span-2 xl:col-span-4">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Flight number, schedule ID, route label, airport code…"
            className={cn(masterInputClass, "pl-10")}
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Departure</span>
          <select
            value={filters.depAirport}
            onChange={(e) => onChange({ depAirport: e.target.value })}
            className={masterInputClass}
          >
            <option value="">Any departure</option>
            {airports.map((airport) => (
              <option key={airport.airport_code} value={airport.airport_code}>
                {airport.airport_code} · {airport.city}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Arrival</span>
          <select
            value={filters.arrAirport}
            onChange={(e) => onChange({ arrAirport: e.target.value })}
            className={masterInputClass}
          >
            <option value="">Any arrival</option>
            {airports.map((airport) => (
              <option key={airport.airport_code} value={airport.airport_code}>
                {airport.airport_code} · {airport.city}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm sm:col-span-2 xl:col-span-2">
          <span className="mb-1 block text-xs font-medium text-zinc-600">Airline</span>
          <select
            value={filters.airlineId}
            onChange={(e) => onChange({ airlineId: e.target.value })}
            className={masterInputClass}
          >
            <option value="">Any airline</option>
            {airlines.map((airline) => (
              <option key={airline.airline_id} value={airline.airline_id}>
                {airline.airline_id} · {airline.airline_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-zinc-500">
        {active ? (
          <>
            Showing <span className="font-medium text-zinc-700">{itineraryCount}</span> of {itineraryTotal} itineraries
            {" · "}
            <span className="font-medium text-zinc-700">{legCount}</span> of {legTotal} schedule legs
          </>
        ) : (
          <>
            {itineraryTotal} itineraries · {legTotal} schedule legs
          </>
        )}
      </p>
    </div>
  );
}

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";
