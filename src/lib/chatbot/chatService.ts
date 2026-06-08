import {
  formatChunksForPrompt,
  loadKnowledgeChunks,
  type KnowledgeChunk
} from "@/lib/chatbot/knowledgeBase";
import { buildRetrievalReply, type ChatSection } from "@/lib/chatbot/formatRetrieval";
import { retrieveRelevantChunks } from "@/lib/chatbot/retrieve";

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const SYSTEM_PROMPT = `You are the CSE305 Air assistant for an airline reservation demo app.
Answer questions about how to use the system, demo accounts, roles, bookings, and the staff dashboard.

Rules:
- Use ONLY the provided knowledge base excerpts. If the answer is not there, say you don't know and suggest checking the app or docs.
- Be concise and friendly. Use bullet points when listing steps or permissions.
- Always answer in the same language the user writes in (Korean or English).
- Never invent passwords, emails, or policies not in the knowledge base.
- Demo password for all seeded accounts: Ars#CSE305!Demo2026`;

function retrievalResponse(query: string, chunks: KnowledgeChunk[]): ChatResponse {
  const { intro, sections } = buildRetrievalReply(query, chunks);
  return {
    reply: intro,
    intro,
    sections,
    sources: chunks.map((c) => ({ source: c.source, title: c.title })),
    mode: "retrieval"
  };
}

async function callOpenAI(messages: ChatMessage[], context: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: 800,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "system",
          content: `Knowledge base excerpts:\n\n${context}`
        },
        ...messages.map((m) => ({ role: m.role, content: m.content }))
      ]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenAI");
  return content;
}

export type ChatResponse = {
  reply: string;
  intro?: string;
  sections?: ChatSection[];
  sources: Array<{ source: string; title: string }>;
  mode: "openai" | "retrieval";
};

export async function answerChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const query = lastUser?.content?.trim() ?? "";

  const allChunks = loadKnowledgeChunks();
  const relevant = retrieveRelevantChunks(query, allChunks, 4);
  const context = formatChunksForPrompt(relevant);

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const reply = await callOpenAI(messages.slice(-6), context);
      return { reply, sources: relevant.map((c) => ({ source: c.source, title: c.title })), mode: "openai" };
    } catch {
      return retrievalResponse(query, relevant);
    }
  }

  return retrievalResponse(query, relevant);
}
