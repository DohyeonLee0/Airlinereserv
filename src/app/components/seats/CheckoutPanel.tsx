"use client";

import Link from "next/link";
import { FormEvent } from "react";
import { CreditCard, Tag, Ticket } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { cn } from "@/lib/cn";
import type { Promotion } from "@/app/components/seats/types";
import type { Seat } from "@/app/components/seats/seatMapUtils";

type CheckoutPanelProps = {
  selected: Seat | null;
  flightIds: string[];
  promotions: Promotion[];
  selectedPromo: string;
  paymentMethod: string;
  lookupBookingId: string;
  labels: {
    payment: string;
    selectedSeat: string;
    none: string;
    promos: string;
    noPromos: string;
    applyNone: string;
    estimated: string;
    lookupBooking: string;
    autoIds: string;
    reserve: string;
    checkout: string;
    cancelRefund: string;
    lookup: string;
    myBookings: string;
  };
  onPromoChange: (code: string) => void;
  onPaymentMethodChange: (method: string) => void;
  onLookupBookingIdChange: (id: string) => void;
  onReserve: (event: FormEvent) => void;
  onCancelRefund: () => void;
  onLoadLedger: () => void;
};

export default function CheckoutPanel({
  selected,
  flightIds,
  promotions,
  selectedPromo,
  paymentMethod,
  lookupBookingId,
  labels,
  onPromoChange,
  onPaymentMethodChange,
  onLookupBookingIdChange,
  onReserve,
  onCancelRefund,
  onLoadLedger
}: CheckoutPanelProps) {
  const discount = promotions.find((p) => p.promo_code === selectedPromo)?.discount_percent ?? 0;
  const estimated = selected ? selected.price * (1 - discount / 100) : 0;

  return (
    <div className="space-y-4">
      <form
        onSubmit={onReserve}
        className="rounded-2xl border border-zinc-100 bg-white p-5 shadow-sm sm:p-6"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-cerulean-700">{labels.payment}</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-900">Checkout</h2>

        <div className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50/80 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">{labels.selectedSeat}</p>
          {selected ? (
            <div className="mt-2 flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-deep-space-blue text-white">
                <Ticket className="size-4" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xl font-bold text-zinc-900">{selected.seat_number}</p>
                <p className="text-sm text-zinc-500">{selected.class_name}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
                  ${selected.price.toLocaleString("en-US")}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">{labels.none}</p>
          )}
        </div>

        {selected && (
          <section className="mt-4 rounded-xl border border-zinc-100 p-4">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900">
              <Tag className="size-3.5" strokeWidth={1.75} />
              {labels.promos}
            </p>
            {promotions.length === 0 ? (
              <p className="mt-2 text-xs text-zinc-500">{labels.noPromos}</p>
            ) : (
              <div className="mt-3 space-y-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-zinc-50">
                  <input type="radio" name="promo" checked={selectedPromo === ""} onChange={() => onPromoChange("")} />
                  {labels.applyNone}
                </label>
                {promotions.map((promo) => (
                  <label
                    key={promo.promo_code}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm transition",
                      selectedPromo === promo.promo_code ? "bg-cerulean-500/10" : "hover:bg-zinc-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="promo"
                      className="mt-1"
                      checked={selectedPromo === promo.promo_code}
                      onChange={() => onPromoChange(promo.promo_code)}
                    />
                    <span>
                      <span className="font-semibold text-zinc-900">{promo.promo_code}</span>
                      <span className="ml-2 font-medium text-emerald-700">-{promo.discount_percent}%</span>
                      <br />
                      <span className="text-xs text-zinc-500">{promo.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-4">
              <span className="text-sm text-zinc-500">{labels.estimated}</span>
              <span className="text-xl font-bold tabular-nums text-zinc-900">${estimated.toLocaleString("en-US")}</span>
            </div>
          </section>
        )}

        <div className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-zinc-700">
            <span className="inline-flex items-center gap-1.5">
              <CreditCard className="size-3.5" strokeWidth={1.75} />
              Payment method
            </span>
            <select
              value={paymentMethod}
              onChange={(e) => onPaymentMethodChange(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-zinc-200 px-3 py-2.5 outline-none focus:border-cerulean-500"
            >
              <option value="CARD">Card</option>
              <option value="TRANSFER">Bank transfer</option>
              <option value="CASH">Cash</option>
            </select>
          </label>
        </div>

        <Button type="submit" size="lg" className="mt-5 w-full" disabled={!selected}>
          {flightIds.length > 1 ? labels.checkout : labels.reserve}
        </Button>

        <Link href="/bookings" className="mt-3 block text-center text-sm font-medium text-cerulean-700 hover:text-deep-space-blue">
          {labels.myBookings}
        </Link>

        <details className="mt-5 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">Advanced / demo tools</summary>
          <div className="mt-3 space-y-3">
            <label className="block text-xs font-medium text-zinc-600">
              {labels.lookupBooking}
              <input
                value={lookupBookingId}
                onChange={(e) => onLookupBookingIdChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-cerulean-500"
              />
            </label>
            <p className="text-[11px] text-zinc-400">{labels.autoIds}</p>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onLoadLedger}>
                {labels.lookup}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancelRefund}
                className="border-red-200 text-red-700 hover:border-red-300 hover:bg-red-50"
              >
                {labels.cancelRefund}
              </Button>
            </div>
          </div>
        </details>
      </form>
    </div>
  );
}
