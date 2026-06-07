import { NextRequest, NextResponse } from "next/server";

export type ApiHandler = (request: NextRequest) => Promise<NextResponse>;

export function ok(data: unknown = {}, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function created(data: unknown = {}) {
  return ok(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown) {
  return NextResponse.json({ success: false, errorType: "BAD_REQUEST", message, details }, { status: 400 });
}

export function conflict(message: string, errorType = "DOUBLE_BOOKING") {
  return NextResponse.json({ success: false, errorType, message }, { status: 409 });
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ success: false, errorType: "UNAUTHORIZED", message }, { status: 401 });
}

export function forbidden(message = "Access denied") {
  return NextResponse.json({ success: false, errorType: "FORBIDDEN", message }, { status: 403 });
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  return NextResponse.json({ success: false, errorType: "SERVER_ERROR", message }, { status: 500 });
}

export function requiredParams(request: NextRequest, names: string[]) {
  const params = request.nextUrl.searchParams;
  const missing = names.filter((name) => !params.get(name));
  if (missing.length > 0) {
    return { error: badRequest(`Missing query parameter(s): ${missing.join(", ")}`), values: null };
  }
  return { error: null, values: params };
}

export async function readJson<T extends Record<string, unknown>>(request: NextRequest) {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

export function isConflictDbError(error: unknown) {
  const dbError = error as { errno?: number; code?: string; sqlState?: string; message?: string };
  const message = (dbError.message ?? "").toLowerCase();
  return (
    dbError.errno === 1062 ||
    dbError.code === "ER_DUP_ENTRY" ||
    dbError.sqlState === "45000" ||
    message.includes("duplicate") ||
    message.includes("seat is not available") ||
    message.includes("held by another") ||
    message.includes("seat unavailable") ||
    message.includes("currently held")
  );
}

export function dbErrorMessage(error: unknown) {
  return ((error as { message?: string }).message ?? "").toLowerCase();
}
