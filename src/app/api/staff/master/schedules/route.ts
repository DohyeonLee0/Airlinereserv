import { listSchedules, upsertSchedule } from "@/controllers/masterDataController";

export const GET = listSchedules;
export { upsertSchedule as POST };
