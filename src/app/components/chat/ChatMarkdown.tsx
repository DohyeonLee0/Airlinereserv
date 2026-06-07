"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Block =
  | { type: "paragraph"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "h3"; text: string };

function inlineFormat(text: string) {
  const parts: ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`|\*(.+?)\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    if (match[2]) {
      parts.push(
        <strong key={key++} className="font-semibold text-zinc-900">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      parts.push(
        <code key={key++} className="rounded bg-zinc-200/80 px-1 py-0.5 text-[0.85em] text-zinc-800">
          {match[3]}
        </code>
      );
    } else if (match[4]) {
      parts.push(
        <em key={key++} className="text-zinc-700">
          {match[4]}
        </em>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < text.length) parts.push(text.slice(last));
  return parts.length ? parts : text;
}

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      blocks.push({ type: "h3", text: line.slice(4).trim() });
      i += 1;
      continue;
    }

    if (line.startsWith("|") && line.includes("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        tableLines.push(lines[i]);
        i += 1;
      }
      const parseRow = (row: string) =>
        row
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
      const headers = parseRow(tableLines[0]);
      const rows = tableLines.slice(2).map(parseRow);
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ul", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, "").trim());
        i += 1;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith("#") && !lines[i].startsWith("|") && !/^[-*]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: para.join(" ") });
  }

  return blocks;
}

function MarkdownBlocks({ markdown, compact }: { markdown: string; compact?: boolean }) {
  const blocks = parseBlocks(markdown);

  return (
    <div className={cn("space-y-2", compact && "space-y-1.5")}>
      {blocks.map((block, index) => {
        if (block.type === "h3") {
          return (
            <p key={index} className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              {block.text}
            </p>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={index} className={cn("text-sm leading-relaxed text-zinc-700", compact && "text-[13px]")}>
              {inlineFormat(block.text)}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={index} className={cn("ml-4 list-disc space-y-1 text-sm text-zinc-700", compact && "text-[13px]")}>
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {inlineFormat(item)}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={index} className={cn("ml-4 list-decimal space-y-1 text-sm text-zinc-700", compact && "text-[13px]")}>
              {block.items.map((item, j) => (
                <li key={j} className="leading-relaxed">
                  {inlineFormat(item)}
                </li>
              ))}
            </ol>
          );
        }
        if (block.type === "table") {
          return (
            <div key={index} className="overflow-x-auto rounded-lg border border-zinc-200/80">
              <table className="w-full min-w-[240px] text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    {block.headers.map((h, j) => (
                      <th key={j} className="px-2.5 py-1.5 font-medium">
                        {inlineFormat(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {block.rows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} className="px-2.5 py-1.5 text-zinc-700">
                          {inlineFormat(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default MarkdownBlocks;
