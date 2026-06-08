"use client";

import { useState } from "react";
import { Tag } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { StaffMessage, useStaffAction } from "@/app/components/dashboard/useStaffAction";

export default function PromotionsPage() {
  const { message, postJson } = useStaffAction();
  const [promoForm, setPromoForm] = useState({
    promo_id: "",
    promo_code: "",
    description: "",
    dep_airport: "",
    arr_airport: "",
    class_id: "1",
    discount_percent: "10",
    valid_from: "2026-06-01",
    valid_to: "2026-06-30",
    is_active: true
  });

  const inputClass = "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

  return (
    <div className="space-y-8">
      <PageTitle icon={Tag} title="Promotions" description="Create route, class, and date-range discount rules." accent="amber" />
      <StaffMessage message={message} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          postJson("/api/staff/master/promotions", {
            promo_id: Number(promoForm.promo_id),
            promo_code: promoForm.promo_code,
            description: promoForm.description,
            schedule_id: null,
            dep_airport: promoForm.dep_airport || null,
            arr_airport: promoForm.arr_airport || null,
            class_id: Number(promoForm.class_id),
            discount_percent: Number(promoForm.discount_percent),
            valid_from: promoForm.valid_from,
            valid_to: promoForm.valid_to,
            is_active: promoForm.is_active
          });
        }}
        className="max-w-3xl rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-zinc-900">Promotion / Coupon</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Object.keys(promoForm).map((key) => (
            <label key={key} className="text-sm font-medium text-zinc-700">
              {key}
              <input
                type={key.includes("date") ? "date" : "text"}
                value={String(promoForm[key as keyof typeof promoForm])}
                onChange={(e) => setPromoForm((p) => ({ ...p, [key]: e.target.value }))}
                className={inputClass}
              />
            </label>
          ))}
        </div>
        <button className="mt-4 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90">Save Promotion</button>
      </form>
    </div>
  );
}
