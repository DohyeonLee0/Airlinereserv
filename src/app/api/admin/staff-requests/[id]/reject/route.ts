import { NextRequest } from "next/server";
import { rejectStaffRequest } from "@/controllers/adminController";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return rejectStaffRequest(request, Number(id));
}
