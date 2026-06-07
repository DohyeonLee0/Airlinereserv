"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, X } from "lucide-react";
import ReportDataTable from "@/app/components/dashboard/ReportDataTable";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/cn";

type BookingSummary = Record<string, unknown>;

type BookingLeg = Record<string, unknown>;

type TimelineEvent = {
  event_type: string;
  event_time: string;
  description: string;
  detail_status: string;
};

type BookingDetail = {
  summary: BookingSummary;
  legs: BookingLeg[];
  timeline: TimelineEvent[];
};

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return "—";
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function eventBadgeClass(eventType: string) {
  switch (eventType) {
    case "BOOKING_CREATED":
      return "bg-sky-100 text-sky-800";
    case "PAYMENT":
      return "bg-emerald-100 text-emerald-800";
    case "TICKET_ISSUED":
      return "bg-violet-100 text-violet-800";
    case "REFUND":
      return "bg-amber-100 text-amber-800";
    case "BOOKING_CANCELLED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

export default function BookingsAdminPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailMessage, setDetailMessage] = useState("");

  const tableRows = useMemo(
    () =>
      rows.map((row) => ({
        booking_id: row.booking_id,
        customer: row.customer_name,
        email: row.customer_email,
        user_id: row.user_id,
        route: `${row.departure_airport_code} → ${row.arrival_airport_code}`,
        trip_type: row.trip_type,
        booked_at: formatDateTime(row.booking_time),
        status: row.status,
        amount: formatMoney(row.amount),
        payment: row.payment_method ? `${row.payment_method} (${row.payment_status})` : "—",
        refund: Number(row.refund_amount ?? 0) > 0 ? formatMoney(row.refund_amount) : "—",
        legs: row.leg_count,
        flights: row.flights_summary ?? "—"
      })),
    [rows]
  );

  async function loadBookings() {
    setLoading(true);
    const response = await fetch("/api/staff/bookings");
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.message ?? "Failed to load bookings");
      setRows([]);
    } else {
      setMessage("");
      setRows(json.data?.bookings ?? []);
    }
    setLoading(false);
  }

  const loadDetail = useCallback(async (bookingId: number) => {
    setDetailLoading(true);
    setDetailMessage("");
    const response = await fetch(`/api/staff/bookings/detail?booking_id=${bookingId}`);
    const json = await response.json();
    if (!response.ok) {
      setDetail(null);
      setDetailMessage(json.message ?? "Failed to load booking details");
    } else {
      setDetail(json.data as BookingDetail);
    }
    setDetailLoading(false);
  }, []);

  useEffect(() => {
    void loadBookings();
  }, []);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  function handleRowClick(row: Record<string, unknown>) {
    const id = Number(row.booking_id);
    if (!Number.isFinite(id)) return;
    setSelectedId(id);
  }

  return (
    <div className="space-y-8">
      <PageTitle
        icon={ClipboardList}
        title="All Bookings"
        description="View every reservation — customer, payment, cancellation, refunds, and full activity logs."
        accent="emerald"
      />

      {message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
      )}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-zinc-500">Click a row to open the booking log and flight legs.</p>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 w-full max-w-sm rounded-xl bg-zinc-200" />
            <div className="h-64 rounded-xl bg-zinc-100" />
          </div>
        ) : (
          <ReportDataTable
            rows={tableRows}
            onRowClick={handleRowClick}
            selectedRowKey={selectedId}
            emptyMessage="No bookings found."
          />
        )}
      </section>

      {selectedId != null && (
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Booking #{selectedId} — Activity Log</h2>
              <p className="mt-1 text-sm text-zinc-500">Payment history, tickets issued, refunds, and cancellations.</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              <X className="size-4" />
              Close
            </button>
          </div>

          {detailLoading ? (
            <div className="space-y-3 animate-pulse">
              <div className="h-24 rounded-xl bg-zinc-100" />
              <div className="h-40 rounded-xl bg-zinc-100" />
            </div>
          ) : detailMessage ? (
            <p className="text-sm text-red-600">{detailMessage}</p>
          ) : detail ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Customer</p>
                  <p className="mt-1 font-medium text-zinc-900">{String(detail.summary.customer_name ?? "—")}</p>
                  <p className="text-sm text-zinc-600">{String(detail.summary.customer_email ?? "")}</p>
                  <p className="text-xs text-zinc-500">{String(detail.summary.user_id ?? "")}</p>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Itinerary</p>
                  <p className="mt-1 font-medium text-zinc-900">
                    {String(detail.summary.departure_airport_code)} → {String(detail.summary.arrival_airport_code)}
                  </p>
                  <p className="text-sm text-zinc-600">{String(detail.summary.trip_type)}</p>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Payment</p>
                  <p className="mt-1 font-medium text-zinc-900">{formatMoney(detail.summary.amount)}</p>
                  <p className="text-sm text-zinc-600">
                    {String(detail.summary.payment_method ?? "—")} · {String(detail.summary.payment_status ?? "—")}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</p>
                  <p
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold",
                      detail.summary.status === "Cancelled" ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                    )}
                  >
                    {String(detail.summary.status)}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">Booked {formatDateTime(detail.summary.booking_time)}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">Activity timeline</h3>
                <ol className="space-y-3">
                  {(detail.timeline ?? []).map((event, index) => (
                    <li key={`${event.event_type}-${index}`} className="flex gap-3 rounded-xl border border-zinc-100 p-3">
                      <span
                        className={cn(
                          "shrink-0 self-start rounded-md px-2 py-0.5 text-xs font-semibold",
                          eventBadgeClass(event.event_type)
                        )}
                      >
                        {event.event_type.replace(/_/g, " ")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-zinc-800">{event.description}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{formatDateTime(event.event_time)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-900">Flight legs & tickets</h3>
                <div className="overflow-auto rounded-xl border border-zinc-100">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 text-left text-zinc-600">
                        {[
                          "Flight",
                          "Date",
                          "Route",
                          "Seat",
                          "Class",
                          "Airline",
                          "Ticket",
                          "Refund"
                        ].map((header) => (
                          <th key={header} className="border border-zinc-200 px-3 py-2 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.legs.map((leg, index) => (
                        <tr key={`${leg.flight_id}-${index}`} className="hover:bg-zinc-50">
                          <td className="border border-zinc-200 px-3 py-2">{String(leg.flight_number ?? leg.flight_id)}</td>
                          <td className="border border-zinc-200 px-3 py-2">{formatDate(leg.flight_date)}</td>
                          <td className="border border-zinc-200 px-3 py-2">
                            {String(leg.dep_airport)} → {String(leg.arr_airport)}
                          </td>
                          <td className="border border-zinc-200 px-3 py-2">{String(leg.seat_number ?? "—")}</td>
                          <td className="border border-zinc-200 px-3 py-2">{String(leg.class_name ?? "—")}</td>
                          <td className="border border-zinc-200 px-3 py-2">{String(leg.airline_name ?? "—")}</td>
                          <td className="border border-zinc-200 px-3 py-2">
                            {leg.ticket_id ? `#${leg.ticket_id}` : "—"}
                          </td>
                          <td className="border border-zinc-200 px-3 py-2">
                            {Number(leg.refund_amount ?? 0) > 0 ? formatMoney(leg.refund_amount) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}
