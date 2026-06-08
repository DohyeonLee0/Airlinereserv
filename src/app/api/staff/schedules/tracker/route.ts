import { NextRequest } from "next/server";
import { getScheduleTracker } from "@/controllers/scheduleTrackerController";

export async function GET(request: NextRequest) {
  const view = request.nextUrl.searchParams.get("view") ?? "legs";
  const startDate = request.nextUrl.searchParams.get("start_date");
  const endDate = request.nextUrl.searchParams.get("end_date");
  return getScheduleTracker(view, startDate, endDate);
}
