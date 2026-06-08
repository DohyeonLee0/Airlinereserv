export type Promotion = {
  promo_code: string;
  description: string;
  discount_percent: number;
};

export type LedgerRow = {
  booking_id: number;
  user_id: string;
  itinerary_id: number;
  trip_type?: string;
  departure_airport_code?: string;
  arrival_airport_code?: string;
  booking_time?: string;
  status: string;
  flight_id?: number;
  seat_number?: string;
  ticket_id?: number | null;
  payment_id?: number | null;
  amount?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  payment_time?: string | null;
};

export type Ledger = {
  rows: LedgerRow[];
  refunds: Array<{
    refund_id: number;
    payment_id: number;
    refund_amount: number;
    refund_time: string;
  }>;
};

export function normalizeLedgerPayload(data: unknown): Ledger | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const rawBooking = record.booking;
  const rows = Array.isArray(rawBooking) ? rawBooking : rawBooking ? [rawBooking] : [];
  if (rows.length === 0) return null;
  return {
    rows: rows as LedgerRow[],
    refunds: Array.isArray(record.refunds) ? (record.refunds as Ledger["refunds"]) : []
  };
}

export function ledgerSummary(rows: LedgerRow[]) {
  const first = rows[0];
  if (!first) return null;
  return {
    booking_id: first.booking_id,
    status: first.status,
    trip_type: first.trip_type,
    route:
      first.departure_airport_code && first.arrival_airport_code
        ? `${first.departure_airport_code} → ${first.arrival_airport_code}`
        : undefined,
    payment_id: first.payment_id,
    payment_method: first.payment_method,
    payment_status: first.payment_status,
    amount: first.amount
  };
}
