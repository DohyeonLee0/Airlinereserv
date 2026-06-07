/** Compare calendar dates (YYYY-MM-DD) in local time. */
export function toDateKey(value: Date = new Date()): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function flightDateKey(flightDate: unknown): string | null {
  if (flightDate == null || flightDate === "") return null;
  const raw = String(flightDate).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export function earliestFlightDateKey(legs: Array<{ flight_date?: unknown }>): string | null {
  const keys = legs.map((leg) => flightDateKey(leg.flight_date)).filter(Boolean) as string[];
  if (keys.length === 0) return null;
  return keys.sort()[0];
}

/** True when the earliest leg departs today or later. */
export function canCancelBookingByLegs(legs: Array<{ flight_date?: unknown }>, today = new Date()): boolean {
  const earliest = earliestFlightDateKey(legs);
  if (!earliest) return false;
  return earliest >= toDateKey(today);
}

export function isPastBooking(legs: Array<{ flight_date?: unknown }>, today = new Date()): boolean {
  return !canCancelBookingByLegs(legs, today);
}
