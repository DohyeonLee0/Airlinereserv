export type BookingRow = {
  booking_id: number;
  itinerary_id: number;
  trip_type: string;
  departure_airport_code: string;
  arrival_airport_code: string;
  booking_time: string;
  flight_id: number;
  flight_number: string;
  flight_date: string;
  dep_airport: string;
  arr_airport: string;
  dep_time?: string;
  arr_time?: string;
  airline_name?: string;
  seat_number: string;
  class_name: string;
  status: string;
  amount: number;
  payment_method?: string;
  payment_status: string;
  ticket_id?: number;
  refund_amount: number;
};

export type BookingGroup = {
  booking_id: number;
  trip_type: string;
  departure_airport_code: string;
  arrival_airport_code: string;
  booking_time: string;
  status: string;
  amount: number;
  payment_method?: string;
  payment_status: string;
  refund_amount: number;
  legs: BookingRow[];
};

export function groupBookingRows(rows: BookingRow[]): BookingGroup[] {
  const map = new Map<number, BookingGroup>();
  for (const row of rows) {
    const existing = map.get(row.booking_id);
    if (existing) {
      existing.legs.push(row);
    } else {
      map.set(row.booking_id, {
        booking_id: row.booking_id,
        trip_type: row.trip_type,
        departure_airport_code: row.departure_airport_code,
        arrival_airport_code: row.arrival_airport_code,
        booking_time: row.booking_time,
        status: row.status,
        amount: row.amount,
        payment_method: row.payment_method,
        payment_status: row.payment_status,
        refund_amount: row.refund_amount,
        legs: [row]
      });
    }
  }
  return Array.from(map.values());
}
