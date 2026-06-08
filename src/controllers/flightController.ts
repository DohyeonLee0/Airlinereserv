import { NextRequest } from "next/server";
import { callProcedure, getPool } from "@/config/db";
import { getSessionUser } from "@/lib/auth";
import {
  attachRecommendationScores,
  collapseRoutesByFlight,
  hasActivePromotion,
  promoRowsToRoutes,
  sortSearchResults,
  type JourneyType
} from "@/lib/flightSearch";
import { isConnectingRoute, normalizeRouteRows, type RouteRow } from "@/lib/routeSearch";
import { badRequest, conflict, created, dbErrorMessage, forbidden, isConflictDbError, ok, readJson, requiredParams, serverError, unauthorized } from "./http";

type SearchMode = "basic" | "advanced" | "promotions" | "connecting";

function nullableNumber(value: string | null) {
  return value === null || value === "" ? null : Number(value);
}

function classIdFromQuery(classId: string | null, className: string | null) {
  if (classId) return Number(classId);
  const normalized = (className ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "economy" || normalized === "이코노미") return 1;
  if (normalized === "business" || normalized === "비즈니스") return 2;
  if (normalized === "first" || normalized === "퍼스트") return 3;
  return null;
}

async function searchPromotions(request: NextRequest) {
  const parsed = requiredParams(request, ["dep_airport", "arr_airport", "flight_date"]);
  if (parsed.error || !parsed.values) return parsed.error;

  const promoCode = parsed.values.get("promo_code")?.trim().toUpperCase() || null;

  try {
    const rows = await callProcedure("CALL search_flights_with_promo_code(?, ?, ?, ?, ?, ?)", [
      parsed.values.get("dep_airport"),
      parsed.values.get("arr_airport"),
      parsed.values.get("flight_date"),
      classIdFromQuery(parsed.values.get("class_id"), parsed.values.get("class_name")),
      nullableNumber(parsed.values.get("max_price")),
      promoCode
    ]);
    return ok({ mode: "promotions", promoCode, routes: normalizeRouteRows(rows) });
  } catch (error) {
    return serverError(error);
  }
}

async function runSearch(request: NextRequest, mode: SearchMode) {
  if (mode === "promotions") return searchPromotions(request);

  const parsed = requiredParams(request, ["dep_airport", "arr_airport", "flight_date"]);
  if (parsed.error || !parsed.values) return parsed.error;

  const classId = classIdFromQuery(parsed.values.get("class_id"), parsed.values.get("class_name"));
  const maxPrice = nullableNumber(parsed.values.get("max_price"));
  const shared = [parsed.values.get("dep_airport"), parsed.values.get("arr_airport"), parsed.values.get("flight_date")];

  const flightSearchParams = [...shared, classId, maxPrice];
  const map = {
    basic: { sql: "CALL search_flights(?, ?, ?, ?, ?)", params: flightSearchParams },
    advanced: { sql: "CALL search_flights(?, ?, ?, ?, ?)", params: flightSearchParams },
    connecting: { sql: "CALL search_direct_and_connecting_flights(?, ?, ?, ?)", params: [...shared, classId] }
  } satisfies Record<Exclude<SearchMode, "promotions">, { sql: string; params: unknown[] }>;

  try {
    const rows = normalizeRouteRows(await callProcedure(map[mode].sql, map[mode].params));
    return ok({
      mode,
      routes: rows,
      direct: rows.filter((row) => row.route_type === "DIRECT"),
      connecting: rows.filter((row) => isConnectingRoute(row))
    });
  } catch (error) {
    return serverError(error);
  }
}

async function fetchRecommendationScores(
  depAirport: string,
  arrAirport: string,
  flightDate: string,
  classId: number | null
): Promise<RouteRow[]> {
  const rows = await callProcedure("CALL recommend_routes(?, ?, ?, ?)", [
    depAirport,
    arrAirport,
    flightDate,
    classId
  ]);
  return normalizeRouteRows(rows);
}

async function searchPromoRoutes(
  depAirport: string,
  arrAirport: string,
  flightDate: string,
  classId: number | null,
  maxPrice: number | null
): Promise<RouteRow[]> {
  const rows = await callProcedure("CALL search_flights_with_promo_code(?, ?, ?, ?, ?, ?)", [
    depAirport,
    arrAirport,
    flightDate,
    classId,
    maxPrice,
    null
  ]);
  return promoRowsToRoutes(rows).filter(hasActivePromotion);
}

async function searchDirectRoutes(
  depAirport: string,
  arrAirport: string,
  flightDate: string,
  classId: number | null,
  maxPrice: number | null
): Promise<RouteRow[]> {
  const rows = await callProcedure("CALL search_flights(?, ?, ?, ?, ?)", [
    depAirport,
    arrAirport,
    flightDate,
    classId,
    maxPrice
  ]);
  return normalizeRouteRows(rows);
}

