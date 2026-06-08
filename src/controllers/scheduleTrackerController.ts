import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "@/config/db";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";
import { badRequest, forbidden, ok, unauthorized } from "./http";

async function requireStaffSession() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized(), user: null };
  if (!isStaffRole(user.role)) return { error: forbidden("Staff access required"), user: null };
  return { error: null, user };
}

export type TrackerDateRange = {
  startDate: string | null;
  endDate: string | null;
};

function parseTrackerDateRange(start: string | null, end: string | null) {
  const startDate = start?.trim() || null;
  const endDate = end?.trim() || null;
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;

  if (!startDate && !endDate) {
    return { ok: true as const, range: { startDate: null, endDate: null } satisfies TrackerDateRange };
  }
  if (startDate && !isoDate.test(startDate)) {
    return { ok: false as const, error: badRequest("Start date must be YYYY-MM-DD.") };
  }
  if (endDate && !isoDate.test(endDate)) {
    return { ok: false as const, error: badRequest("End date must be YYYY-MM-DD.") };
  }
  if (startDate && endDate && startDate > endDate) {
    return { ok: false as const, error: badRequest("Start date must be on or before end date.") };
  }

  return {
    ok: true as const,
    range: { startDate, endDate } satisfies TrackerDateRange
  };
}

function flightDateSql(alias: string, range: TrackerDateRange) {
  const clauses: string[] = [];
  const params: string[] = [];
  if (range.startDate) {
    clauses.push(`${alias}.flight_date >= ?`);
    params.push(range.startDate);
  }
  if (range.endDate) {
    clauses.push(`${alias}.flight_date <= ?`);
    params.push(range.endDate);
  }
  return { sql: clauses.join(" AND "), params };
}

function hasDateFilter(range: TrackerDateRange) {
  return Boolean(range.startDate || range.endDate);
}

