import { listAircraft, upsertAircraft } from "@/controllers/masterDataController";

export const GET = listAircraft;
export { upsertAircraft as POST };
