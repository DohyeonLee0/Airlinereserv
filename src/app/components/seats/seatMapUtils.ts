export type SeatStatus = "available" | "held" | "reserved";
export type SeatClass = "Economy" | "Business" | "First";

export type Seat = {
  flight_id: number;
  seat_number: string;
  class_name: SeatClass;
  price: number;
  seat_status: SeatStatus;
};

export type FlightInfo = {
  flight_id: number;
  model: string;
  airline_name: string;
  flight_number: string;
  dep_airport: string;
  arr_airport: string;
};

export function parseSeat(seatNumber: string) {
  const match = seatNumber.match(/^(\d+)([A-Z]+)$/);
  return { row: match ? Number(match[1]) : 0, letter: match ? match[2] : seatNumber };
}

export function columnsFor(model: string, className: SeatClass) {
  if (className === "First") return ["A", null, "D", "G", null, "K"];
  if (className === "Business") {
    if (model.includes("A350") || model.includes("A330")) return ["A", null, "D", "G", null, "K"];
    return ["A", "C", null, "D", "G", null, "H", "K"];
  }
  if (model.includes("777")) return ["A", "B", "C", null, "D", "E", "F", "G", null, "H", "J", "K"];
  if (model.includes("A330")) return ["A", "B", null, "C", "D", "F", "G", null, "H", "J"];
  return ["A", "B", "C", null, "D", "E", "F", null, "H", "J", "K"];
}

export function rowGroups(seats: Seat[]) {
  const groups = new Map<number, Seat[]>();
  for (const seat of seats) {
    const parsed = parseSeat(seat.seat_number);
    groups.set(parsed.row, [...(groups.get(parsed.row) ?? []), seat]);
  }
  return Array.from(groups.entries()).sort(([a], [b]) => a - b);
}

export function sectionMarker(className: SeatClass, row: number) {
  if (className === "Economy" && (row === 28 || row === 20 || row === 10)) return "exit";
  if (className === "Business" && row === 1) return "galley";
  return null;
}
