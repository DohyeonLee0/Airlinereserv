import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { RowDataPacket } from "mysql2";
import { getPool } from "@/config/db";
import { buildDisplayName } from "@/lib/displayName";
import type { UserRole } from "@/lib/roles";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
  verifySessionToken,
  type SessionUser
} from "@/lib/session";

export { SESSION_COOKIE, sessionCookieOptions, createSessionToken, type SessionUser };

type UserRow = RowDataPacket & {
  user_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string;
  password: string;
  role: UserRole;
  status: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function toSessionUser(row: Pick<UserRow, "user_id" | "first_name" | "middle_name" | "last_name" | "email" | "role" | "status">): SessionUser {
  return {
    user_id: row.user_id,
    first_name: row.first_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    display_name: buildDisplayName(row.first_name, row.middle_name, row.last_name),
    email: row.email,
    role: row.role,
    status: row.status
  };
}

export async function getUserByEmail(email: string) {
  const [rows] = await getPool().query<UserRow[]>(
    `SELECT user_id, first_name, middle_name, last_name, email, password, role, status
     FROM users WHERE email = ? LIMIT 1`,
    [email.trim()]
  );
  return rows[0] ?? null;
}

export async function getUserById(userId: string) {
  const [rows] = await getPool().query<UserRow[]>(
    `SELECT user_id, first_name, middle_name, last_name, email, password, role, status
     FROM users WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const userId = await verifySessionToken(token);
    if (!userId) return null;
    const user = await getUserById(userId);
    if (!user || user.status !== "Active") return null;
    return toSessionUser(user);
  } catch {
    return null;
  }
}
