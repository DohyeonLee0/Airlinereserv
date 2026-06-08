import { NextRequest } from "next/server";
import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { callProcedure, getPool } from "@/config/db";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";
import { badRequest, created, ok, readJson, requiredParams, serverError, unauthorized, forbidden } from "./http";

async function requireStaffSession() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized(), user: null };
  if (!isStaffRole(user.role)) return { error: forbidden("Staff access required"), user: null };
  return { error: null, user };
}

type KpiRow = RowDataPacket & {
  active_bookings: number;
  tickets_sold: number;
  total_revenue: number;
  scheduled_flights: number;
  pending_approvals: number;
  active_customers: number;
  avg_load_factor: number;
};

const WEEKDAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

function addDaysIso(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function parseScheduleIds(value: unknown): number[] {
  if (!value) return [];
  try {
    const raw = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(raw)) return [];
    return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0);
  } catch {
    return [];
  }
}

export async function generateConnectingFlights(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const body = await readJson(request);
  const bodyLegs = Array.isArray(body.legs) ? body.legs : [];
  const required = ["itinerary_id", "start_date", "end_date"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  const itineraryId = Number(body.itinerary_id);
  const startDate = String(body.start_date);
  const endDate = String(body.end_date);
  if (startDate > endDate) return badRequest("Start date must be on or before end date.");

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [itineraryRows] = await connection.query<
      Array<RowDataPacket & { trip_type: string; leg_schedule_ids: unknown }>
    >("SELECT trip_type, leg_schedule_ids FROM itineraries WHERE itinerary_id = ?", [itineraryId]);

    if (!itineraryRows[0] || itineraryRows[0].trip_type !== "Connecting") {
      await connection.rollback();
      return badRequest("Save the connecting route before generating dated flights.");
    }

    const scheduleIds = parseScheduleIds(itineraryRows[0].leg_schedule_ids);
    if (scheduleIds.length < 2) {
      await connection.rollback();
      return badRequest(
        "This itinerary has no linked schedule legs. Save the connecting route again, then retry."
      );
    }

    const aircraftBySchedule = new Map<number, number>();
    for (let index = 0; index < bodyLegs.length; index += 1) {
      const leg = bodyLegs[index] as { schedule_id?: number; aircraft_id?: number };
      if (!leg.aircraft_id) {
        await connection.rollback();
        return badRequest(`Leg ${index + 1} requires an aircraft.`);
      }
      if (leg.schedule_id) {
        aircraftBySchedule.set(Number(leg.schedule_id), Number(leg.aircraft_id));
      }
    }

    const legs: Array<{ schedule_id: number; aircraft_id: number }> = [];
    for (let index = 0; index < scheduleIds.length; index += 1) {
      const scheduleId = scheduleIds[index];
      const bodyLeg = bodyLegs[index] as { schedule_id?: number; aircraft_id?: number } | undefined;
      const aircraftId =
        aircraftBySchedule.get(scheduleId) ??
        (bodyLeg?.schedule_id && Number(bodyLeg.schedule_id) === scheduleId
          ? Number(bodyLeg.aircraft_id)
          : Number(bodyLeg?.aircraft_id ?? 0));

      if (!aircraftId) {
        await connection.rollback();
        return badRequest(`Leg ${index + 1} requires an aircraft.`);
      }

      legs.push({ schedule_id: scheduleId, aircraft_id: aircraftId });
    }

    const [maxFlightRows] = await connection.query<RowDataPacket[]>(
      "SELECT COALESCE(MAX(flight_id), 0) AS max_id FROM flights FOR UPDATE"
    );
    let nextFlightId = Number(maxFlightRows[0]?.max_id ?? 0) + 1;
    let generated = 0;
    let candidateDays = 0;

    for (let currentDate = startDate; currentDate <= endDate; currentDate = addDaysIso(currentDate, 1)) {
      const dayName = WEEKDAY_NAMES[new Date(`${currentDate}T00:00:00`).getDay()];

      const operatingChecks = await Promise.all(
        legs.map(async (leg) => {
          const [rows] = await connection.query<RowDataPacket[]>(
            "SELECT 1 FROM schedule_days WHERE schedule_id = ? AND day_of_week = ? LIMIT 1",
            [leg.schedule_id, dayName]
          );
          return rows.length > 0;
        })
      );

      if (!operatingChecks.every(Boolean)) continue;
      candidateDays += 1;

      for (let segmentOrder = 0; segmentOrder < legs.length; segmentOrder += 1) {
        const leg = legs[segmentOrder];
        const [insertResult] = await connection.query<ResultSetHeader>(
          `INSERT IGNORE INTO flights (
             flight_id, itinerary_id, schedule_id, flight_date, aircraft_id, segment_order, leg_type, status
           ) VALUES (?, ?, ?, ?, ?, ?, 'Outbound', 'Scheduled')`,
          [
            nextFlightId,
            itineraryId,
            leg.schedule_id,
            currentDate,
            leg.aircraft_id,
            segmentOrder + 1
          ]
        );

        if (insertResult.affectedRows > 0) {
          generated += 1;
        }
        nextFlightId += 1;
      }
    }

    if (generated === 0) {
      await connection.rollback();
      if (candidateDays === 0) {
        return badRequest(
          "No flights were created. The selected date range has no days matching this route's operating days (default MON/WED/FRI)."
        );
      }
      return badRequest(
        "No new flights were created. Flights may already exist for those dates, or the schedule is already in use on the same day."
      );
    }

    await connection.commit();
    return created({ itinerary_id: itineraryId, generated_flights: generated });
  } catch (error) {
    await connection.rollback();
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function generateFlights(request: NextRequest) {
  const body = await readJson(request);
  const required = ["schedule_id", "aircraft_id", "start_date", "end_date"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  try {
    const tripTypeId = body.trip_type_id != null ? Number(body.trip_type_id) : 1;
    await callProcedure("CALL generate_flights_from_schedule(?, ?, ?, ?, ?)", [
      Number(body.schedule_id),
      Number(body.aircraft_id),
      String(body.start_date),
      String(body.end_date),
      tripTypeId
    ]);
    return created({
      schedule_id: Number(body.schedule_id),
      aircraft_id: Number(body.aircraft_id),
      start_date: String(body.start_date),
      end_date: String(body.end_date),
      trip_type_id: tripTypeId
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function generateFlightSeats(request: NextRequest) {
  const body = await readJson(request);
  const required = ["flight_id", "economy_price", "business_price", "first_price"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  try {
    await callProcedure("CALL generate_flight_seats(?, ?, ?, ?)", [
      Number(body.flight_id),
      Number(body.economy_price),
      Number(body.business_price),
      Number(body.first_price)
    ]);
    return created({ flight_id: Number(body.flight_id), seatsGenerated: true });
  } catch (error) {
    return serverError(error);
  }
}

const reportCalls = {
  revenueFlight: "CALL revenue_report_by_flight()",
  revenueMonth: "CALL revenue_report_by_month()",
  loadFactor: "CALL revenue_and_load_factor_report()",
  revenueRoute: "CALL revenue_report_by_route()",
  revenueClass: "CALL revenue_breakdown_by_seat_class()",
  revenueQuarter: "CALL revenue_report_by_quarter()"
} as const;

export async function getReport(kind: keyof typeof reportCalls) {
  try {
    const rows = await callProcedure(reportCalls[kind]);
    return ok({ kind, rows });
  } catch (error) {
    return serverError(error);
  }
}

export function getRevenueFlightReport() {
  return getReport("revenueFlight");
}

export function getRevenueMonthReport() {
  return getReport("revenueMonth");
}

export function getLoadFactorReport() {
  return getReport("loadFactor");
}

export function getRevenueRouteReport() {
  return getReport("revenueRoute");
}

export function getRevenueClassReport() {
  return getReport("revenueClass");
}

export function getRevenueQuarterReport() {
  return getReport("revenueQuarter");
}

export async function getDashboardOverview() {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  try {
    const [kpiRows] = await getPool().query<KpiRow[]>(
      `SELECT
         (SELECT COUNT(*) FROM bookings WHERE status = 'Active') AS active_bookings,
         (SELECT COUNT(DISTINCT t.ticket_id)
          FROM tickets t
          JOIN bookings b ON t.booking_id = b.booking_id
          JOIN payments p ON b.booking_id = p.booking_id
          WHERE b.status = 'Active' AND p.status = 'SUCCESS') AS tickets_sold,
         (SELECT COALESCE(SUM(fls.price), 0)
          FROM tickets t
          JOIN bookings b ON t.booking_id = b.booking_id
          JOIN payments p ON b.booking_id = p.booking_id
          JOIN flight_seats fls ON t.flight_id = fls.flight_id AND t.seat_number = fls.seat_number
          WHERE b.status = 'Active' AND p.status = 'SUCCESS') AS total_revenue,
         (SELECT COUNT(*) FROM flights WHERE status = 'Scheduled') AS scheduled_flights,
         (SELECT COUNT(*) FROM staff_registration_requests WHERE status = 'Pending') AS pending_approvals,
         (SELECT COUNT(*) FROM users WHERE role = 'Customer' AND status = 'Active') AS active_customers,
         (SELECT ROUND(COALESCE(AVG(lf_pct), 0), 2)
          FROM (
            SELECT
              CASE WHEN COUNT(DISTINCT fls.seat_number) = 0 THEN 0
                   ELSE COUNT(DISTINCT CASE
                          WHEN b.status = 'Active' AND p.status = 'SUCCESS' THEN t.ticket_id
                        END) * 100.0 / COUNT(DISTINCT fls.seat_number)
              END AS lf_pct
            FROM flights f
            LEFT JOIN flight_seats fls ON f.flight_id = fls.flight_id
            LEFT JOIN tickets t ON t.flight_id = f.flight_id
            LEFT JOIN bookings b ON t.booking_id = b.booking_id
            LEFT JOIN payments p ON b.booking_id = p.booking_id
            GROUP BY f.flight_id
          ) lf_stats) AS avg_load_factor`
    );

    const [monthlyRevenue, seatClass, topRoutes, loadFactor] = await Promise.all([
      callProcedure("CALL revenue_report_by_month()"),
      callProcedure("CALL revenue_breakdown_by_seat_class()"),
      callProcedure("CALL revenue_report_by_route()"),
      callProcedure("CALL revenue_and_load_factor_report()")
    ]);

    const routes = (topRoutes as Record<string, unknown>[])
      .map((row) => ({
        route: `${row.dep_airport} → ${row.arr_airport}`,
        revenue: Number(row.route_revenue ?? 0),
        tickets: Number(row.tickets_sold ?? 0)
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    const loadFactorTop = (loadFactor as Record<string, unknown>[])
      .filter((row) => Number(row.sold_seats ?? 0) > 0 && Number(row.total_seats ?? 0) > 0)
      .map((row) => ({
        label: `${row.flight_number} (${row.dep_airport}→${row.arr_airport})`,
        loadFactor: Number(row.load_factor_percent ?? 0),
        soldSeats: Number(row.sold_seats ?? 0),
        totalSeats: Number(row.total_seats ?? 0),
        revenue: Number(row.total_revenue ?? 0)
      }))
      .sort((a, b) => b.loadFactor - a.loadFactor)
      .slice(0, 6);

    const monthly = (monthlyRevenue as Record<string, unknown>[]).map((row) => ({
      month: String(row.revenue_month ?? ""),
      airline: String(row.airline_id ?? ""),
      revenue: Number(row.monthly_revenue ?? 0),
      tickets: Number(row.tickets_sold ?? 0)
    }));

    const byClass = (seatClass as Record<string, unknown>[]).map((row) => ({
      name: String(row.class_name ?? ""),
      value: Number(row.class_revenue ?? 0),
      tickets: Number(row.tickets_sold ?? 0),
      percent: Number(row.revenue_percentage ?? 0)
    }));

    const monthlyTotals = Object.values(
      monthly.reduce<Record<string, { month: string; revenue: number; tickets: number }>>((acc, row) => {
        if (!acc[row.month]) acc[row.month] = { month: row.month, revenue: 0, tickets: 0 };
        acc[row.month].revenue += row.revenue;
        acc[row.month].tickets += row.tickets;
        return acc;
      }, {})
    ).sort((a, b) => a.month.localeCompare(b.month));

    return ok({
      kpis: kpiRows[0] ?? {},
      monthlyRevenue: monthlyTotals,
      revenueByAirline: monthly,
      seatClass: byClass,
      topRoutes: routes,
      loadFactorTop
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function getAllBookings() {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  try {
    const rows = await callProcedure("CALL get_all_bookings_for_staff()");
    return ok({ bookings: rows });
  } catch (error) {
    return serverError(error);
  }
}

export async function getStaffBookingDetail(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const parsed = requiredParams(request, ["booking_id"]);
  if (parsed.error || !parsed.values) return parsed.error;

  const bookingId = Number(parsed.values.get("booking_id"));
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    return badRequest("Invalid booking_id");
  }

  try {
    const [legs, timeline] = await Promise.all([
      callProcedure("CALL get_booking_legs_for_staff(?)", [bookingId]),
      callProcedure("CALL get_booking_activity_log(?)", [bookingId])
    ]);

    if (!Array.isArray(legs) || legs.length === 0) {
      return badRequest("Booking not found");
    }

    const first = legs[0] as Record<string, unknown>;
    return ok({
      summary: {
        booking_id: first.booking_id,
        user_id: first.user_id,
        customer_name: first.customer_name,
        customer_email: first.customer_email,
        itinerary_id: first.itinerary_id,
        trip_type: first.trip_type,
        departure_airport_code: first.departure_airport_code,
        arrival_airport_code: first.arrival_airport_code,
        booking_time: first.booking_time,
        status: first.status,
        payment_id: first.payment_id,
        amount: first.amount,
        payment_method: first.payment_method,
        payment_status: first.payment_status,
        payment_time: first.payment_time
      },
      legs,
      timeline
    });
  } catch (error) {
    return serverError(error);
  }
}
