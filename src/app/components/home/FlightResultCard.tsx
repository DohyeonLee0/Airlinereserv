import Link from "next/link";

import { Plane, Sparkles, Tag } from "lucide-react";

import { cn } from "@/lib/cn";

import {

  flightIdsOf,

  flightNumbersOf,

  isApproximateFare,

  priceLabelOf,

  priceOf,

  routeLabel,

  seatHref,

  stopLabel,

  type RouteRow

} from "@/lib/routeSearch";



function formatTime(value?: string) {

  if (!value) return "";

  return String(value).slice(0, 5);

}



type FlightLeg = "outbound" | "return";



type RoundTripContext = {

  origin: string;

  destination: string;

  outboundDate: string;

  returnDate: string;

};



function legDetailLine(row: RouteRow, flightNumbers: string[]) {

  const time =

    row.dep_time || row.arr_time

      ? `${formatTime(row.dep_time)} → ${formatTime(row.arr_time)}`

      : null;

  const parts = [

    row.airline_name ?? "Airline",

    flightNumbers.join(" · "),

    time,

    row.class_name

  ].filter(Boolean);

  return parts.join(" · ");

}



function RoundTripLegBlock({

  label,

  routeText,

  date,

  detail,

  active

}: {

  label: string;

  routeText: string;

  date: string;

  detail?: string;

  active: boolean;

}) {

  return (

    <div className={cn("px-4 py-3", active ? "bg-white" : "text-zinc-600")}>

      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>

      <p className="mt-1 text-sm font-medium text-zinc-900">

        {routeText} · {date}

      </p>

      {detail ? (

        <p className="mt-1 text-sm text-zinc-600">{detail}</p>

      ) : (

        <p className="mt-1 text-xs text-zinc-500">Not selected yet</p>

      )}

    </div>

  );

}



