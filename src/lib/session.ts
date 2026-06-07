import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@/lib/roles";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session-edge";

export { SESSION_COOKIE, sessionCookieOptions };

export type SessionUser = {
  user_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  display_name: string;
  email: string;
  role: UserRole;
  status: string;
};

export function authSecret() {
  return new TextEncoder().encode(process.env.AUTH_SECRET ?? "cse305-airline-reservation-dev-secret");
}

export async function createSessionToken(user: Pick<SessionUser, "user_id" | "role" | "email" | "display_name">) {
  return new SignJWT({
    user_id: user.user_id,
    role: user.role,
    email: user.email,
    display_name: user.display_name
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(authSecret());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, authSecret());
  const userId = payload.user_id;
  if (typeof userId !== "string") return null;
  return userId;
}
