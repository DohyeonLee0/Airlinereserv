import { NextRequest } from "next/server";
import { callProcedure } from "@/config/db";
import { getSessionUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { badRequest, forbidden, ok, readJson, serverError, unauthorized } from "./http";

async function requireAdminSession() {
  const user = await getSessionUser();
  if (!user) return { error: unauthorized(), user: null };
  if (!isAdminRole(user.role)) return { error: forbidden("Admin access required"), user: null };
  return { error: null, user };
}

export async function listStaffRequests() {
  const session = await requireAdminSession();
  if (session.error || !session.user) return session.error;

  try {
    const rows = await callProcedure("CALL list_pending_staff_requests(?)", [session.user.user_id]);
    return ok({ requests: rows });
  } catch (error) {
    return serverError(error);
  }
}

export async function approveStaffRequest(request: NextRequest, requestId: number) {
  const session = await requireAdminSession();
  if (session.error || !session.user) return session.error;

  try {
    await callProcedure("CALL approve_staff_request(?, ?)", [requestId, session.user.user_id]);
    return ok({ request_id: requestId, status: "Approved" });
  } catch (error) {
    return serverError(error);
  }
}

export async function rejectStaffRequest(request: NextRequest, requestId: number) {
  const session = await requireAdminSession();
  if (session.error || !session.user) return session.error;

  const body = await readJson(request);
  if (!body.reject_reason) return badRequest("Missing field(s): reject_reason");

  try {
    await callProcedure("CALL reject_staff_request(?, ?, ?)", [
      requestId,
      session.user.user_id,
      String(body.reject_reason)
    ]);
    return ok({ request_id: requestId, status: "Rejected" });
  } catch (error) {
    return serverError(error);
  }
}
