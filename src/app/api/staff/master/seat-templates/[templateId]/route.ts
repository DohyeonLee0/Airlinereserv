import { getSeatTemplate } from "@/controllers/seatTemplateController";

export async function GET(_request: Request, context: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await context.params;
  return getSeatTemplate(Number(templateId));
}
