import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, getRoleFromSessionToken } from "@/lib/session-edge";

const staffRoles = new Set(["Staff", "Admin", "SuperAdmin"]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const role = token ? getRoleFromSessionToken(token) : null;

  const needsAuth =
    pathname.startsWith("/bookings") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/seats") ||
    pathname.startsWith("/dashboard");

  if (needsAuth && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/dashboard") && role && !staffRoles.has(role)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if ((pathname.startsWith("/bookings") || pathname.startsWith("/seats")) && role && role !== "Customer") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/bookings/:path*", "/account/:path*", "/seats/:path*", "/dashboard/:path*"]
};
