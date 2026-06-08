import { ArrowRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export type PopularRouteCardProps = {
  dep: string;
  arr: string;
  city: string;
  country: string;
  price?: number;
  score?: number;
  badge?: string;
  flightDate: string;
  seatClass: string;
  onSelect?: () => void;
  href?: string;
};

export default function PopularRouteCard({
  dep,
  arr,
  city,
  country,
  price,
  score,
  badge,
  onSelect,
  href
}: PopularRouteCardProps) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cerulean-700">
            {dep} → {arr}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-zinc-900">{city}</h3>
          <p className="mt-0.5 text-sm text-zinc-500">{country}</p>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">{badge}</span>
        ) : null}
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-zinc-100 pt-4">
        <div>
          {price !== undefined ? (
            <p className="text-2xl font-bold tabular-nums text-zinc-900">${price.toLocaleString("en-US")}</p>
          ) : (
            <p className="text-sm text-zinc-400">Fetching best fare…</p>
          )}
          <p className="mt-0.5 text-xs text-zinc-400">Lowest available</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {score !== undefined ? (
            <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">
              <Sparkles className="size-3" strokeWidth={1.75} />
              {score}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-cerulean-700 group-hover:gap-2 transition-all">
            Explore
            <ArrowRight className="size-4" strokeWidth={1.75} />
          </span>
        </div>
      </div>
    </>
  );

  const className =
    "group w-full rounded-2xl border border-zinc-100 bg-white p-6 text-left transition-all duration-200 hover:border-zinc-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]";

  if (href) {
    return (
      <a href={href} className={className} onClick={onSelect}>
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={onSelect} className={cn(className)}>
      {inner}
    </button>
  );
}
