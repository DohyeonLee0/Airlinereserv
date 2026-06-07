import { NextRequest } from "next/server";
import { callProcedure, getPool } from "@/config/db";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";
import { badRequest, created, forbidden, ok, readJson, serverError, unauthorized } from "./http";

async function requireStaffSession() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized(), user: null };
  if (!isStaffRole(user.role)) return { error: forbidden("Staff access required"), user: null };
  return { error: null, user };
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
    await callProcedure("CALL upsert_airline(?, ?, ?)", [
      String(body.airline_id),
      String(body.airline_name),
      body.country ? String(body.country) : null
    ]);
    return created({ airline_id: body.airline_id });
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
    await callProcedure("CALL upsert_airport(?, ?, ?, ?)", [
      String(body.airport_code),
      String(body.airport_name),
      String(body.city),
      String(body.country)
    ]);
    return created({ airport_code: body.airport_code });
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
    return serverError(error);
  }
}

export async function listAircraft() {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const [rows] = await getPool().query(
    `SELECT a.*, al.airline_name
     FROM aircraft a
     JOIN airlines al ON a.airline_id = al.airline_id
     ORDER BY a.aircraft_id`
  );
  return ok({ rows });
}

export async function upsertAircraft(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const body = await readJson(request);
  const missing = ["aircraft_id", "airline_id", "model", "capacity"].filter((k) => body[k] === undefined || body[k] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  try {
    await callProcedure("CALL upsert_aircraft(?, ?, ?, ?)", [
      Number(body.aircraft_id),
      String(body.airline_id),
      String(body.model),
      Number(body.capacity)
    ]);
    return created({ aircraft_id: body.aircraft_id });
  } catch (error) {
    return serverError(error);
  }
}

export async function listSchedules() {
  const session = await requireStaffSession();
  if (session.error) return session.error;
  const [rows] = await getPool().query(
    `SELECT fs.*, al.airline_name
     FROM flight_schedules fs
     JOIN airlines al ON fs.airline_id = al.airline_id
     ORDER BY fs.schedule_id`
  );
  return ok({ rows });
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
  try {
    await callProcedure("CALL upsert_flight_schedule(?, ?, ?, ?, ?, ?, ?, ?, ?)", [
      Number(body.schedule_id),
      String(body.airline_id),
      String(body.flight_number),
      String(body.dep_airport),
      String(body.arr_airport),
      String(body.dep_time),
      String(body.arr_time),
      String(body.valid_from),
      String(body.valid_to)
    ]);
    return created({ schedule_id: body.schedule_id });
  } catch (error) {
    return serverError(error);
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
