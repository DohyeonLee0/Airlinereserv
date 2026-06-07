import { NextRequest } from "next/server";
import { RowDataPacket } from "mysql2/promise";
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
