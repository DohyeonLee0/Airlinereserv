import { getConnectingItineraryDetail } from "@/controllers/masterDataController";

export async function GET(_request: Request, context: { params: Promise<{ itineraryId: string }> }) {
  const { itineraryId } = await context.params;
  return getConnectingItineraryDetail(Number(itineraryId));
}
