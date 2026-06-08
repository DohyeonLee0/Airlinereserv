import { getAircraftDetail } from "@/controllers/masterDataController";

export async function GET(_request: Request, context: { params: Promise<{ aircraftId: string }> }) {
  const { aircraftId } = await context.params;
  return getAircraftDetail(Number(aircraftId));
}
