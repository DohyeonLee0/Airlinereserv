import { NextRequest } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getPool } from "@/config/db";
import { normalizeAircraftSeats } from "@/lib/aircraftSeatLayouts";
import { getSessionUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/roles";
import { badRequest, created, forbidden, ok, readJson, serverError, unauthorized } from "./http";

async function requireStaffSession() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized(), user: null };
  if (!isStaffRole(user.role)) return { error: forbidden("Staff access required"), user: null };
  return { error: null, user };
}

function parseSeatsJson(value: unknown) {
  if (Array.isArray(value)) return normalizeAircraftSeats(value);
  if (typeof value === "string") {
    try {
      return normalizeAircraftSeats(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
}

export async function listSeatTemplates() {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT
       template_id,
       template_name,
       model_label,
       description,
       seats_json,
       created_at,
       updated_at,
       JSON_LENGTH(seats_json) AS seat_count
     FROM aircraft_seat_templates
     ORDER BY template_id`
  );

  return ok({
    rows: rows.map((row) => ({
      template_id: row.template_id,
      template_name: row.template_name,
      model_label: row.model_label,
      description: row.description,
      seat_count: Number(row.seat_count ?? 0),
      created_at: row.created_at,
      updated_at: row.updated_at
    }))
  });
}

export async function getSeatTemplate(templateId: number) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  if (!Number.isFinite(templateId) || templateId <= 0) {
    return badRequest("Invalid template ID.");
  }

  const [rows] = await getPool().query<RowDataPacket[]>(
    `SELECT template_id, template_name, model_label, description, seats_json, created_at, updated_at
     FROM aircraft_seat_templates
     WHERE template_id = ?`,
    [templateId]
  );

  if (!rows[0]) {
    return badRequest("Seat template not found.");
  }

  const row = rows[0];
  return ok({
    template: {
      template_id: row.template_id,
      template_name: row.template_name,
      model_label: row.model_label,
      description: row.description,
      created_at: row.created_at,
      updated_at: row.updated_at
    },
    seats: parseSeatsJson(row.seats_json)
  });
}

export async function upsertSeatTemplate(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const body = await readJson(request);
  const missing = ["template_id", "template_name"].filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  const seats = normalizeAircraftSeats(body.seats);
  if (!seats.length) {
    return badRequest("Add at least one valid seat to the template.");
  }

  try {
    await getPool().query("CALL upsert_aircraft_seat_template(?, ?, ?, ?, ?)", [
      Number(body.template_id),
      String(body.template_name).trim(),
      body.model_label ? String(body.model_label).trim() : null,
      body.description ? String(body.description).trim() : null,
      JSON.stringify(seats)
    ]);

    return created({
      template_id: Number(body.template_id),
      seat_count: seats.length
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function deleteSeatTemplate(request: NextRequest) {
  const session = await requireStaffSession();
  if (session.error) return session.error;

  const body = await readJson(request);
  if (!body.template_id) return badRequest("Missing field(s): template_id");

  try {
    await getPool().query("CALL delete_aircraft_seat_template(?)", [Number(body.template_id)]);
    return ok({ deleted: Number(body.template_id) });
  } catch (error) {
    return serverError(error);
  }
}