export async function listTrackerLegs(range: TrackerDateRange = { startDate: null, endDate: null }) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const flightFilter = flightDateSql("f2", range);
  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (hasDateFilter(range)) {
    const overlapStart = range.startDate ?? range.endDate!;
    const overlapEnd = range.endDate ?? range.startDate!;
    whereParts.push(`(
      (fs.valid_from <= ? AND fs.valid_to >= ?)
      OR EXISTS (
        SELECT 1
        FROM flights f2
        WHERE f2.schedule_id = fs.schedule_id
          AND f2.status = 'Scheduled'
          ${flightFilter.sql ? `AND ${flightFilter.sql}` : ""}
      )
    )`);
    params.push(overlapEnd, overlapStart, ...flightFilter.params);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       fs.schedule_id,
       fs.flight_number,
       fs.airline_id,
       al.airline_name,
       fs.dep_airport,
       fs.arr_airport,
       CONCAT(fs.dep_airport, ' → ', fs.arr_airport) AS route,
       TIME_FORMAT(fs.dep_time, '%H:%i') AS dep_time,
       TIME_FORMAT(fs.arr_time, '%H:%i') AS arr_time,
       fs.valid_from,
       fs.valid_to,
       COALESCE(sd.operating_days, '—') AS operating_days,
       COALESCE(link.itinerary_ids, '—') AS linked_itineraries,
       COALESCE(fc.generated_flight_count, 0) AS generated_flights,
       fc.first_flight_date,
       fc.last_flight_date
     FROM flight_schedules fs
     JOIN airlines al ON fs.airline_id = al.airline_id
     LEFT JOIN (
       SELECT
         schedule_id,
         GROUP_CONCAT(day_of_week ORDER BY FIELD(day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN') SEPARATOR ', ') AS operating_days
       FROM schedule_days
       GROUP BY schedule_id
     ) sd ON sd.schedule_id = fs.schedule_id
     LEFT JOIN (
       SELECT
         jt.schedule_id,
         GROUP_CONCAT(DISTINCT i.itinerary_id ORDER BY i.itinerary_id SEPARATOR ', ') AS itinerary_ids
       FROM itineraries i
       INNER JOIN JSON_TABLE(
         i.leg_schedule_ids,
         '$[*]' COLUMNS (schedule_id INT PATH '$')
       ) jt
       WHERE i.leg_schedule_ids IS NOT NULL
       GROUP BY jt.schedule_id
     ) link ON link.schedule_id = fs.schedule_id
     LEFT JOIN (
       SELECT
         schedule_id,
         COUNT(*) AS generated_flight_count,
         MIN(flight_date) AS first_flight_date,
         MAX(flight_date) AS last_flight_date
       FROM flights
       WHERE status = 'Scheduled'
       GROUP BY schedule_id
     ) fc ON fc.schedule_id = fs.schedule_id
     ${whereClause}
     ORDER BY fs.schedule_id`,
    params
  );

  return ok({ rows, view: "legs", dateRange: range });
}

export async function listTrackerItineraries(range: TrackerDateRange = { startDate: null, endDate: null }) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const flightFilter = flightDateSql("f2", range);
  const whereParts: string[] = [];
  const params: unknown[] = [];

  if (hasDateFilter(range)) {
    const overlapStart = range.startDate ?? range.endDate!;
    const overlapEnd = range.endDate ?? range.startDate!;
    whereParts.push(`(
      EXISTS (
        SELECT 1
        FROM flights f2
        WHERE f2.itinerary_id = i.itinerary_id
          AND f2.status = 'Scheduled'
          ${flightFilter.sql ? `AND ${flightFilter.sql}` : ""}
      )
      OR (
        i.leg_schedule_ids IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM JSON_TABLE(
            i.leg_schedule_ids,
            '$[*]' COLUMNS (schedule_id INT PATH '$')
          ) jt
          INNER JOIN flight_schedules fs2 ON fs2.schedule_id = jt.schedule_id
          WHERE fs2.valid_from <= ? AND fs2.valid_to >= ?
        )
      )
    )`);
    params.push(...flightFilter.params, overlapEnd, overlapStart);
  }

  const whereClause = whereParts.length ? `WHERE ${whereParts.join(" AND ")}` : "";

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       i.itinerary_id,
       i.trip_type,
       i.departure_airport_code,
       i.arrival_airport_code,
       CONCAT(i.departure_airport_code, ' → ', i.arrival_airport_code) AS endpoints,
       i.created_at,
       COALESCE(sl.route_label, CONCAT(i.departure_airport_code, ' → ', i.arrival_airport_code)) AS route_label,
       COALESCE(sl.leg_summary, '—') AS leg_summary,
       COALESCE(sl.schedule_leg_count, 0) AS schedule_legs,
       COALESCE(days.operating_days, '—') AS operating_days,
       COALESCE(gen.generated_flight_count, 0) AS generated_flights,
       gen.first_flight_date,
       gen.last_flight_date
     FROM itineraries i
     LEFT JOIN (
       SELECT
         i2.itinerary_id,
         COUNT(*) AS schedule_leg_count,
         CONCAT(
           MIN(CASE WHEN jt.ord = 1 THEN fs.dep_airport END),
           ' → ',
           GROUP_CONCAT(fs.arr_airport ORDER BY jt.ord SEPARATOR ' → ')
         ) AS route_label,
         GROUP_CONCAT(
           CONCAT(fs.dep_airport, '→', fs.arr_airport, ' (', fs.flight_number, ')')
           ORDER BY jt.ord SEPARATOR ' · '
         ) AS leg_summary
       FROM itineraries i2
       INNER JOIN JSON_TABLE(
         i2.leg_schedule_ids,
         '$[*]' COLUMNS (
           ord FOR ORDINALITY,
           schedule_id INT PATH '$'
         )
       ) jt
       INNER JOIN flight_schedules fs ON fs.schedule_id = jt.schedule_id
       WHERE i2.leg_schedule_ids IS NOT NULL
       GROUP BY i2.itinerary_id
     ) sl ON sl.itinerary_id = i.itinerary_id
     LEFT JOIN (
       SELECT
         i3.itinerary_id,
         GROUP_CONCAT(sd.day_of_week ORDER BY FIELD(sd.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN') SEPARATOR ', ') AS operating_days
       FROM itineraries i3
       INNER JOIN JSON_TABLE(
         i3.leg_schedule_ids,
         '$[0]' COLUMNS (first_schedule_id INT PATH '$')
       ) first_leg
       INNER JOIN schedule_days sd ON sd.schedule_id = first_leg.first_schedule_id
       WHERE i3.leg_schedule_ids IS NOT NULL
       GROUP BY i3.itinerary_id
     ) days ON days.itinerary_id = i.itinerary_id
     LEFT JOIN (
       SELECT
         itinerary_id,
         COUNT(*) AS generated_flight_count,
         MIN(flight_date) AS first_flight_date,
         MAX(flight_date) AS last_flight_date
       FROM flights
       WHERE status = 'Scheduled'
       GROUP BY itinerary_id
     ) gen ON gen.itinerary_id = i.itinerary_id
     ${whereClause}
     ORDER BY i.itinerary_id`,
    params
  );

  return ok({ rows, view: "itineraries", dateRange: range });
}

