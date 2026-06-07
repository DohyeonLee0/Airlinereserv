"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { ledgerSummary, type Ledger } from "@/app/components/seats/types";

type BookingSuccessBannerProps = {
  bookingId: string;
  seatLabel: string;
  onDismiss: () => void;
  viewBookingsLabel: string;
};

export function BookingSuccessBanner({ bookingId, seatLabel, onDismiss, viewBookingsLabel }: BookingSuccessBannerProps) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <CheckCircle2 className="size-5" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Booking confirmed</p>
          <h2 className="mt-1 text-lg font-semibold text-emerald-950">Your reservation is complete!</h2>
          <p className="mt-2 text-sm text-emerald-900">
            Booking <span className="font-semibold">#{bookingId}</span> · Seat{" "}
            <span className="font-semibold">{seatLabel}</span>
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/bookings">
              <Button size="sm">{viewBookingsLabel}</Button>
            </Link>
            <Button size="sm" variant="outline" onClick={onDismiss} className="border-emerald-300 bg-white text-emerald-900">
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

type LedgerPanelProps = {
  ledger: Ledger | null;
  emptyLabel: string;
};

export default function LedgerPanel({ ledger, emptyLabel }: LedgerPanelProps) {
  const summary = ledger ? ledgerSummary(ledger.rows) : null;

  return (
    <section className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-cerulean-700">Payment ledger</p>
      {!ledger || !summary ? (
        <p className="mt-3 text-sm text-zinc-500">{emptyLabel}</p>
      ) : (
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-xl bg-zinc-50 p-3">
            <p className="font-semibold text-zinc-900">Booking #{summary.booking_id}</p>
            <p className="mt-1 text-zinc-500">
              {summary.status}
              {summary.trip_type ? ` · ${summary.trip_type}` : ""}
            </p>
            {summary.route ? <p className="mt-1 font-medium text-zinc-700">{summary.route}</p> : null}
          </div>

          <div className="space-y-2">
            {ledger.rows.map((row) => (
              <div
                key={`${row.flight_id ?? "f"}-${row.seat_number ?? "s"}`}
                className="rounded-lg border border-zinc-100 px-3 py-2 text-zinc-600"
              >
                Seat <span className="font-medium text-zinc-900">{row.seat_number ?? "—"}</span>
                {row.ticket_id != null ? (
                  <>
                    {" "}
                    · Ticket <span className="font-medium text-zinc-900">#{row.ticket_id}</span>
                  </>
                ) : null}
                {row.flight_id != null ? <span className="text-zinc-400"> · Flight {row.flight_id}</span> : null}
              </div>
            ))}
          </div>

          {summary.payment_id != null ? (
            <p className="text-zinc-600">
              Payment <span className="font-medium text-zinc-900">#{summary.payment_id}</span>
              {summary.payment_method ? ` · ${summary.payment_method}` : ""}
              {summary.payment_status ? ` · ${summary.payment_status}` : ""}
            </p>
          ) : null}

          <p className="text-xl font-bold tabular-nums text-zinc-900">
            ${Number(summary.amount ?? 0).toLocaleString("en-US")}
          </p>

          {ledger.refunds.map((refund) => (
            <div key={refund.refund_id} className="rounded-xl border border-red-100 bg-red-50 p-3 text-red-700">
              Refund #{refund.refund_id} · ${Number(refund.refund_amount).toLocaleString("en-US")}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
