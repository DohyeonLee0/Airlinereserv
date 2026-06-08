"use client";

import { BookOpen } from "lucide-react";
import MarkdownBlocks from "@/app/components/chat/ChatMarkdown";
import type { ChatSection } from "@/lib/chatbot/formatRetrieval";
import { cn } from "@/lib/cn";

export type AssistantMessageData = {
  intro: string;
  sections?: ChatSection[];
  mode?: "openai" | "retrieval";
};

type ChatMessageBodyProps = {
  content: string;
  data?: AssistantMessageData;
};

export default function ChatMessageBody({ content, data }: ChatMessageBodyProps) {
  if (data?.sections && data.sections.length > 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium leading-relaxed text-zinc-800">{data.intro}</p>
        <div className="space-y-2.5">
          {data.sections.map((section) => (
            <article
              key={`${section.source}-${section.title}`}
              className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm"
            >
              <div className="border-b border-zinc-100 bg-zinc-50/80 px-3 py-2">
                <p className="text-sm font-semibold text-zinc-900">{section.title}</p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] text-zinc-500">
                  <BookOpen className="size-3" strokeWidth={1.75} />
                  {section.source}
                </p>
              </div>
              <div className="px-3 py-2.5">
                <MarkdownBlocks markdown={section.body} compact />
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("text-sm leading-relaxed text-zinc-800")}>
      <MarkdownBlocks markdown={content} />
    </div>
  );
}
