import type { BookingGroup } from "@/app/components/customer/bookingTypes";
import { flightDateKey } from "@/lib/bookingPolicy";
import { formatDate, formatDateTime } from "@/lib/formatDate";

export type BookingFilters = {
  query: string;
  status: "all" | "Active" | "Cancelled";
  tripType: "all" | "OneWay" | "RoundTrip" | "Connecting";
  departureFrom: string;
  departureTo: string;
};

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  query: "",
  status: "all",
  tripType: "all",
  departureFrom: "",
  departureTo: ""
};

function bookingSearchBlob(group: BookingGroup): string {
  const parts = [
    group.booking_id,
    group.status,
    group.trip_type,
    group.departure_airport_code,
    group.arrival_airport_code,
    group.payment_method,
    group.payment_status,
    group.amount,
    group.refund_amount,
    formatDateTime(group.booking_time),
    ...group.legs.flatMap((leg) => [
      leg.flight_number,
      leg.flight_date,
      formatDate(leg.flight_date),
      leg.dep_airport,
      leg.arr_airport,
      leg.seat_number,
      leg.class_name,
      leg.airline_name,
      leg.ticket_id
    ])
  ];
  return parts
    .filter((value) => value != null && value !== "")
    .join(" ")
    .toLowerCase();
}

function earliestDepartureKey(group: BookingGroup): string | null {
  const keys = group.legs.map((leg) => flightDateKey(leg.flight_date)).filter(Boolean) as string[];
  if (keys.length === 0) return null;
  return keys.sort()[0];
}

export function filterBookingGroups(groups: BookingGroup[], filters: BookingFilters): BookingGroup[] {
  const query = filters.query.trim().toLowerCase();

  return groups.filter((group) => {
    if (filters.status !== "all" && group.status !== filters.status) return false;
    if (filters.tripType !== "all" && group.trip_type !== filters.tripType) return false;

    const earliest = earliestDepartureKey(group);
    if (filters.departureFrom && (!earliest || earliest < filters.departureFrom)) return false;
    if (filters.departureTo && (!earliest || earliest > filters.departureTo)) return false;

    if (query && !bookingSearchBlob(group).includes(query)) return false;

    return true;
  });
}

export function sortBookingsNewestFirst(groups: BookingGroup[]): BookingGroup[] {
  return [...groups].sort((a, b) => {
    if (b.booking_id !== a.booking_id) {
      return b.booking_id - a.booking_id;
    }

    const tb = Date.parse(String(b.booking_time));
    const ta = Date.parse(String(a.booking_time));
    if (!Number.isNaN(tb) && !Number.isNaN(ta) && tb !== ta) {
      return tb - ta;
    }

    return 0;
  });
}
