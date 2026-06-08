import { listAirports, upsertAirport } from "@/controllers/masterDataController";

export const GET = listAirports;
export { upsertAirport as POST };
