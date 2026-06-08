import { NextRequest } from "next/server";
import { approveStaffRequest } from "@/controllers/adminController";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return approveStaffRequest(request, Number(id));
}
