"use client";

import { cn } from "@/lib/cn";
import {
  columnsFor,
  parseSeat,
  rowGroups,
  sectionMarker,
  type FlightInfo,
  type Seat,
  type SeatClass
} from "@/app/components/seats/seatMapUtils";

type SeatMapProps = {
  flight: FlightInfo | null;
  sections: { className: SeatClass; seats: Seat[] }[];
  selected: Seat | null;
  onSelect: (seat: Seat) => void;
  selectableClass?: SeatClass | null;
  labels: {
    available: string;
    held: string;
    reserved: string;
    unavailable: string;
    wrongClass: string;
    exit: string;
    galley: string;
    classNames: Record<SeatClass, string>;
  };
};

function seatButtonClass(seat: Seat, selected: boolean, lockedOut: boolean) {
  if (lockedOut) {
    return "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400";
  }
  if (seat.seat_status === "reserved") {
    return "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-300";
  }
  if (seat.seat_status === "held") {
    return "cursor-not-allowed border-amber-200 bg-amber-50 text-amber-700";
  }
  if (selected) {
    return "border-deep-space-blue bg-deep-space-blue text-white shadow-md ring-2 ring-deep-space-blue/30";
  }
  return "border-zinc-200 bg-white text-zinc-700 shadow-sm hover:border-cerulean-500 hover:bg-cerulean-500/5 hover:text-deep-space-blue";
}

export default function SeatMap({
  flight,
  sections,
  selected,
  onSelect,
  labels,
  selectableClass = null
}: SeatMapProps) {
  return (
    <div className="overflow-auto rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="mx-auto min-w-[620px] max-w-4xl">
        <div className="relative overflow-hidden rounded-[40px] border border-zinc-200 bg-gradient-to-b from-zinc-100 via-white to-zinc-100 px-6 py-8 shadow-inner sm:px-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-zinc-200/40 to-transparent" />
          <div className="relative mx-auto mb-8 flex h-16 w-44 items-end justify-center rounded-t-[999px] border-x-2 border-t-2 border-zinc-300 bg-gradient-to-b from-white to-zinc-50">
            <div className="mb-2 h-1 w-20 rounded-full bg-zinc-200" />
          </div>

          <div className="relative space-y-10">
            {sections.map((section) => {
              const columns = columnsFor(flight?.model ?? "", section.className);
              return (
                <div key={section.className}>
                  <div className="mb-4 flex items-center justify-between border-b border-zinc-200/80 pb-2">
                    <h2 className="text-xs font-semibold uppercase tracking-widest text-cerulean-700">
                      {labels.classNames[section.className]}
                    </h2>
                    <span className="text-xs text-zinc-400">{columns.filter(Boolean).join(" · ")}</span>
                  </div>
                  <div className="space-y-1.5">
                    {rowGroups(section.seats).map(([row, rowSeats]) => {
                      const byLetter = new Map(rowSeats.map((seat) => [parseSeat(seat.seat_number).letter, seat]));
                      const marker = sectionMarker(section.className, row);
                      return (
                        <div key={row} className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 shrink-0 text-right text-[11px] font-semibold tabular-nums text-zinc-400">
                            {row}
                          </div>
                          <div
                            className="grid flex-1 items-center gap-1.5 sm:gap-2"
                            style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(32px, 1fr))` }}
                          >
                            {columns.map((letter, index) => {
                              if (!letter) {
                                return <div key={`aisle-${index}`} className="h-9 rounded-md bg-zinc-100/60" />;
                              }
                              const seat = byLetter.get(letter);
                              if (!seat) return <div key={`${row}-${letter}`} className="h-9" />;
                              const lockedOut =
                                selectableClass != null && seat.class_name !== selectableClass;
                              const disabled = lockedOut || seat.seat_status !== "available";
                              const isSelected = selected?.seat_number === seat.seat_number;
                              return (
                                <button
                                  type="button"
                                  key={seat.seat_number}
                                  disabled={disabled}
                                  title={
                                    lockedOut
                                      ? labels.wrongClass
                                      : disabled
                                        ? labels.unavailable
                                        : `${seat.seat_number} · $${seat.price}`
                                  }
                                  onClick={() => {
                                    if (!lockedOut) onSelect(seat);
                                  }}
                                  className={cn(
                                    "flex h-9 min-w-9 items-center justify-center rounded-lg border text-[10px] font-bold transition-all duration-150 sm:text-xs",
                                    seatButtonClass(seat, isSelected, lockedOut)
                                  )}
                                >
                                  {lockedOut ? "×" : letter}
                                </button>
                              );
                            })}
                          </div>
                          <div className="w-12 shrink-0 text-[10px] font-medium text-zinc-400">
                            {marker === "exit" ? labels.exit : marker === "galley" ? labels.galley : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative mx-auto mt-8 flex h-12 w-52 items-start justify-center rounded-b-[999px] border-x-2 border-b-2 border-zinc-300 bg-gradient-to-b from-zinc-50 to-white">
            <div className="mt-2 h-1 w-16 rounded-full bg-zinc-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