export async function listTrackerFlights(range: TrackerDateRange = { startDate: null, endDate: null }) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const flightFilter = flightDateSql("f", range);
  const whereClause = flightFilter.sql ? `WHERE ${flightFilter.sql}` : "";

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       f.flight_id,
       f.itinerary_id,
       f.schedule_id,
       fs.flight_number,
       fs.airline_id,
       al.airline_name,
       fs.dep_airport,
       fs.arr_airport,
       CONCAT(fs.dep_airport, ' → ', fs.arr_airport) AS route,
       f.flight_date,
       TIME_FORMAT(fs.dep_time, '%H:%i') AS dep_time,
       TIME_FORMAT(fs.arr_time, '%H:%i') AS arr_time,
       f.segment_order,
       f.leg_type,
       f.status,
       i.trip_type,
       ac.aircraft_id,
       ac.model AS aircraft_model,
       COALESCE(seat_stats.available_seats, 0) AS available_seats,
       COALESCE(seat_stats.total_seats, 0) AS total_seats
     FROM flights f
     JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
     JOIN airlines al ON fs.airline_id = al.airline_id
     JOIN aircraft ac ON f.aircraft_id = ac.aircraft_id
     JOIN itineraries i ON f.itinerary_id = i.itinerary_id
     LEFT JOIN (
       SELECT
         flight_id,
         SUM(CASE WHEN is_available = 1 THEN 1 ELSE 0 END) AS available_seats,
         COUNT(*) AS total_seats
       FROM flight_seats
       GROUP BY flight_id
     ) seat_stats ON seat_stats.flight_id = f.flight_id
     ${whereClause}
     ORDER BY f.flight_date DESC, fs.flight_number, f.segment_order`,
    flightFilter.params
  );

  return ok({ rows, view: "flights", dateRange: range });
}

export async function getTrackerScheduleDetail(scheduleId: number) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  if (!Number.isFinite(scheduleId) || scheduleId <= 0) {
    return badRequest("Invalid schedule ID.");
  }

  const [scheduleRows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       fs.*,
       al.airline_name,
       TIME_FORMAT(fs.dep_time, '%H:%i') AS dep_time_fmt,
       TIME_FORMAT(fs.arr_time, '%H:%i') AS arr_time_fmt
     FROM flight_schedules fs
     JOIN airlines al ON fs.airline_id = al.airline_id
     WHERE fs.schedule_id = ?`,
    [scheduleId]
  );

  if (!scheduleRows[0]) {
    return badRequest("Schedule not found.");
  }

  const [dayRows] = await getPool().query<RowDataPacket[]>(
    `SELECT day_of_week
     FROM schedule_days
     WHERE schedule_id = ?
     ORDER BY FIELD(day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')`,
    [scheduleId]
  );

  const [itineraryRows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       i.itinerary_id,
       i.trip_type,
       i.departure_airport_code,
       i.arrival_airport_code,
       jt.ord AS leg_index
     FROM itineraries i
     INNER JOIN JSON_TABLE(
       i.leg_schedule_ids,
       '$[*]' COLUMNS (
         ord FOR ORDINALITY,
         schedule_id INT PATH '$'
       )
     ) jt ON jt.schedule_id = ?
     WHERE i.leg_schedule_ids IS NOT NULL
     ORDER BY i.itinerary_id, jt.ord`,
    [scheduleId]
  );

  const [flightRows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       f.flight_id,
       f.flight_date,
       f.itinerary_id,
       f.segment_order,
       f.status,
       ac.model AS aircraft_model
     FROM flights f
     JOIN aircraft ac ON f.aircraft_id = ac.aircraft_id
     WHERE f.schedule_id = ?
     ORDER BY f.flight_date DESC, f.segment_order
     LIMIT 50`,
    [scheduleId]
  );

  return ok({
    schedule: scheduleRows[0],
    operating_days: dayRows.map((row) => String(row.day_of_week)),
    linked_itineraries: itineraryRows,
    generated_flights: flightRows
  });
}

export async function getScheduleTracker(view: string, startDate: string | null, endDate: string | null) {
  const parsed = parseTrackerDateRange(startDate, endDate);
  if (!parsed.ok) return parsed.error;

  const { range } = parsed;
  if (view === "itineraries") return listTrackerItineraries(range);
  if (view === "flights") return listTrackerFlights(range);
  return listTrackerLegs(range);
}
