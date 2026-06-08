"use client";

import { Calendar } from "lucide-react";
import { cn } from "@/lib/cn";

type EnglishDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  className?: string;
  id?: string;
};

export default function EnglishDateInput({ value, onChange, min, className, id }: EnglishDateInputProps) {
  return (
    <div className={cn("relative focus-within:[&>div]:border-cerulean-500 focus-within:[&>div]:ring-2 focus-within:[&>div]:ring-cerulean-500/20", className)}>
      <input
        id={id}
        type="date"
        lang="en-US"
        value={value}
        min={min}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        aria-label="Select date"
      />
      <div
        className="pointer-events-none flex h-full w-full items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm"
        aria-hidden
      >
        <span className={value ? "text-zinc-900" : "text-zinc-400"}>{value || "YYYY-MM-DD"}</span>
        <Calendar className="size-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
      </div>
    </div>
  );
}
