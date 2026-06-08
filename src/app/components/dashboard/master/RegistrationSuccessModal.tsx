"use client";

import { useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type DirectRegistrationDetail = {
  kind: "direct";
  schedule_id: string;
  airline_id: string;
  airline_name: string;
  aircraft_label: string;
  flight_number: string;
  dep_airport: string;
  arr_airport: string;
  dep_time: string;
  arr_time: string;
  valid_from: string;
  valid_to: string;
};

export type ConnectingLegDetail = {
  leg_index: number;
  schedule_id: number;
  airline_id: string;
  airline_name: string;
  flight_number: string;
  dep_airport: string;
  arr_airport: string;
  dep_time: string;
  arr_time: string;
};

export type ConnectingRegistrationDetail = {
  kind: "connecting";
  itinerary_id: number;
  route_label: string;
  departure_airport_code: string;
  arrival_airport_code: string;
  valid_from: string;
  valid_to: string;
  operating_days: string[];
  legs: ConnectingLegDetail[];
};

export type GeneratedFlightsDetail = {
  kind: "generated";
  itinerary_id: number;
  route_label: string;
  start_date: string;
  end_date: string;
  generated_flights: number;
  legs: ConnectingLegDetail[];
};

export type RegistrationSuccessDetail =
  | DirectRegistrationDetail
  | ConnectingRegistrationDetail
  | GeneratedFlightsDetail;

type RegistrationSuccessModalProps = {
  detail: RegistrationSuccessDetail | null;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="text-sm font-medium text-zinc-900 sm:text-right">{value}</dd>
    </div>
  );
}

function titleForDetail(detail: RegistrationSuccessDetail) {
  if (detail.kind === "direct") return "Direct schedule registered";
  if (detail.kind === "connecting") return "Connecting route registered";
  return "Connecting flights generated";
}

function subtitleForDetail(detail: RegistrationSuccessDetail) {
  if (detail.kind === "direct") return "The recurring leg was saved to flight_schedules.";
  if (detail.kind === "connecting") return "Itinerary and schedule legs were saved successfully.";
  return "Dated flights were created for the selected date range.";
}

export function RegistrationSuccessModal({ detail, onClose }: RegistrationSuccessModalProps) {
  useEffect(() => {
    if (!detail) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detail, onClose]);

  if (!detail) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="registration-success-title"
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xl"
      >
        <div className="border-b border-emerald-100 bg-emerald-50/80 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
              <div>
                <h2 id="registration-success-title" className="text-lg font-semibold text-zinc-900">
                  {titleForDetail(detail)}
                </h2>
                <p className="mt-1 text-sm text-zinc-600">{subtitleForDetail(detail)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-500 transition hover:bg-white hover:text-zinc-800"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto px-5 py-4">
          {detail.kind === "direct" ? (
            <dl className="space-y-3">
              <DetailRow label="Schedule ID" value={`#${detail.schedule_id}`} />
              <DetailRow label="Flight" value={detail.flight_number} />
              <DetailRow label="Airline" value={`${detail.airline_id} · ${detail.airline_name}`} />
              <DetailRow label="Aircraft" value={detail.aircraft_label} />
              <DetailRow label="Route" value={`${detail.dep_airport} → ${detail.arr_airport}`} />
              <DetailRow label="Times" value={`${detail.dep_time} – ${detail.arr_time}`} />
              <DetailRow label="Valid period" value={`${detail.valid_from} → ${detail.valid_to}`} />
            </dl>
          ) : null}

          {detail.kind === "connecting" ? (
            <div className="space-y-4">
              <dl className="space-y-3">
                <DetailRow label="Itinerary ID" value={`#${detail.itinerary_id}`} />
                <DetailRow label="Route" value={detail.route_label} />
                <DetailRow
                  label="Endpoints"
                  value={`${detail.departure_airport_code} → ${detail.arrival_airport_code}`}
                />
                <DetailRow label="Valid period" value={`${detail.valid_from} → ${detail.valid_to}`} />
                <DetailRow label="Operating days" value={detail.operating_days.join(", ")} />
                <DetailRow label="Legs saved" value={`${detail.legs.length}`} />
              </dl>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Leg details</p>
                {detail.legs.map((leg) => (
                  <div key={leg.schedule_id} className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-sm">
                    <p className="font-semibold text-zinc-900">
                      Leg {leg.leg_index} · {leg.flight_number}
                    </p>
                    <p className="mt-1 text-zinc-700">
                      {leg.dep_airport} → {leg.arr_airport} · {leg.dep_time} – {leg.arr_time}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Schedule #{leg.schedule_id} · {leg.airline_id} · {leg.airline_name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {detail.kind === "generated" ? (
            <div className="space-y-4">
              <dl className="space-y-3">
                <DetailRow label="Itinerary ID" value={`#${detail.itinerary_id}`} />
                <DetailRow label="Route" value={detail.route_label} />
                <DetailRow label="Date range" value={`${detail.start_date} → ${detail.end_date}`} />
                <DetailRow label="Flights created" value={`${detail.generated_flights}`} />
              </dl>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Legs per operating day</p>
                {detail.legs.map((leg) => (
                  <div key={leg.schedule_id} className="rounded-xl border border-cerulean-100 bg-cerulean-50/50 px-3 py-2.5 text-sm">
                    <p className="font-semibold text-zinc-900">
                      Leg {leg.leg_index} · {leg.flight_number}
                    </p>
                    <p className="mt-1 text-zinc-700">
                      {leg.dep_airport} → {leg.arr_airport} · Schedule #{leg.schedule_id}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className={cn("w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90")}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