async function searchDirectAndConnectingRoutes(
  depAirport: string,
  arrAirport: string,
  flightDate: string,
  classId: number | null
): Promise<RouteRow[]> {
  const rows = await callProcedure("CALL search_direct_and_connecting_flights(?, ?, ?, ?)", [
    depAirport,
    arrAirport,
    flightDate,
    classId
  ]);
  return normalizeRouteRows(rows);
}

async function scoreAndSortRoutes(
  routes: RouteRow[],
  depAirport: string,
  arrAirport: string,
  flightDate: string,
  classId: number | null
) {
  const recommended = await fetchRecommendationScores(depAirport, arrAirport, flightDate, classId);
  const scored = attachRecommendationScores(routes, recommended);
  const { sorted, bestKey } = sortSearchResults(scored);
  return { routes: sorted, bestKey };
}

async function searchLeg(
  depAirport: string,
  arrAirport: string,
  flightDate: string,
  classId: number | null,
  maxPrice: number | null,
  journeyType: JourneyType,
  applyPromotions: boolean
) {
  let routes: RouteRow[];

  if (applyPromotions) {
    routes = await searchPromoRoutes(depAirport, arrAirport, flightDate, classId, maxPrice);
  } else if (journeyType === "round_trip") {
    routes = await searchDirectRoutes(depAirport, arrAirport, flightDate, classId, maxPrice);
  } else {
    const [directRoutes, connectingCandidates] = await Promise.all([
      searchDirectRoutes(depAirport, arrAirport, flightDate, classId, maxPrice),
      searchDirectAndConnectingRoutes(depAirport, arrAirport, flightDate, classId)
    ]);
    let connectingRoutes = connectingCandidates.filter((row) => isConnectingRoute(row));
    if (maxPrice !== null) {
      connectingRoutes = connectingRoutes.filter((row) => {
        const price = row.total_lowest_price ?? row.lowest_price ?? 0;
        return price <= maxPrice;
      });
    }
    routes = [...directRoutes, ...connectingRoutes];
  }

  if (journeyType === "one_way" && classId == null) {
    routes = collapseRoutesByFlight(routes);
  }

  return scoreAndSortRoutes(routes, depAirport, arrAirport, flightDate, classId);
}

export async function searchUnifiedFlights(request: NextRequest) {
  const parsed = requiredParams(request, ["dep_airport", "arr_airport", "flight_date"]);
  if (parsed.error || !parsed.values) return parsed.error;

  const depAirport = parsed.values.get("dep_airport")!;
  const arrAirport = parsed.values.get("arr_airport")!;
  const flightDate = parsed.values.get("flight_date")!;
  const returnDate = parsed.values.get("return_date");
  const journeyType = (parsed.values.get("journey_type") ?? "one_way") as JourneyType;
  const applyPromotions = parsed.values.get("apply_promotions") === "true";
  const classId = classIdFromQuery(parsed.values.get("class_id"), parsed.values.get("class_name"));
  const maxPrice = nullableNumber(parsed.values.get("max_price"));

  if (journeyType === "round_trip" && !returnDate) {
    return badRequest("Return date is required for round-trip searches.");
  }
  if (journeyType === "round_trip" && returnDate && returnDate < flightDate) {
    return badRequest("Return date must be on or after the departure date.");
  }

  try {
    const outbound = await searchLeg(
      depAirport,
      arrAirport,
      flightDate,
      classId,
      maxPrice,
      journeyType,
      applyPromotions
    );

    if (journeyType === "round_trip" && returnDate) {
      const [outboundResult, inboundResult] = await Promise.all([
        searchLeg(depAirport, arrAirport, flightDate, classId, maxPrice, journeyType, applyPromotions),
        searchLeg(arrAirport, depAirport, returnDate, classId, maxPrice, journeyType, applyPromotions)
      ]);

      const noPromotionalDeals =
        applyPromotions && outboundResult.routes.length === 0 && inboundResult.routes.length === 0;

      return ok({
        journeyType,
        applyPromotions,
        outbound: outboundResult.routes,
        return: inboundResult.routes,
        bestOutboundKey: outboundResult.bestKey,
        bestReturnKey: inboundResult.bestKey,
        noPromotionalDeals
      });
    }

    const noPromotionalDeals = applyPromotions && outbound.routes.length === 0;

    return ok({
      journeyType,
      applyPromotions,
      routes: outbound.routes,
      bestRouteKey: outbound.bestKey,
      noPromotionalDeals
    });
  } catch (error) {
    return serverError(error);
  }
}

