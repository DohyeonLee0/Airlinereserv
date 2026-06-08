import { NextRequest, NextResponse } from "next/server";
import { RowDataPacket } from "mysql2";
import { getPool } from "@/config/db";
import {
  createSessionToken,
  getSessionUser,
  getUserByEmail,
  hashPassword,
  sessionCookieOptions,
  toSessionUser,
  verifyPassword,
  SESSION_COOKIE
} from "@/lib/auth";
import { badRequest, created, ok, readJson, serverError, unauthorized } from "./http";

function requiredFields(body: Record<string, unknown>, fields: string[]) {
  return fields.filter((field) => body[field] === undefined || body[field] === "");
}

export async function registerCustomer(request: NextRequest) {
  const body = await readJson(request);
  const missing = requiredFields(body, ["first_name", "last_name", "email", "password"]);
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  if (body.password !== body.confirm_password) {
    return badRequest("Passwords do not match");
  }

  const connection = await getPool().getConnection();
  try {
    const hashed = await hashPassword(String(body.password));
    await connection.query("SET @new_user_id = ''");
    await connection.query("CALL register_customer(?, ?, ?, ?, ?, @new_user_id)", [
      String(body.first_name),
      body.middle_name ? String(body.middle_name) : null,
      String(body.last_name),
      String(body.email),
      hashed
    ]);
    const [idRows] = await connection.query<RowDataPacket[]>("SELECT @new_user_id AS user_id");
    const userId = (idRows[0] as RowDataPacket)?.user_id as string;
    return created({ user_id: userId, message: "Account created successfully" });
  } catch (error) {
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function registerStaffRequest(request: NextRequest) {
  const body = await readJson(request);
  const missing = requiredFields(body, ["first_name", "last_name", "email", "password", "requested_role"]);
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  if (body.password !== body.confirm_password) {
    return badRequest("Passwords do not match");
  }

  const requestedRole = String(body.requested_role);
  if (!["Staff", "Admin"].includes(requestedRole)) {
    return badRequest("Requested role must be Staff or Admin");
  }

  const connection = await getPool().getConnection();
  try {
    const hashed = await hashPassword(String(body.password));
    await connection.query("SET @new_request_id = 0");
    await connection.query("CALL submit_staff_request(?, ?, ?, ?, ?, ?, @new_request_id)", [
      String(body.first_name),
      body.middle_name ? String(body.middle_name) : null,
      String(body.last_name),
      String(body.email),
      hashed,
      requestedRole
    ]);
    const [idRows] = await connection.query<RowDataPacket[]>("SELECT @new_request_id AS request_id");
    return created({
      request_id: (idRows[0] as RowDataPacket)?.request_id,
      message: "Staff registration request submitted for approval"
    });
  } catch (error) {
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function login(request: NextRequest) {
  const body = await readJson(request);
  const missing = requiredFields(body, ["email", "password"]);
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  try {
    const user = await getUserByEmail(String(body.email));
    if (!user || user.status !== "Active") {
      return unauthorized("Invalid email or password");
    }

    const valid = await verifyPassword(String(body.password), user.password);
    if (!valid) return unauthorized("Invalid email or password");

    const sessionUser = toSessionUser(user);
    const token = await createSessionToken(sessionUser);
    const response = ok({ user: sessionUser });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (error) {
    return serverError(error);
  }
}

export async function logout() {
  const response = ok({ message: "Logged out" });
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}

export async function me() {
  try {
    const user = await getSessionUser();
    if (!user) return unauthorized();
    return ok({ user });
  } catch (error) {
    return serverError(error);
  }
}
