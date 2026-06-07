import { listAirlines, upsertAirline } from "@/controllers/masterDataController";

export const GET = listAirlines;
export { upsertAirline as POST };
