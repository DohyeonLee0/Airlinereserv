import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { callProcedure, getPool } from "@/config/db";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";
import { badRequest, conflict, created, forbidden, ok, readJson, serverError, unauthorized } from "./http";

async function requireStaffSession() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized(), user: null };
  if (!isStaffRole(user.role)) return { error: forbidden("Staff access required"), user: null };
  return { error: null, user };
}

async function renameAirlineCode(
  oldId: string,
  newId: string,
  airlineName: string,
  country: string | null
) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [original] = await connection.query<RowDataPacket[]>(
      "SELECT airline_id FROM airlines WHERE airline_id = ?",
      [oldId]
    );
    if (!original.length) {
      await connection.rollback();
      return { error: badRequest(`Airline ${oldId} was not found.`) };
    }

    if (oldId !== newId) {
      const [duplicate] = await connection.query<RowDataPacket[]>(
        "SELECT airline_id FROM airlines WHERE airline_id = ?",
        [newId]
      );
      if (duplicate.length) {
        await connection.rollback();
        return { error: conflict(`Airline code ${newId} is already in use.`, "DUPLICATE_AIRLINE_CODE") };
      }

      await connection.query("SET FOREIGN_KEY_CHECKS=0");
      await connection.query("UPDATE aircraft SET airline_id = ? WHERE airline_id = ?", [newId, oldId]);
      await connection.query("UPDATE flight_schedules SET airline_id = ? WHERE airline_id = ?", [newId, oldId]);
      await connection.query(
        "UPDATE airlines SET airline_id = ?, airline_name = ?, country = ? WHERE airline_id = ?",
        [newId, airlineName, country, oldId]
      );
      await connection.query("SET FOREIGN_KEY_CHECKS=1");
    } else {
      await connection.query(
        "UPDATE airlines SET airline_name = ?, country = ? WHERE airline_id = ?",
        [airlineName, country, oldId]
      );
    }

    await connection.commit();
    return { error: null, airlineId: newId, renamed: oldId !== newId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function renameAirportCode(
  oldCode: string,
  newCode: string,
  airportName: string,
  city: string,
  country: string
) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    const [original] = await connection.query<RowDataPacket[]>(
      "SELECT airport_code FROM airports WHERE airport_code = ?",
      [oldCode]
    );
    if (!original.length) {
      await connection.rollback();
      return { error: badRequest(`Airport ${oldCode} was not found.`) };
    }

    if (oldCode !== newCode) {
      const [duplicate] = await connection.query<RowDataPacket[]>(
        "SELECT airport_code FROM airports WHERE airport_code = ?",
        [newCode]
      );
      if (duplicate.length) {
        await connection.rollback();
        return { error: conflict(`Airport code ${newCode} is already in use.`, "DUPLICATE_AIRPORT_CODE") };
      }

      await connection.query("SET FOREIGN_KEY_CHECKS=0");
      await connection.query("UPDATE flight_schedules SET dep_airport = ? WHERE dep_airport = ?", [newCode, oldCode]);
      await connection.query("UPDATE flight_schedules SET arr_airport = ? WHERE arr_airport = ?", [newCode, oldCode]);
      await connection.query(
        "UPDATE itineraries SET departure_airport_code = ? WHERE departure_airport_code = ?",
        [newCode, oldCode]
      );
      await connection.query(
        "UPDATE itineraries SET arrival_airport_code = ? WHERE arrival_airport_code = ?",
        [newCode, oldCode]
      );
      await connection.query("UPDATE promotions SET dep_airport = ? WHERE dep_airport = ?", [newCode, oldCode]);
      await connection.query("UPDATE promotions SET arr_airport = ? WHERE arr_airport = ?", [newCode, oldCode]);
      await connection.query(
        "UPDATE airports SET airport_code = ?, airport_name = ?, city = ?, country = ? WHERE airport_code = ?",
        [newCode, airportName, city, country, oldCode]
      );
      await connection.query("SET FOREIGN_KEY_CHECKS=1");
    } else {
      await connection.query(
        "UPDATE airports SET airport_name = ?, city = ?, country = ? WHERE airport_code = ?",
        [airportName, city, country, oldCode]
      );
    }

    await connection.commit();
    return { error: null, airportCode: newCode, renamed: oldCode !== newCode };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export async function listAirlines() {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const [rows] = await getPool().query("SELECT * FROM airlines ORDER BY airline_id");
  return ok({ rows });
}

export async function upsertAirline(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  const missing = ["airline_id", "airline_name"].filter((k) => !body[k]);
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  try {
    const airlineId = String(body.airline_id).trim().toUpperCase();
    const originalAirlineId = body.original_airline_id
      ? String(body.original_airline_id).trim().toUpperCase()
      : null;
    const airlineName = String(body.airline_name);
    const country = body.country ? String(body.country) : null;

    if (originalAirlineId) {
      const result = await renameAirlineCode(originalAirlineId, airlineId, airlineName, country);
      if (result.error) return result.error;
      return NextResponse.json({
        success: true,
        data: { airline_id: result.airlineId, updated: true, renamed: result.renamed },
        message: result.renamed
          ? "Airline code renamed. Linked aircraft and schedules were updated."
          : "Airline updated."
      });
    }

    const [existing] = await getPool().query<RowDataPacket[]>(
      "SELECT airline_id FROM airlines WHERE airline_id = ?",
      [airlineId]
    );
    await callProcedure("CALL upsert_airline(?, ?, ?)", [airlineId, airlineName, country]);
    if (existing.length) {
      return NextResponse.json({
        success: true,
        data: { airline_id: airlineId, updated: true },
        message: "Airline updated."
      });
    }
    return NextResponse.json(
      {
        success: true,
        data: { airline_id: airlineId, updated: false },
        message: "Airline created."
      },
      { status: 201 }
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function deleteAirline(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  if (!body.airline_id) return badRequest("Missing field(s): airline_id");
  try {
    await callProcedure("CALL delete_airline(?)", [String(body.airline_id)]);
    return ok({ deleted: body.airline_id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const dbError = error as { errno?: number; code?: string };
    if (
      dbError.errno === 1451 ||
      dbError.code === "ER_ROW_IS_REFERENCED_2" ||
      /foreign key constraint|Cannot delete or update a parent row/i.test(message)
    ) {
      return conflict(
        "This airline cannot be deleted because it is already in use.",
        "AIRLINE_IN_USE"
      );
    }
    return serverError(error);
  }
}

export async function listAirports() {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const [rows] = await getPool().query("SELECT * FROM airports ORDER BY airport_code");
  return ok({ rows });
}

export async function upsertAirport(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  const missing = ["airport_code", "airport_name", "city", "country"].filter((k) => !body[k]);
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  try {
    const airportCode = String(body.airport_code).trim().toUpperCase();
    const originalAirportCode = body.original_airport_code
      ? String(body.original_airport_code).trim().toUpperCase()
      : null;
    const airportName = String(body.airport_name);
    const city = String(body.city);
    const country = String(body.country);

    if (originalAirportCode) {
      const result = await renameAirportCode(
        originalAirportCode,
        airportCode,
        airportName,
        city,
        country
      );
      if (result.error) return result.error;
      return NextResponse.json({
        success: true,
        data: { airport_code: result.airportCode, updated: true, renamed: result.renamed },
        message: result.renamed
          ? "Airport code renamed. Linked schedules and routes were updated."
          : "Airport updated."
      });
    }

    const [existing] = await getPool().query<RowDataPacket[]>(
      "SELECT airport_code FROM airports WHERE airport_code = ?",
      [airportCode]
    );
    await callProcedure("CALL upsert_airport(?, ?, ?, ?)", [
      airportCode,
      airportName,
      city,
      country
    ]);
    if (existing.length) {
      return NextResponse.json({
        success: true,
        data: { airport_code: airportCode, updated: true },
        message: "Airport updated."
      });
    }
    return NextResponse.json(
      {
        success: true,
        data: { airport_code: airportCode, updated: false },
        message: "Airport created."
      },
      { status: 201 }
    );
  } catch (error) {
    return serverError(error);
  }
}

export async function deleteAirport(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  if (!body.airport_code) return badRequest("Missing field(s): airport_code");
  try {
    await callProcedure("CALL delete_airport(?)", [String(body.airport_code)]);
    return ok({ deleted: body.airport_code });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const dbError = error as { errno?: number; code?: string };
    if (
      dbError.errno === 1451 ||
      dbError.code === "ER_ROW_IS_REFERENCED_2" ||
      /foreign key constraint|Cannot delete or update a parent row/i.test(message)
    ) {
      return conflict(
        "This airport cannot be deleted because it is already in use.",
        "AIRPORT_IN_USE"
      );
    }
    return serverError(error);
  }
}

export async function listAircraft() {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const [rows] = await getPool().query(
    `SELECT
       a.*,
       al.airline_name,
       COALESCE(seat_stats.configured_seats, 0) AS configured_seats,
       COALESCE(seat_stats.first_seats, 0) AS first_seats,
       COALESCE(seat_stats.business_seats, 0) AS business_seats,
       COALESCE(seat_stats.economy_seats, 0) AS economy_seats
     FROM aircraft a
     JOIN airlines al ON a.airline_id = al.airline_id
     LEFT JOIN (
       SELECT
         aircraft_id,
         COUNT(*) AS configured_seats,
         SUM(CASE WHEN class_id = 3 THEN 1 ELSE 0 END) AS first_seats,
         SUM(CASE WHEN class_id = 2 THEN 1 ELSE 0 END) AS business_seats,
         SUM(CASE WHEN class_id = 1 THEN 1 ELSE 0 END) AS economy_seats
       FROM aircraft_seats
       GROUP BY aircraft_id
     ) seat_stats ON seat_stats.aircraft_id = a.aircraft_id
     ORDER BY a.aircraft_id`
  );
  return ok({ rows });
}

export async function getAircraftDetail(aircraftId: number) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  if (!Number.isFinite(aircraftId) || aircraftId <= 0) {
    return badRequest("Invalid aircraft ID.");
  }

  const [aircraftRows] = await getPool().query<RowDataPacket[]>(
    `SELECT a.*, al.airline_name
     FROM aircraft a
     JOIN airlines al ON a.airline_id = al.airline_id
     WHERE a.aircraft_id = ?`,
    [aircraftId]
  );

  if (!aircraftRows[0]) {
    return badRequest("Aircraft not found.");
  }

  const [seatRows] = await getPool().query<RowDataPacket[]>(
    `SELECT seat_number, class_id
     FROM aircraft_seats
     WHERE aircraft_id = ?
     ORDER BY seat_number`,
    [aircraftId]
  );

  return ok({
    aircraft: aircraftRows[0],
    seats: seatRows
  });
}

export async function upsertAircraft(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  const missing = ["aircraft_id", "airline_id", "model"].filter((k) => body[k] === undefined || body[k] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  const aircraftId = Number(body.aircraft_id);
  const seats = Array.isArray(body.seats) ? body.seats : [];
  if (seats.length === 0) {
    return badRequest("Configure at least one seat in the layout before saving.");
  }

  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    await connection.query("CALL upsert_aircraft(?, ?, ?, ?)", [
      aircraftId,
      String(body.airline_id),
      String(body.model),
      Number(body.capacity ?? seats.length)
    ]);

    await connection.query("CALL replace_aircraft_seats(?, ?)", [aircraftId, JSON.stringify(seats)]);

    await connection.commit();
    return created({
      aircraft_id: aircraftId,
      seat_count: seats.length
    });
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message : "Failed to save aircraft.";
    if (/foreign key constraint|Cannot delete or update a parent row/i.test(message)) {
      return conflict(
        "Seat layout could not be replaced because this aircraft is already used on generated flights. Keep existing seat numbers or remove those flights first.",
        "AIRCRAFT_SEATS_IN_USE"
      );
    }
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function listSchedules() {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const [rows] = await getPool().query(
    `SELECT
       fs.*,
       al.airline_name,
       COALESCE(gen.generated_flight_count, 0) AS generated_flight_count,
       COALESCE(
         sd.operating_days,
         JSON_ARRAY('MON', 'WED', 'FRI')
       ) AS operating_days
     FROM flight_schedules fs
     JOIN airlines al ON fs.airline_id = al.airline_id
     LEFT JOIN (
       SELECT
         schedule_id,
         JSON_ARRAYAGG(
           day_of_week
           ORDER BY FIELD(day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')
         ) AS operating_days
       FROM schedule_days
       GROUP BY schedule_id
     ) sd ON sd.schedule_id = fs.schedule_id
     LEFT JOIN (
       SELECT schedule_id, COUNT(*) AS generated_flight_count
       FROM flights
       GROUP BY schedule_id
     ) gen ON gen.schedule_id = fs.schedule_id
     ORDER BY fs.schedule_id`
  );
  return ok({ rows });
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

function normalizeOperatingDays(value: unknown): string[] {
  if (!Array.isArray(value)) return ["MON", "WED", "FRI"];
  const days = value
    .map((day) => String(day).trim().toUpperCase())
    .filter((day) => WEEKDAYS.includes(day as (typeof WEEKDAYS)[number]));
  return days.length ? days : ["MON", "WED", "FRI"];
}

function layoverMinutes(previousArrTime: string, nextDepTime: string) {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return toMinutes(nextDepTime) - toMinutes(previousArrTime);
}

export async function listConnectingItineraries() {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const [rows] = await getPool().query(
    `SELECT
       i.itinerary_id,
       i.trip_type,
       i.departure_airport_code,
       i.arrival_airport_code,
       i.created_at,
       COALESCE(gen.generated_flight_count, 0) AS generated_leg_count,
       COALESCE(sl.schedule_leg_count, 0) AS schedule_leg_count,
       COALESCE(
         sl.route_label,
         CONCAT(i.departure_airport_code, ' → ', i.arrival_airport_code)
       ) AS route_label,
       sl.leg_summary,
       i.leg_schedule_ids,
       COALESCE(
         od.operating_days,
         JSON_ARRAY('MON', 'WED', 'FRI')
       ) AS operating_days
     FROM itineraries i
     LEFT JOIN (
       SELECT
         i2.itinerary_id,
         JSON_ARRAYAGG(
           sd.day_of_week
           ORDER BY FIELD(sd.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')
         ) AS operating_days
       FROM itineraries i2
       INNER JOIN schedule_days sd ON sd.schedule_id = CAST(
         JSON_UNQUOTE(JSON_EXTRACT(i2.leg_schedule_ids, '$[0]'))
         AS UNSIGNED
       )
       WHERE i2.leg_schedule_ids IS NOT NULL
       GROUP BY i2.itinerary_id
     ) od ON od.itinerary_id = i.itinerary_id
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
       SELECT itinerary_id, COUNT(*) AS generated_flight_count
       FROM flights
       GROUP BY itinerary_id
     ) gen ON gen.itinerary_id = i.itinerary_id
     WHERE i.trip_type = 'Connecting'
     ORDER BY i.itinerary_id`
  );
  return ok({ rows });
}

export async function getConnectingItineraryDetail(itineraryId: number) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  if (!Number.isFinite(itineraryId) || itineraryId <= 0) {
    return badRequest("Invalid itinerary ID.");
  }

  const [itineraryRows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       itinerary_id,
       trip_type,
       departure_airport_code,
       arrival_airport_code,
       leg_schedule_ids
     FROM itineraries
     WHERE itinerary_id = ?`,
    [itineraryId]
  );

  const itinerary = itineraryRows[0];
  if (!itinerary || itinerary.trip_type !== "Connecting") {
    return badRequest("Connecting itinerary not found.");
  }

  const [legRows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       fs.schedule_id,
       fs.airline_id,
       fs.flight_number,
       fs.dep_airport,
       fs.arr_airport,
       fs.dep_time,
       fs.arr_time,
       fs.valid_from,
       fs.valid_to,
       jt.ord AS leg_index
     FROM itineraries i
     INNER JOIN JSON_TABLE(
       i.leg_schedule_ids,
       '$[*]' COLUMNS (
         ord FOR ORDINALITY,
         schedule_id INT PATH '$'
       )
     ) jt
     INNER JOIN flight_schedules fs ON fs.schedule_id = jt.schedule_id
     WHERE i.itinerary_id = ?
     ORDER BY jt.ord`,
    [itineraryId]
  );

  const [dayRows] = await getPool().query<RowDataPacket[]>(
    `SELECT sd.day_of_week
     FROM schedule_days sd
     WHERE sd.schedule_id = CAST(
       JSON_UNQUOTE(JSON_EXTRACT(
         (SELECT leg_schedule_ids FROM itineraries WHERE itinerary_id = ?),
         '$[0]'
       )) AS UNSIGNED
     )
     ORDER BY FIELD(sd.day_of_week, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')`,
    [itineraryId]
  );

  return ok({
    itinerary,
    legs: legRows,
    operating_days: dayRows.map((row) => String(row.day_of_week))
  });
}

export async function deleteConnectingItinerary(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const body = await readJson(request);
  if (!body.itinerary_id) return badRequest("Missing field(s): itinerary_id");

  const itineraryId = Number(body.itinerary_id);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [itineraryRows] = await connection.query<RowDataPacket[]>(
      "SELECT trip_type FROM itineraries WHERE itinerary_id = ? FOR UPDATE",
      [itineraryId]
    );
    if (!itineraryRows[0]) {
      await connection.rollback();
      return badRequest("Itinerary not found.");
    }
    if (itineraryRows[0].trip_type !== "Connecting") {
      await connection.rollback();
      return badRequest("Only Connecting itineraries can be deleted from this screen.");
    }

    const [bookingRows] = await connection.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM bookings WHERE itinerary_id = ?",
      [itineraryId]
    );
    if (Number(bookingRows[0]?.count ?? 0) > 0) {
      await connection.rollback();
      return conflict("This itinerary has bookings and cannot be deleted.", "ITINERARY_IN_USE");
    }

    const [flightRows] = await connection.query<RowDataPacket[]>(
      "SELECT flight_id FROM flights WHERE itinerary_id = ?",
      [itineraryId]
    );
    const flightIds = flightRows.map((row) => Number(row.flight_id));

    if (flightIds.length > 0) {
      const placeholders = flightIds.map(() => "?").join(",");
      await connection.query(`DELETE FROM seat_holds WHERE flight_id IN (${placeholders})`, flightIds);
      await connection.query(`DELETE FROM flight_seats WHERE flight_id IN (${placeholders})`, flightIds);
      await connection.query("DELETE FROM flights WHERE itinerary_id = ?", [itineraryId]);
    }

    await connection.query("DELETE FROM itineraries WHERE itinerary_id = ?", [itineraryId]);
    await connection.commit();
    return ok({ deleted: itineraryId, removed_flights: flightIds.length });
  } catch (error) {
    await connection.rollback();
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function upsertConnectingRoute(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const body = await readJson(request);
  const legs = Array.isArray(body.legs) ? body.legs : [];
  if (legs.length < 2) return badRequest("Connecting routes require at least 2 legs.");

  const requiredTop = ["itinerary_id", "departure_airport_code", "arrival_airport_code", "valid_from", "valid_to"];
  const missingTop = requiredTop.filter((key) => body[key] === undefined || body[key] === "");
  if (missingTop.length) return badRequest(`Missing field(s): ${missingTop.join(", ")}`);

  const departureAirport = String(body.departure_airport_code);
  const arrivalAirport = String(body.arrival_airport_code);
  const operatingDays = normalizeOperatingDays(body.operating_days);

  if (departureAirport === arrivalAirport) {
    return badRequest("Departure and arrival airports must be different.");
  }

  const normalizedLegs = [];
  for (let index = 0; index < legs.length; index += 1) {
    const leg = legs[index];
    const requiredLeg = [
      "schedule_id",
      "airline_id",
      "flight_number",
      "dep_airport",
      "arr_airport",
      "dep_time",
      "arr_time"
    ];
    const missingLeg = requiredLeg.filter((key) => leg[key] === undefined || leg[key] === "");
    if (missingLeg.length) return badRequest(`Leg ${index + 1} missing field(s): ${missingLeg.join(", ")}`);

    normalizedLegs.push({
      schedule_id: Number(leg.schedule_id),
      airline_id: String(leg.airline_id),
      flight_number: String(leg.flight_number).trim(),
      dep_airport: String(leg.dep_airport),
      arr_airport: String(leg.arr_airport),
      dep_time: String(leg.dep_time),
      arr_time: String(leg.arr_time)
    });
  }

  if (normalizedLegs[0].dep_airport !== departureAirport) {
    return badRequest("Leg 1 must depart from the route origin airport.");
  }
  if (normalizedLegs.at(-1)?.arr_airport !== arrivalAirport) {
    return badRequest("The final leg must arrive at the route destination airport.");
  }

  for (let index = 0; index < normalizedLegs.length - 1; index += 1) {
    const current = normalizedLegs[index];
    const next = normalizedLegs[index + 1];
    if (current.arr_airport !== next.dep_airport) {
      return badRequest(`Leg ${index + 1} must arrive where leg ${index + 2} departs.`);
    }
    if (layoverMinutes(current.arr_time, next.dep_time) < 60) {
      return badRequest(`Layover between leg ${index + 1} and leg ${index + 2} must be at least 1 hour.`);
    }
  }

  const scheduleIds = normalizedLegs.map((leg) => leg.schedule_id);
  if (new Set(scheduleIds).size !== scheduleIds.length) {
    return badRequest("Each leg needs a unique schedule ID.");
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    await connection.query("CALL upsert_connecting_route(?, ?, ?, ?, ?, ?, ?)", [
      Number(body.itinerary_id),
      departureAirport,
      arrivalAirport,
      String(body.valid_from),
      String(body.valid_to),
      JSON.stringify(normalizedLegs),
      JSON.stringify(operatingDays)
    ]);

    await connection.commit();

    return created({
      itinerary_id: Number(body.itinerary_id),
      departure_airport_code: departureAirport,
      arrival_airport_code: arrivalAirport,
      leg_schedule_ids: scheduleIds,
      leg_count: scheduleIds.length
    });
  } catch (error) {
    await connection.rollback();
    const dbError = error as { sqlState?: string; sqlMessage?: string; message?: string };
    if (dbError.sqlState === "45000") {
      return badRequest(dbError.sqlMessage ?? dbError.message ?? "Invalid connecting route.");
    }
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function upsertSchedule(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  const required = [
    "schedule_id",
    "airline_id",
    "flight_number",
    "dep_airport",
    "arr_airport",
    "dep_time",
    "arr_time",
    "valid_from",
    "valid_to"
  ];
  const missing = required.filter((k) => body[k] === undefined || body[k] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  const scheduleId = Number(body.schedule_id);
  const operatingDays = normalizeOperatingDays(body.operating_days);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();
    await connection.query("CALL upsert_flight_schedule(?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      scheduleId,
      String(body.airline_id),
      String(body.flight_number),
      String(body.dep_airport),
      String(body.arr_airport),
      String(body.dep_time),
      String(body.arr_time),
      String(body.valid_from),
      String(body.valid_to)
    ]);
    await connection.query("DELETE FROM schedule_days WHERE schedule_id = ?", [scheduleId]);
    for (const day of operatingDays) {
      await connection.query("INSERT INTO schedule_days (schedule_id, day_of_week) VALUES (?, ?)", [
        scheduleId,
        day
      ]);
    }
    await connection.commit();
    return created({ schedule_id: scheduleId, operating_days: operatingDays });
  } catch (error) {
    await connection.rollback();
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function listPromotions() {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const [rows] = await getPool().query("SELECT * FROM promotions ORDER BY promo_id");
  return ok({ rows });
}

export async function upsertPromotion(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  const required = [
    "promo_id",
    "promo_code",
    "discount_percent",
    "valid_from",
    "valid_to"
  ];
  const missing = required.filter((k) => body[k] === undefined || body[k] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  try {
    await callProcedure("CALL upsert_promotion(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      Number(body.promo_id),
      String(body.promo_code),
      body.description ? String(body.description) : null,
      body.schedule_id ? Number(body.schedule_id) : null,
      body.dep_airport ? String(body.dep_airport) : null,
      body.arr_airport ? String(body.arr_airport) : null,
      body.class_id ? Number(body.class_id) : null,
      Number(body.discount_percent),
      String(body.valid_from),
      String(body.valid_to),
      body.is_active === undefined ? true : Boolean(body.is_active)
    ]);
    return created({ promo_id: body.promo_id });
  } catch (error) {
    return serverError(error);
  }
}

export async function deactivatePromotion(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  if (!body.promo_id) return badRequest("Missing field(s): promo_id");
  try {
    await callProcedure("CALL deactivate_promotion(?)", [Number(body.promo_id)]);
    return ok({ promo_id: body.promo_id, is_active: false });
  } catch (error) {
    return serverError(error);
  }
}