export function searchFlights(request: NextRequest) {
  return searchUnifiedFlights(request);
}

export function searchBasicFlights(request: NextRequest) {
  return runSearch(request, "basic");
}

export function searchAdvancedFlights(request: NextRequest) {
  return runSearch(request, "advanced");
}

export function searchPromotionFlights(request: NextRequest) {
  return runSearch(request, "promotions");
}

export function searchConnectingFlights(request: NextRequest) {
  return runSearch(request, "connecting");
}

export async function recommendRoutes(request: NextRequest) {
  const parsed = requiredParams(request, ["dep_airport", "arr_airport", "flight_date"]);
  if (parsed.error || !parsed.values) return parsed.error;

  try {
    const rows = normalizeRouteRows(
      await callProcedure("CALL recommend_routes(?, ?, ?, ?)", [
        parsed.values.get("dep_airport"),
        parsed.values.get("arr_airport"),
        parsed.values.get("flight_date"),
        nullableNumber(parsed.values.get("class_id")) ?? classIdFromQuery(null, parsed.values.get("class_name"))
      ])
    );
    return ok({ routes: rows.slice(0, 5) });
  } catch (error) {
    return serverError(error);
  }
}

export async function getAvailablePromotions(request: NextRequest) {
  const parsed = requiredParams(request, ["flight_id"]);
  if (parsed.error || !parsed.values) return parsed.error;

  try {
    const rows = await callProcedure("CALL available_promotions_for_flight(?, ?)", [
      Number(parsed.values.get("flight_id")),
      classIdFromQuery(parsed.values.get("class_id"), parsed.values.get("class_name"))
    ]);
    return ok({ promotions: rows });
  } catch (error) {
    return serverError(error);
  }
}

export async function getSeats(request: NextRequest) {
  const parsed = requiredParams(request, ["flight_id"]);
  if (parsed.error || !parsed.values) return parsed.error;

  try {
    const flightId = Number(parsed.values.get("flight_id"));
    await callProcedure("CALL release_expired_seat_holds()");
    const availableSeats = await callProcedure("CALL view_available_seats(?)", [flightId]);

    const [flightRows] = await getPool().query(
      `SELECT
         f.flight_id,
         f.aircraft_id,
         a.model,
         a.capacity,
         al.airline_name,
         fs.flight_number,
         fs.dep_airport,
         fs.arr_airport,
         f.flight_date
       FROM flights f
       JOIN aircraft a ON f.aircraft_id = a.aircraft_id
       JOIN airlines al ON a.airline_id = al.airline_id
       JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
       WHERE f.flight_id = ?`,
      [flightId]
    );

    const [seatRows] = await getPool().query(
      `SELECT
         fls.flight_id,
         fls.seat_number,
         sc.class_name,
         fls.price,
         CASE
           WHEN fls.is_available = 0 THEN 'reserved'
           WHEN sh.hold_id IS NOT NULL THEN 'held'
           ELSE 'available'
         END AS seat_status
       FROM flight_seats fls
       JOIN seat_classes sc ON fls.class_id = sc.class_id
       LEFT JOIN seat_holds sh
         ON fls.flight_id = sh.flight_id
        AND fls.seat_number = sh.seat_number
        AND sh.expires_at >= CURRENT_TIMESTAMP
       WHERE fls.flight_id = ?
       ORDER BY CAST(fls.seat_number AS UNSIGNED), fls.seat_number`,
      [flightId]
    );

    return ok({ flight: Array.isArray(flightRows) ? flightRows[0] : null, seats: seatRows, availableSeats });
  } catch (error) {
    return serverError(error);
  }
}

export async function holdSeat(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorized();
  if (sessionUser.role !== "Customer") return forbidden("Only customers can hold seats");

  const body = await readJson(request);
  const required = ["hold_id", "flight_id", "seat_number"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  try {
    await callProcedure("CALL hold_seat(?, ?, ?, ?)", [
      Number(body.hold_id),
      sessionUser.user_id,
      Number(body.flight_id),
      String(body.seat_number)
    ]);
    return created({ hold_id: Number(body.hold_id), expiresInMinutes: 10 });
  } catch (error) {
    if (isConflictDbError(error)) {
      const message = dbErrorMessage(error).includes("duplicate")
        ? "A hold already exists for this seat. Refresh the seat map and try again."
        : "The selected seat is already held or reserved by another customer.";
      return conflict(message, "SEAT_HOLD_CONFLICT");
    }
    return serverError(error);
  }
}

export async function releaseExpiredSeatHolds() {
  try {
    await callProcedure("CALL release_expired_seat_holds()");
    return ok({ released: true });
  } catch (error) {
    return serverError(error);
  }
}
