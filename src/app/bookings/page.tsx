"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronUp, Plane, Receipt, Search, Ticket } from "lucide-react";
import {
  DEFAULT_BOOKING_FILTERS,
  filterBookingGroups,
  sortBookingsNewestFirst,
  type BookingFilters
} from "@/app/components/customer/bookingFilters";
import CustomerBookingsToolbar, { BookingsPagination } from "@/app/components/customer/CustomerBookingsToolbar";
import { groupBookingRows, type BookingGroup, type BookingRow } from "@/app/components/customer/bookingTypes";
import Button from "@/app/components/ui/Button";
import { canCancelBookingByLegs, isPastBooking } from "@/lib/bookingPolicy";
import { formatDate, formatDateTime } from "@/lib/formatDate";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 10;

function statusStyle(status: string) {
  if (status === "Active") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "Cancelled") return "bg-zinc-100 text-zinc-600 ring-zinc-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

function bookingRouteLabel(booking: BookingGroup) {
  if (booking.trip_type === "RoundTrip") {
    return `${booking.departure_airport_code} ↔ ${booking.arrival_airport_code}`;
  }
  return `${booking.departure_airport_code} → ${booking.arrival_airport_code}`;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filters, setFilters] = useState<BookingFilters>(DEFAULT_BOOKING_FILTERS);
  const [page, setPage] = useState(1);

  const groupedBookings = useMemo(() => groupBookingRows(bookings), [bookings]);

  const filteredBookings = useMemo(
    () => sortBookingsNewestFirst(filterBookingGroups(groupedBookings, filters)),
    [groupedBookings, filters]
  );

  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageBookings = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredBookings.slice(start, start + PAGE_SIZE);
  }, [filteredBookings, safePage]);

  const rangeStart = filteredBookings.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredBookings.length);

  const stats = useMemo(() => {
    const active = groupedBookings.filter((b) => b.status === "Active").length;
    const cancelled = groupedBookings.filter((b) => b.status === "Cancelled").length;
    const totalSpent = groupedBookings
      .filter((b) => b.status === "Active")
      .reduce((sum, b) => sum + Number(b.amount ?? 0), 0);
    return { active, cancelled, total: groupedBookings.length, totalSpent };
  }, [groupedBookings]);

  useEffect(() => {
    if (expandedId != null && !pageBookings.some((b) => b.booking_id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, pageBookings]);

  function updateFilters(patch: Partial<BookingFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function clearFilters() {
    setFilters(DEFAULT_BOOKING_FILTERS);
    setPage(1);
  }

  async function loadBookings() {
    setLoading(true);
    const response = await fetch("/api/bookings/mine");
    const json = await response.json();
    setLoading(false);
    if (!response.ok || !json.success) {
      setMessage(json.message ?? "Failed to load bookings. Please sign in as a customer.");
      setBookings([]);
      return;
    }
    setMessage("");
    setBookings(json.data?.bookings ?? []);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  async function cancelBooking(bookingId: number) {
    if (!confirm(`Cancel booking #${bookingId} and process a full refund?`)) return;
    setLoadingId(bookingId);
    setMessage("");
    const response = await fetch("/api/bookings/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: bookingId })
    });
    const json = await response.json();
    setLoadingId(null);
    if (!response.ok || !json.success) {
      setMessage(json.message ?? "Cancellation failed");
      return;
    }
    setMessage(`Booking #${bookingId} was cancelled and refunded.`);
    await loadBookings();
  }

  if (loading) {
    return <p className="text-zinc-500">Loading your bookings…</p>;
  }

  return (
    <div className="space-y-6">
      {message && (
        <p
          className={cn(
            "rounded-xl px-4 py-3 text-sm",
            message.includes("cancelled") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          )}
        >
          {message}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-100 bg-white p-5">
          <p className="text-sm text-zinc-500">Active bookings</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5">
          <p className="text-sm text-zinc-500">Cancelled</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">{stats.cancelled}</p>
        </div>
        <div className="rounded-2xl border border-zinc-100 bg-white p-5">
          <p className="text-sm text-zinc-500">Active trip value</p>
          <p className="mt-1 text-3xl font-bold text-zinc-900">${stats.totalSpent.toLocaleString("en-US")}</p>
        </div>
      </div>

      {groupedBookings.length === 0 ? (
        <div className="rounded-2xl border border-zinc-100 bg-white px-6 py-16 text-center">
          <Plane className="mx-auto size-10 text-zinc-300" strokeWidth={1.5} />
          <h2 className="mt-4 text-xl font-semibold text-zinc-900">No bookings yet</h2>
          <p className="mx-auto mt-2 max-w-md text-zinc-500">
            Search for a flight, pick your seats, and complete checkout. Your reservations will show up here.
          </p>
          <Link href="/" className="mt-6 inline-block">
            <Button size="lg">Search flights</Button>
          </Link>
          <p className="mt-6 text-xs text-zinc-400">
            Demo account with sample bookings: john.smith@example.com
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <CustomerBookingsToolbar
            filters={filters}
            resultCount={filteredBookings.length}
            totalCount={groupedBookings.length}
            onChange={updateFilters}
            onClear={clearFilters}
          />

          {filteredBookings.length === 0 ? (
            <div className="rounded-2xl border border-zinc-100 bg-white px-6 py-12 text-center">
              <Search className="mx-auto size-9 text-zinc-300" strokeWidth={1.5} />
              <h2 className="mt-4 text-lg font-semibold text-zinc-900">No matching bookings</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
                Try a different search term, trip type, or adjust the departure date range.
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              {pageBookings.map((booking) => (
                <BookingCard
                  key={booking.booking_id}
                  booking={booking}
                  expanded={expandedId === booking.booking_id}
                  loadingId={loadingId}
                  onToggleExpand={() => setExpandedId(expandedId === booking.booking_id ? null : booking.booking_id)}
                  onCancel={cancelBooking}
                />
              ))}

              <BookingsPagination
                page={safePage}
                totalPages={totalPages}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd}
                totalItems={filteredBookings.length}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

type BookingCardProps = {
  booking: BookingGroup;
  expanded: boolean;
  loadingId: number | null;
  onToggleExpand: () => void;
  onCancel: (bookingId: number) => void;
};

function BookingCard({ booking, expanded, loadingId, onToggleExpand, onCancel }: BookingCardProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-zinc-900">Booking #{booking.booking_id}</h2>
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", statusStyle(booking.status))}>
              {booking.status}
            </span>
            {booking.status === "Active" && isPastBooking(booking.legs) ? (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">Departed</span>
            ) : null}
          </div>
          <p className="mt-1 text-base font-medium text-zinc-800">
            {bookingRouteLabel(booking)}
            <span className="ml-2 text-sm font-normal text-zinc-500">({booking.trip_type})</span>
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
            <Calendar className="size-3.5" strokeWidth={1.75} />
            Booked {formatDateTime(booking.booking_time)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {booking.legs.length} flight{booking.legs.length === 1 ? "" : "s"} · {booking.payment_method ?? "—"} (
            {booking.payment_status})
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-zinc-900">${Number(booking.amount ?? 0).toLocaleString("en-US")}</p>
          {Number(booking.refund_amount) > 0 && (
            <p className="mt-1 text-sm text-emerald-700">
              Refunded ${Number(booking.refund_amount).toLocaleString("en-US")}
            </p>
          )}
        </div>
      </div>

      <div className="border-t border-zinc-100 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex w-full items-center justify-between text-sm font-medium text-zinc-700 hover:text-zinc-900"
        >
          {expanded ? "Hide flight details" : "View flight details"}
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-zinc-100 bg-zinc-50/50">
          <div className="divide-y divide-zinc-100">
            {booking.legs.map((leg) => (
              <div key={`${booking.booking_id}-${leg.flight_id}-${leg.seat_number}`} className="px-5 py-4 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">
                      {leg.flight_number}
                      {leg.airline_name ? (
                        <span className="ml-2 text-sm font-normal text-zinc-500">{leg.airline_name}</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {leg.dep_airport} → {leg.arr_airport}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatDate(leg.flight_date)}
                      {leg.dep_time && leg.arr_time ? ` · ${leg.dep_time} – ${leg.arr_time}` : ""}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="inline-flex items-center gap-1 font-medium text-zinc-800">
                      <Ticket className="size-3.5" strokeWidth={1.75} />
                      Seat {leg.seat_number} · {leg.class_name}
                    </p>
                    {leg.ticket_id ? <p className="mt-1 text-xs text-zinc-500">Ticket #{leg.ticket_id}</p> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-5 py-4 sm:px-6">
        <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
          <Receipt className="size-3.5" strokeWidth={1.75} />
          Itinerary #{booking.legs[0]?.itinerary_id ?? "—"}
        </p>
        {booking.status === "Active" && canCancelBookingByLegs(booking.legs) ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loadingId === booking.booking_id}
            onClick={() => onCancel(booking.booking_id)}
            className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
          >
            {loadingId === booking.booking_id ? "Cancelling…" : "Cancel & refund"}
          </Button>
        ) : booking.status === "Active" ? (
          <span className="text-sm text-zinc-500">Departure date passed — cancellation not available</span>
        ) : (
          <span className="text-sm text-zinc-500">
            {Number(booking.refund_amount) > 0
              ? `Refunded $${Number(booking.refund_amount).toLocaleString("en-US")}`
              : "This booking was cancelled"}
          </span>
        )}
      </div>
    </article>
  );
}