export default function FlightResultCard({

  row,

  isBest = false,

  leg,

  roundTrip,

  selectionMode = false,

  isSelected = false,

  onSelect,

  pairedLeg,

  seatClassFilter = "",

  journeyType = "one_way"

}: {

  row: RouteRow;

  isBest?: boolean;

  leg?: FlightLeg;

  roundTrip?: RoundTripContext;

  selectionMode?: boolean;

  isSelected?: boolean;

  onSelect?: () => void;

  pairedLeg?: RouteRow | null;

  seatClassFilter?: string;

  journeyType?: "one_way" | "round_trip";

}) {

  const isDeal = Boolean(

    (row.applied_promo_code && row.applied_promo_code !== "NO_PROMO") || row.discount_percent

  );

  const flightNumbers = flightNumbersOf(row);

  const showRoundTrip = Boolean(leg && roundTrip);

  const title = showRoundTrip

    ? `${roundTrip!.origin} ↔ ${roundTrip!.destination}`

    : routeLabel(row);



  const outboundDetail =

    leg === "outbound"

      ? legDetailLine(row, flightNumbers)

      : pairedLeg

        ? legDetailLine(pairedLeg, flightNumbersOf(pairedLeg))

        : undefined;



  const returnDetail =

    leg === "return"

      ? legDetailLine(row, flightNumbers)

      : pairedLeg

        ? legDetailLine(pairedLeg, flightNumbersOf(pairedLeg))

        : undefined;



  return (

    <article

      className={cn(

        "group rounded-2xl border bg-white p-6 transition-all duration-200 hover:border-zinc-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]",

        isDeal ? "border-emerald-200/80" : "border-zinc-100",

        selectionMode && isSelected && "border-deep-space-blue ring-2 ring-deep-space-blue/20",

        selectionMode && "cursor-pointer"

      )}

      onClick={selectionMode ? onSelect : undefined}

      onKeyDown={

        selectionMode

          ? (event) => {

              if (event.key === "Enter" || event.key === " ") {

                event.preventDefault();

                onSelect?.();

              }

            }

          : undefined

      }

      role={selectionMode ? "button" : undefined}

      tabIndex={selectionMode ? 0 : undefined}

    >

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

        <div className="min-w-0 flex-1">

          <div className="flex flex-wrap items-center gap-2">

            {isBest ? (

              <span className="inline-flex items-center gap-1 rounded-full bg-cerulean-500 px-2.5 py-1 text-xs font-semibold text-white">

                <Sparkles className="size-3" strokeWidth={1.75} />

                Best

              </span>

            ) : null}

            {selectionMode && isSelected ? (

              <span className="inline-flex rounded-full bg-deep-space-blue px-2.5 py-1 text-xs font-semibold text-white">

                Selected

              </span>

            ) : null}

            {leg && !selectionMode ? (

              <span className="inline-flex rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white">

                {leg === "outbound" ? "Outbound" : "Return"}

              </span>

            ) : null}

            <span

              className={cn(

                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",

                isDeal ? "bg-emerald-50 text-emerald-800" : "bg-zinc-100 text-zinc-700"

              )}

            >

              {isDeal && row.applied_promo_code ? (

                <>

                  <Tag className="size-3" strokeWidth={1.75} />

                  {row.applied_promo_code}

                </>

              ) : (

                stopLabel(row)

              )}

            </span>

          </div>



          <h3 className="mt-3 text-xl font-semibold tracking-tight text-zinc-900">{title}</h3>



          {showRoundTrip ? (

            <div className="mt-3 space-y-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80">

              <RoundTripLegBlock

                label="Outbound"

                routeText={`${roundTrip!.origin} → ${roundTrip!.destination}`}

                date={roundTrip!.outboundDate}

                detail={outboundDetail}

                active={leg === "outbound"}

              />

              <div className="border-t border-zinc-200">

                <RoundTripLegBlock

                  label="Return"

                  routeText={`${roundTrip!.destination} → ${roundTrip!.origin}`}

                  date={roundTrip!.returnDate}

                  detail={returnDetail}

                  active={leg === "return"}

                />

              </div>

            </div>

          ) : (

            <>

              <p className="mt-1 flex items-center gap-1.5 text-sm text-zinc-500">

                <Plane className="size-3.5 shrink-0" strokeWidth={1.75} />

                {row.airline_name ?? "Airline"} · {flightNumbers.join(" · ")}

              </p>

              {(row.dep_time || row.arr_time) && (

                <p className="mt-1 text-sm text-zinc-500">

                  {formatTime(row.dep_time)} → {formatTime(row.arr_time)}

                </p>

              )}

            </>

          )}



          {!showRoundTrip && flightIdsOf(row).length > 1 ? (

            <p className="mt-1 text-xs text-zinc-400">{flightIdsOf(row).length} legs · select a seat for each</p>

          ) : null}

          {row.promo_description ? <p className="mt-2 text-[15px] text-emerald-700">{row.promo_description}</p> : null}

          {row.recommendation_score !== undefined ? (

            <p className="mt-2 text-xs font-semibold text-cerulean-700">Smart score · {row.recommendation_score}</p>

          ) : null}

          <p className="mt-2 text-xs text-zinc-400">

            {row.class_name ? `${row.class_name} · ` : ""}

            {row.available_seats} seats remaining

          </p>

        </div>



        <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end">

          <div className="text-right">

            {row.original_lowest_price && row.final_lowest_price ? (

              <p className="text-xs text-zinc-400 line-through">
                ${Number(row.original_lowest_price).toLocaleString("en-US")}
                {isApproximateFare(row, journeyType) ? " ~" : ""}
              </p>

            ) : null}

            <p className="text-3xl font-bold tabular-nums text-zinc-900">${priceLabelOf(row, journeyType)}</p>

            {leg ? <p className="text-xs text-zinc-500">per leg</p> : null}

            {row.discount_percent ? (

              <p className="text-xs font-semibold text-emerald-700">Save {row.discount_percent}%</p>

            ) : null}

          </div>

          {selectionMode ? (

            <span

              className={cn(

                "inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium",

                isSelected

                  ? "bg-deep-space-blue text-white"

                  : "border border-zinc-200 bg-white text-zinc-700"

              )}

            >

              {isSelected ? "Selected" : leg === "outbound" ? "Select outbound" : "Select return"}

            </span>

          ) : (

            <Link

              className="inline-flex h-11 items-center justify-center rounded-xl bg-deep-space-blue px-5 text-sm font-medium text-white shadow-sm transition hover:bg-yale-blue-2-500"

              href={seatHref(row, seatClassFilter || undefined)}

              onClick={(event) => event.stopPropagation()}

            >

              Choose seats

            </Link>

          )}

        </div>

      </div>

    </article>

  );

}



export type { RouteRow };

export { priceOf, routeLabel, seatHref };


