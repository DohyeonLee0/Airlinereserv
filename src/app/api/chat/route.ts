import { NextRequest } from "next/server";
import { answerChat, type ChatMessage } from "@/lib/chatbot/chatService";
import { badRequest, ok, readJson, serverError } from "@/controllers/http";

type ChatRequestBody = {
  messages?: ChatMessage[];
};

export async function POST(request: NextRequest) {
  try {
    const body = await readJson<ChatRequestBody>(request);
    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return badRequest("messages array is required");
    }

    const sanitized = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))
      .filter((m) => m.content.length > 0);

    if (sanitized.length === 0 || sanitized[sanitized.length - 1].role !== "user") {
      return badRequest("Last message must be from the user");
    }

    const result = await answerChat(sanitized);
    return ok(result);
  } catch (error) {
    return serverError(error);
  }
}
