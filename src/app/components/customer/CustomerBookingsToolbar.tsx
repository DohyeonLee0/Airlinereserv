"use client";

import { Calendar, Search, X } from "lucide-react";
import type { BookingFilters } from "@/app/components/customer/bookingFilters";
import Button from "@/app/components/ui/Button";
import EnglishDateInput from "@/app/components/ui/EnglishDateInput";
import { cn } from "@/lib/cn";

type CustomerBookingsToolbarProps = {
  filters: BookingFilters;
  resultCount: number;
  totalCount: number;
  onChange: (patch: Partial<BookingFilters>) => void;
  onClear: () => void;
};

export default function CustomerBookingsToolbar({
  filters,
  resultCount,
  totalCount,
  onChange,
  onClear
}: CustomerBookingsToolbarProps) {
  const hasFilters =
    filters.query.trim() !== "" ||
    filters.status !== "all" ||
    filters.tripType !== "all" ||
    filters.departureFrom !== "" ||
    filters.departureTo !== "";

  return (
    <div className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cerulean-700">Search & filter</p>
          <p className="mt-0.5 text-sm text-zinc-500">
            Showing {resultCount} of {totalCount} booking{totalCount === 1 ? "" : "s"}
          </p>
        </div>
        {hasFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClear} className="gap-1.5 text-zinc-600">
            <X className="size-3.5" strokeWidth={1.75} />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <label className="block sm:col-span-2 lg:col-span-1">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <Search className="size-3.5" strokeWidth={1.75} />
            Search bookings
          </span>
          <input
            type="search"
            value={filters.query}
            onChange={(e) => onChange({ query: e.target.value })}
            placeholder="Booking #, route, flight, seat, trip type…"
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-cerulean-500 focus:ring-2 focus:ring-cerulean-500/20"
          />
        </label>

        <label className="block min-w-[140px]">
          <span className="mb-1.5 block text-xs font-medium text-zinc-600">Trip type</span>
          <select
            value={filters.tripType}
            onChange={(e) => onChange({ tripType: e.target.value as BookingFilters["tripType"] })}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-cerulean-500"
          >
            <option value="all">All trip types</option>
            <option value="OneWay">One-way</option>
            <option value="RoundTrip">Round-trip</option>
            <option value="Connecting">Connecting</option>
          </select>
        </label>

        <label className="block min-w-[140px]">
          <span className="mb-1.5 block text-xs font-medium text-zinc-600">Status</span>
          <select
            value={filters.status}
            onChange={(e) => onChange({ status: e.target.value as BookingFilters["status"] })}
            className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-cerulean-500"
          >
            <option value="all">All statuses</option>
            <option value="Active">Active</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </label>

        <label className="block min-w-[160px]">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <Calendar className="size-3.5" strokeWidth={1.75} />
            Depart from
          </span>
          <EnglishDateInput
            value={filters.departureFrom}
            onChange={(departureFrom) => onChange({ departureFrom })}
          />
        </label>

        <label className="block min-w-[160px]">
          <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-600">
            <Calendar className="size-3.5" strokeWidth={1.75} />
            Depart to
          </span>
          <EnglishDateInput
            value={filters.departureTo}
            min={filters.departureFrom || undefined}
            onChange={(departureTo) => onChange({ departureTo })}
          />
        </label>
      </div>
    </div>
  );
}

type BookingsPaginationProps = {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
};

export function BookingsPagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  totalItems,
  onPageChange
}: BookingsPaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm",
        totalPages <= 1 && "justify-center"
      )}
    >
      <p className="text-zinc-600">
        {totalItems === 0 ? "No results" : `${rangeStart}–${rangeEnd} of ${totalItems}`}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="tabular-nums text-zinc-600">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
