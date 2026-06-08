"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatDate } from "@/lib/formatDate";

export type TrackerView = "legs" | "itineraries" | "flights";

type ScheduleDetail = {
  schedule: Record<string, unknown>;
  operating_days: string[];
  linked_itineraries: Array<Record<string, unknown>>;
  generated_flights: Array<Record<string, unknown>>;
};

const VIEW_TITLES: Record<TrackerView, string> = {
  legs: "Schedule Leg Detail",
  itineraries: "Itinerary Detail",
  flights: "Dated Flight Detail"
};

const FIELD_LABELS: Record<string, string> = {
  schedule_id: "Schedule ID",
  flight_number: "Flight number",
  airline_id: "Airline",
  airline_name: "Airline name",
  dep_airport: "Departure",
  arr_airport: "Arrival",
  route: "Route",
  dep_time: "Departure time",
  arr_time: "Arrival time",
  dep_time_fmt: "Departure time",
  arr_time_fmt: "Arrival time",
  valid_from: "Valid from",
  valid_to: "Valid to",
  operating_days: "Operating days",
  linked_itineraries: "Linked itineraries",
  generated_flights: "Generated flights",
  first_flight_date: "First flight date",
  last_flight_date: "Last flight date",
  itinerary_id: "Itinerary ID",
  trip_type: "Trip type",
  departure_airport_code: "Origin",
  arrival_airport_code: "Destination",
  endpoints: "Endpoints",
  route_label: "Route label",
  leg_summary: "Leg summary",
  schedule_legs: "Schedule legs",
  created_at: "Created at",
  flight_id: "Flight ID",
  flight_date: "Flight date",
  segment_order: "Segment",
  leg_type: "Leg type",
  status: "Status",
  aircraft_id: "Aircraft ID",
  aircraft_model: "Aircraft",
  available_seats: "Available seats",
  total_seats: "Total seats",
  leg_index: "Leg index"
};

function formatLabel(key: string) {
  return FIELD_LABELS[key] ?? key.replace(/_/g, " ");
}

function formatValue(key: string, value: unknown) {
  if (value == null || value === "") return "—";
  if (key.includes("date") || key === "created_at") {
    const raw = String(value);
    return raw.length > 10 ? formatDate(raw) : formatDate(raw.slice(0, 10));
  }
  return String(value);
}

function DetailGrid({ row, exclude = new Set<string>() }: { row: Record<string, unknown>; exclude?: Set<string> }) {
  const entries = Object.entries(row).filter(([key]) => !exclude.has(key));
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2.5">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{formatLabel(key)}</dt>
          <dd className="mt-1 text-sm font-medium text-zinc-900">{formatValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

type Props = {
  view: TrackerView;
  row: Record<string, unknown> | null;
  rowKey: string | null;
  onClose: () => void;
};

export default function ScheduleTrackerDetail({ view, row, rowKey, onClose }: Props) {
  const [scheduleDetail, setScheduleDetail] = useState<ScheduleDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    if (!row || view !== "legs") {
      setScheduleDetail(null);
      return undefined;
    }

    const scheduleId = Number(row.schedule_id);
    if (!Number.isFinite(scheduleId)) return undefined;

    let cancelled = false;
    setLoadingDetail(true);
    fetch(`/api/staff/schedules/tracker/${scheduleId}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled && json.success) {
          setScheduleDetail(json.data as ScheduleDetail);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetail(false);
      });

    return () => {
      cancelled = true;
    };
  }, [row, view, rowKey]);

  if (!row || !rowKey) return null;

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">{VIEW_TITLES[view]}</h2>
          <p className="mt-1 text-sm text-zinc-500">Read-only snapshot from the database.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-800"
          aria-label="Close detail"
        >
          <X className="size-5" />
        </button>
      </div>

      {view === "legs" ? (
        <div className="space-y-5">
          {loadingDetail ? (
            <div className="h-32 animate-pulse rounded-xl bg-zinc-100" />
          ) : scheduleDetail ? (
            <>
              <DetailGrid
                row={{
                  schedule_id: scheduleDetail.schedule.schedule_id,
                  flight_number: scheduleDetail.schedule.flight_number,
                  airline_id: scheduleDetail.schedule.airline_id,
                  airline_name: scheduleDetail.schedule.airline_name,
                  route: `${scheduleDetail.schedule.dep_airport} → ${scheduleDetail.schedule.arr_airport}`,
                  dep_time: scheduleDetail.schedule.dep_time_fmt,
                  arr_time: scheduleDetail.schedule.arr_time_fmt,
                  valid_from: scheduleDetail.schedule.valid_from,
                  valid_to: scheduleDetail.schedule.valid_to,
                  operating_days: scheduleDetail.operating_days.join(", ") || "—"
                }}
              />

              {scheduleDetail.linked_itineraries.length ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Linked itineraries</h3>
                  <div className="space-y-2">
                    {scheduleDetail.linked_itineraries.map((item) => (
                      <div key={`${item.itinerary_id}-${item.leg_index}`} className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2.5 text-sm">
                        <p className="font-semibold text-zinc-900">
                          Itinerary #{String(item.itinerary_id)} · {String(item.trip_type)} · leg {String(item.leg_index)}
                        </p>
                        <p className="mt-1 text-zinc-700">
                          {String(item.departure_airport_code)} → {String(item.arrival_airport_code)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {scheduleDetail.generated_flights.length ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Recent generated flights</h3>
                  <div className="overflow-auto rounded-xl border border-zinc-100">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-zinc-50 text-left text-zinc-600">
                          {["flight_id", "flight_date", "itinerary_id", "segment_order", "status", "aircraft_model"].map((col) => (
                            <th key={col} className="border border-zinc-200 px-3 py-2 font-semibold">
                              {formatLabel(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleDetail.generated_flights.map((flight) => (
                          <tr key={String(flight.flight_id)} className="text-zinc-800">
                            {["flight_id", "flight_date", "itinerary_id", "segment_order", "status", "aircraft_model"].map((col) => (
                              <td key={col} className="border border-zinc-100 px-3 py-2">
                                {formatValue(col, flight[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-500">No dated flights generated for this schedule yet.</p>
              )}
            </>
          ) : (
            <DetailGrid row={row} />
          )}
        </div>
      ) : (
        <DetailGrid row={row} />
      )}
    </section>
  );
}

export function trackerRowKey(view: TrackerView, row: Record<string, unknown>) {
  if (view === "legs") return `leg-${String(row.schedule_id ?? "")}`;
  if (view === "itineraries") return `itinerary-${String(row.itinerary_id ?? "")}`;
  return `flight-${String(row.flight_id ?? "")}`;
}
