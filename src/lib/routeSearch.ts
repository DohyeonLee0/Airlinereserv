export type RouteRow = {
  route_type?: string;
  flight_id?: number;
  first_flight_id?: number;
  second_flight_id?: number | null;
  flight_ids?: number[] | string;
  flight_numbers?: string[] | string;
  flight_number?: string;
  first_flight_number?: string;
  second_flight_number?: string | null;
  dep_airport: string;
  arr_airport: string;
  connection_airport?: string | null;
  connection_airports?: string | null;
  stop_count?: number;
  available_seats: number;
  lowest_available_price?: number;
  lowest_price?: number;
  total_lowest_price?: number;
  original_lowest_price?: number;
  final_lowest_price?: number;
  discount_percent?: number;
  applied_promo_code?: string;
  promo_description?: string;
  recommendation_score?: number;
};

function parseCsv(value: unknown): string[] {
  if (value == null || value === "") return [];
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseIdCsv(value: unknown): number[] {
  return parseCsv(value)
    .map((part) => Number(part))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function flightIdsOf(row: RouteRow): number[] {
  if (Array.isArray(row.flight_ids)) {
    return row.flight_ids.filter((id) => Number.isFinite(id) && id > 0);
  }
  const parsed = parseIdCsv(row.flight_ids);
  if (parsed.length) return parsed;

  const first = row.first_flight_id ?? row.flight_id;
  if (!first) return [];
  if (row.second_flight_id) return [first, row.second_flight_id];
  return [first];
}

export function flightNumbersOf(row: RouteRow): string[] {
  if (Array.isArray(row.flight_numbers)) {
    return row.flight_numbers.map(String).filter(Boolean);
  }
  const parsed = parseCsv(row.flight_numbers);
  if (parsed.length) return parsed;

  const numbers = [row.first_flight_number ?? row.flight_number, row.second_flight_number]
    .filter((value): value is string => Boolean(value));
  return numbers;
}

export function stopCountOf(row: RouteRow): number {
  if (typeof row.stop_count === "number" && row.stop_count >= 0) return row.stop_count;
  const legCount = flightIdsOf(row).length;
  return legCount > 1 ? legCount - 1 : 0;
}

export function isConnectingRoute(row: RouteRow): boolean {
  if (row.route_type === "DIRECT") return false;
  return stopCountOf(row) > 0 || flightIdsOf(row).length > 1;
}

export function stopLabel(row: RouteRow): string {
  const stops = stopCountOf(row);
  if (stops <= 0) return "Direct";
  if (stops === 1) return "1 stop";
  return `${stops} stops`;
}

export function connectionAirportsOf(row: RouteRow): string[] {
  const fromField = parseCsv(row.connection_airports);
  if (fromField.length) return fromField;
  if (row.connection_airport) return [row.connection_airport];
  return [];
}

export function routeLabel(row: RouteRow): string {
  const hubs = connectionAirportsOf(row);
  if (hubs.length) return [row.dep_airport, ...hubs, row.arr_airport].join(" → ");
  if (isConnectingRoute(row)) return `${row.dep_airport} → … → ${row.arr_airport}`;
  return `${row.dep_airport} → ${row.arr_airport}`;
}

export function seatHref(row: RouteRow): string {
  const ids = flightIdsOf(row);
  if (ids.length > 1) return `/seats?flight_ids=${ids.join(",")}`;
  if (ids.length === 1) return `/seats?flight_id=${ids[0]}`;
  return "/seats";
}

export function priceOf(row: RouteRow): number {
  return row.final_lowest_price ?? row.total_lowest_price ?? row.lowest_price ?? row.lowest_available_price ?? 0;
}

export function normalizeRouteRow(row: Record<string, unknown>): RouteRow {
  const base = row as RouteRow;
  const flightIds = flightIdsOf(base);
  const flightNumbers = flightNumbersOf(base);
  const hubs = connectionAirportsOf(base);
  const stops = stopCountOf({
    ...base,
    flight_ids: flightIds,
    stop_count: row.stop_count as number | undefined
  });

  return {
    ...base,
    flight_ids: flightIds,
    flight_numbers: flightNumbers,
    connection_airports: hubs.length ? hubs.join(",") : base.connection_airports ?? null,
    connection_airport: hubs[0] ?? base.connection_airport ?? null,
    stop_count: stops,
    first_flight_id: flightIds[0] ?? base.first_flight_id,
    second_flight_id: flightIds[1] ?? base.second_flight_id ?? null,
    first_flight_number: flightNumbers[0] ?? base.first_flight_number,
    second_flight_number: flightNumbers[1] ?? base.second_flight_number ?? null
  };
}

export function normalizeRouteRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => normalizeRouteRow(row));
}
