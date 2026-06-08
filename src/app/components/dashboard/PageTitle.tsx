import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageTitleAccent = "brand" | "sky" | "amber" | "emerald" | "violet";

const ACCENT_ICON: Record<PageTitleAccent, string> = {
  brand: "text-brand",
  sky: "text-sky-600",
  amber: "text-amber-600",
  emerald: "text-emerald-600",
  violet: "text-violet-600"
};

export function PageTitle({
  icon: Icon,
  title,
  description,
  accent = "brand",
  className
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  accent?: PageTitleAccent;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <Icon className={cn("size-7 shrink-0", ACCENT_ICON[accent])} aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{title}</h1>
      </div>
      {description ? (
        typeof description === "string" ? (
          <p className="mt-1 text-sm text-zinc-500">{description}</p>
        ) : (
          <div className="mt-1 text-sm text-zinc-500">{description}</div>
        )
      ) : null}
    </div>
  );
}
