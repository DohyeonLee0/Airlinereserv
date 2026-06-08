"use client";

import { MasterFormField, masterInputClass } from "@/app/components/dashboard/master/MasterFormField";
import { cn } from "@/lib/cn";

export type FlightGeneratePricing = {
  start_date: string;
  end_date: string;
  economy_price: string;
  business_price: string;
  first_price: string;
};

type GenerateDatedFlightsPanelProps = {
  pricing: FlightGeneratePricing;
  onChange: (patch: Partial<FlightGeneratePricing>) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  disabled?: boolean;
  buttonLabel?: string;
  hint?: string;
};

export function GenerateDatedFlightsPanel({
  pricing,
  onChange,
  onGenerate,
  isGenerating,
  disabled = false,
  buttonLabel = "Generate dated flights",
  hint = "Creates bookable flights with seats and prices on matching operating days within the date range."
}: GenerateDatedFlightsPanelProps) {
  return (
    <div className="mt-5 rounded-xl border border-cerulean-500/20 bg-sky-blue-light/15 p-4">
      <p className="text-sm font-semibold text-navy">Generate dated flights</p>
      <p className="mt-1 text-xs text-cerulean-800">{hint}</p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <MasterFormField label="Start date" required>
          <input
            type="date"
            lang="en-US"
            value={pricing.start_date}
            onChange={(e) => onChange({ start_date: e.target.value })}
            className={masterInputClass}
          />
        </MasterFormField>
        <MasterFormField label="End date" required>
          <input
            type="date"
            lang="en-US"
            value={pricing.end_date}
            onChange={(e) => onChange({ end_date: e.target.value })}
            className={masterInputClass}
          />
        </MasterFormField>
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-navy">Seat prices (USD)</p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <MasterFormField label="Economy">
          <input
            type="number"
            min={0}
            step="0.01"
            value={pricing.economy_price}
            onChange={(e) => onChange({ economy_price: e.target.value })}
            className={masterInputClass}
          />
        </MasterFormField>
        <MasterFormField label="Business">
          <input
            type="number"
            min={0}
            step="0.01"
            value={pricing.business_price}
            onChange={(e) => onChange({ business_price: e.target.value })}
            className={masterInputClass}
          />
        </MasterFormField>
        <MasterFormField label="First">
          <input
            type="number"
            min={0}
            step="0.01"
            value={pricing.first_price}
            onChange={(e) => onChange({ first_price: e.target.value })}
            className={masterInputClass}
          />
        </MasterFormField>
      </div>

      <button
        type="button"
        disabled={disabled || isGenerating}
        onClick={onGenerate}
        className={cn(
          "mt-4 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90 sm:w-auto",
          (disabled || isGenerating) && "cursor-not-allowed opacity-60"
        )}
      >
        {isGenerating ? "Generating…" : buttonLabel}
      </button>
    </div>
  );
}
