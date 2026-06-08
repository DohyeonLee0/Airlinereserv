import { deleteSeatTemplate, listSeatTemplates, upsertSeatTemplate } from "@/controllers/seatTemplateController";

export const GET = listSeatTemplates;
export const POST = upsertSeatTemplate;
export const DELETE = deleteSeatTemplate;
