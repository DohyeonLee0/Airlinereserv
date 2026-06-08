import { getTrackerScheduleDetail } from "@/controllers/scheduleTrackerController";

export async function GET(_request: Request, context: { params: Promise<{ scheduleId: string }> }) {
  const { scheduleId } = await context.params;
  return getTrackerScheduleDetail(Number(scheduleId));
}
