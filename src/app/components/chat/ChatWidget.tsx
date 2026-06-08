"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import ChatMessageBody, { type AssistantMessageData } from "@/app/components/chat/ChatMessageBody";
import { cn } from "@/lib/cn";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  data?: AssistantMessageData;
};

type ChatSource = {
  source: string;
  title: string;
};

const STARTER_PROMPTS = [
  "What are the demo account passwords?",
  "Difference between Admin and SuperAdmin?",
  "How do I cancel a booking?"
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm the CSE305 Air assistant. Ask about demo accounts, roles, bookings, or the staff dashboard."
    }
  ]);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content }))
        })
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        setMessages([
          ...nextMessages,
          { role: "assistant", content: json.message ?? "Something went wrong. Please try again." }
        ]);
        setSources([]);
        return;
      }

      const assistantData: AssistantMessageData | undefined =
        json.data.mode === "retrieval" && json.data.sections?.length
          ? {
              intro: json.data.intro ?? json.data.reply,
              sections: json.data.sections,
              mode: "retrieval"
            }
          : undefined;

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: json.data.reply,
          data: assistantData
        }
      ]);
      setSources(json.data.sources ?? []);
    } catch {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "Network error — please check your connection and try again." }
      ]);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <>
      {open ? (
        <div className="fixed bottom-24 right-5 z-[60] flex h-[min(560px,calc(100vh-7rem))] w-[min(420px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl sm:right-8">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-deep-space-blue px-4 py-3 text-white">
            <div>
              <p className="text-sm font-semibold">CSE305 Air Assistant</p>
              <p className="text-xs text-sky-blue-light/80">Knowledge base assistant</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 hover:bg-white/10"
              aria-label="Close chat"
            >
              <X className="size-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-deep-space-blue px-3.5 py-2.5 text-sm leading-relaxed text-white"
                    : "max-w-full rounded-2xl bg-zinc-100 px-3.5 py-3"
                )}
              >
                {message.role === "assistant" ? (
                  <ChatMessageBody content={message.content} data={message.data} />
                ) : (
                  message.content
                )}
              </div>
            ))}
            {loading ? (
              <div className="max-w-[90%] rounded-2xl bg-zinc-100 px-3.5 py-2.5 text-sm text-zinc-500">
                Thinking…
              </div>
            ) : null}
          </div>

          {sources.length > 0 ? (
            <div className="border-t border-zinc-100 px-4 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Sources</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {sources.map((s) => (
                  <span
                    key={`${s.source}-${s.title}`}
                    className="rounded-full bg-cerulean-500/10 px-2 py-0.5 text-[10px] text-cerulean-800"
                    title={s.title}
                  >
                    {s.source.replace(/\.md$/i, "")}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {messages.length <= 1 ? (
            <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-4 py-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-cerulean-300 hover:bg-cerulean-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="flex gap-2 border-t border-zinc-100 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about accounts, roles, bookings…"
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-cerulean-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-deep-space-blue text-white disabled:opacity-50"
              aria-label="Send message"
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-5 right-5 z-[60] flex size-14 items-center justify-center rounded-full bg-deep-space-blue text-white shadow-lg transition hover:scale-105 hover:bg-yale-blue-2-500 sm:right-8"
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </>
  );
}
