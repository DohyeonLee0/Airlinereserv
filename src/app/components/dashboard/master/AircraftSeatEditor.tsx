"use client";

import { Plus, Trash2 } from "lucide-react";
import { masterInputClass } from "@/app/components/dashboard/master/MasterFormField";
import {
  classNameForId,
  SEAT_CLASS_OPTIONS,
  summarizeSeatLayout,
  type AircraftSeatInput,
  type SeatTemplateListItem
} from "@/lib/aircraftSeatLayouts";
import { cn } from "@/lib/cn";

type Props = {
  seats: AircraftSeatInput[];
  onChange: (seats: AircraftSeatInput[]) => void;
  templates: SeatTemplateListItem[];
  selectedTemplateId: string;
  onSelectedTemplateIdChange: (templateId: string) => void;
  onApplyTemplate: () => void;
  applyingTemplate?: boolean;
  applyLabel?: string;
  hideTemplatePicker?: boolean;
};

export function AircraftSeatEditor({
  seats,
  onChange,
  templates,
  selectedTemplateId,
  onSelectedTemplateIdChange,
  onApplyTemplate,
  applyingTemplate = false,
  applyLabel = "Apply from DB",
  hideTemplatePicker = false
}: Props) {
  const summary = summarizeSeatLayout(seats);

  function updateSeat(index: number, patch: Partial<AircraftSeatInput>) {
    onChange(seats.map((seat, seatIndex) => (seatIndex === index ? { ...seat, ...patch } : seat)));
  }

  function removeSeat(index: number) {
    onChange(seats.filter((_, seatIndex) => seatIndex !== index));
  }

  function addSeat() {
    onChange([...seats, { seat_number: "", class_id: 1 }]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">Seat layout</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {hideTemplatePicker
              ? "Edit seats for this template record."
              : "Apply a saved DB template, then adjust seats before saving the aircraft."}
          </p>
        </div>
        {!hideTemplatePicker ? (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-zinc-600">
              DB template
              <select
                value={selectedTemplateId}
                onChange={(e) => onSelectedTemplateIdChange(e.target.value)}
                className={cn(masterInputClass, "mt-1 min-w-[220px]")}
              >
                <option value="">Select template…</option>
                {templates.map((template) => (
                  <option key={template.template_id} value={String(template.template_id)}>
                    #{template.template_id} · {template.template_name}
                    {template.model_label ? ` (${template.model_label})` : ""} · {template.seat_count ?? 0} seats
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onApplyTemplate}
              disabled={!selectedTemplateId || applyingTemplate}
              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {applyingTemplate ? "Applying…" : applyLabel}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onApplyTemplate}
            className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
          >
            {applyLabel}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 font-medium text-zinc-700">Total {summary.total}</span>
        <span className="rounded-full bg-sky-50 px-2.5 py-1 font-medium text-sky-800">First {summary.first}</span>
        <span className="rounded-full bg-violet-50 px-2.5 py-1 font-medium text-violet-800">Business {summary.business}</span>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">Economy {summary.economy}</span>
      </div>

      <div className="max-h-80 overflow-auto rounded-xl border border-zinc-200">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr className="text-left text-zinc-600">
              <th className="border border-zinc-200 px-3 py-2 font-semibold">Seat</th>
              <th className="border border-zinc-200 px-3 py-2 font-semibold">Class</th>
              <th className="border border-zinc-200 px-3 py-2 font-semibold w-16"> </th>
            </tr>
          </thead>
          <tbody>
            {seats.map((seat, index) => (
              <tr key={`${seat.seat_number}-${index}`}>
                <td className="border border-zinc-100 px-3 py-2">
                  <input
                    value={seat.seat_number}
                    onChange={(e) => updateSeat(index, { seat_number: e.target.value.toUpperCase() })}
                    placeholder="12A"
                    className={cn(masterInputClass, "mt-0 font-mono uppercase")}
                    required
                  />
                </td>
                <td className="border border-zinc-100 px-3 py-2">
                  <select
                    value={seat.class_id}
                    onChange={(e) => updateSeat(index, { class_id: Number(e.target.value) })}
                    className={cn(masterInputClass, "mt-0")}
                  >
                    {SEAT_CLASS_OPTIONS.map((option) => (
                      <option key={option.class_id} value={option.class_id}>
                        {option.class_name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="border border-zinc-100 px-3 py-2 text-center">
                  <button
                    type="button"
                    onClick={() => removeSeat(index)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Remove seat ${seat.seat_number || index + 1}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addSeat}
        className="inline-flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50"
      >
        <Plus className="size-4" />
        Add seat
      </button>

      {seats.length > 0 ? (
        <p className="text-xs text-zinc-500">
          Preview: {seats.slice(0, 6).map((seat) => `${seat.seat_number} (${classNameForId(seat.class_id)})`).join(", ")}
          {seats.length > 6 ? `, +${seats.length - 6} more` : ""}
        </p>
      ) : null}
    </div>
  );
}
