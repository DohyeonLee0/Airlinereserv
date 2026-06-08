"use client";

import { useEffect, useMemo, useState } from "react";
import { Tag } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { useMasterLists } from "@/app/components/dashboard/master/useMasterLists";
import { StaffAlertModal, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { StaffConfirmModal, type StaffConfirmState } from "@/app/components/dashboard/StaffConfirmModal";
import { SEAT_CLASS_OPTIONS } from "@/lib/aircraftSeatLayouts";
import { nextNumericId } from "@/lib/masterDataOptions";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";

type PromotionRow = {
  promo_id: number;
  promo_code: string;
  description: string | null;
  schedule_id: number | null;
  dep_airport: string | null;
  arr_airport: string | null;
  class_id: number | null;
  discount_percent: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean | number;
};

const EMPTY_FORM = {
  promo_id: "",
  promo_code: "",
  description: "",
  schedule_id: "",
  dep_airport: "",
  arr_airport: "",
  class_id: "",
  discount_percent: "10",
  valid_from: "2026-06-01",
  valid_to: "2026-06-30",
  is_active: true
};

function classLabel(classId: number | null | undefined) {
  if (!classId) return "All classes";
  return SEAT_CLASS_OPTIONS.find((option) => option.class_id === classId)?.class_name ?? `Class ${classId}`;
}

function formatScope(row: PromotionRow) {
  if (row.schedule_id) return `Schedule #${row.schedule_id}`;
  const dep = row.dep_airport?.trim();
  const arr = row.arr_airport?.trim();
  if (dep && arr) return `${dep} → ${arr}`;
  if (dep) return `From ${dep}`;
  if (arr) return `To ${arr}`;
  return "All routes";
}

function formatValidity(from: string, to: string) {
  return `${String(from).slice(0, 10)} → ${String(to).slice(0, 10)}`;
}

export default function PromotionsPage() {
  const { airports, schedules, loading: masterLoading, error: masterError } = useMasterLists({
    airports: true,
    schedules: true
  });
  const [promotions, setPromotions] = useState<PromotionRow[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [deactivateConfirm, setDeactivateConfirm] = useState<(StaffConfirmState & { promoId: number }) | null>(
    null
  );
  const [isDeactivating, setIsDeactivating] = useState(false);

  async function loadPromotions() {
    setLoadingPromos(true);
    const response = await fetch("/api/staff/master/promotions");
    const json = await response.json();
    if (response.ok) {
      setPromotions((json.data?.rows ?? []) as PromotionRow[]);
    }
    setLoadingPromos(false);
  }

  async function refreshAll() {
    await loadPromotions();
  }

  const { alert, showAlert, clearAlert, postJson, deleteJson } = useStaffAction(refreshAll);

  useEffect(() => {
    void loadPromotions();
  }, []);

  useEffect(() => {
    if (!selectedKey && promotions.length && !form.promo_id) {
      setForm((prev) => ({
        ...prev,
        promo_id: String(nextNumericId(promotions as unknown as Record<string, unknown>[], "promo_id", 1))
      }));
    }
  }, [promotions, form.promo_id, selectedKey]);

  useEffect(() => {
    clearAlert();
  }, [selectedKey, clearAlert]);

  const scopePreview = useMemo(() => {
    const draft: PromotionRow = {
      promo_id: Number(form.promo_id) || 0,
      promo_code: form.promo_code,
      description: form.description,
      schedule_id: form.schedule_id ? Number(form.schedule_id) : null,
      dep_airport: form.dep_airport || null,
      arr_airport: form.arr_airport || null,
      class_id: form.class_id ? Number(form.class_id) : null,
      discount_percent: Number(form.discount_percent) || 0,
      valid_from: form.valid_from,
      valid_to: form.valid_to,
      is_active: form.is_active
    };
    return `${formatScope(draft)} · ${classLabel(draft.class_id)} · ${draft.discount_percent || 0}% off`;
  }, [form]);

  function startNew() {
    setSelectedKey(null);
    setForm({
      ...EMPTY_FORM,
      promo_id: String(nextNumericId(promotions as unknown as Record<string, unknown>[], "promo_id", 1))
    });
  }

  function editRow(row: PromotionRow) {
    setSelectedKey(String(row.promo_id));
    setForm({
      promo_id: String(row.promo_id),
      promo_code: row.promo_code,
      description: row.description ?? "",
      schedule_id: row.schedule_id ? String(row.schedule_id) : "",
      dep_airport: row.dep_airport ?? "",
      arr_airport: row.arr_airport ?? "",
      class_id: row.class_id ? String(row.class_id) : "",
      discount_percent: String(row.discount_percent),
      valid_from: String(row.valid_from).slice(0, 10),
      valid_to: String(row.valid_to).slice(0, 10),
      is_active: Boolean(row.is_active)
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.promo_code.trim()) {
      showAlert("Promo code is required.", { title: "Missing code", variant: "warning" });
      return;
    }
    const discount = Number(form.discount_percent);
    if (!Number.isFinite(discount) || discount <= 0 || discount > 100) {
      showAlert("Discount must be between 1 and 100.", { title: "Invalid discount", variant: "warning" });
      return;
    }
    if (form.valid_from > form.valid_to) {
      showAlert("Valid from must be on or before valid to.", { title: "Invalid dates", variant: "warning" });
      return;
    }

    const result = await postJson(
      "/api/staff/master/promotions",
      {
        promo_id: Number(form.promo_id),
        promo_code: form.promo_code.trim().toUpperCase(),
        description: form.description.trim() || null,
        schedule_id: form.schedule_id ? Number(form.schedule_id) : null,
        dep_airport: form.schedule_id ? null : form.dep_airport || null,
        arr_airport: form.schedule_id ? null : form.arr_airport || null,
        class_id: form.class_id ? Number(form.class_id) : null,
        discount_percent: discount,
        valid_from: form.valid_from,
        valid_to: form.valid_to,
        is_active: form.is_active
      },
      "POST",
      { silentSuccess: true }
    );
    if (!result.ok) return;

    showAlert(`Promotion "${form.promo_code.trim().toUpperCase()}" saved.`, {
      title: "Promotion saved",
      variant: "success"
    });
    await loadPromotions();
    startNew();
  }

  function requestDeactivate(row: PromotionRow) {
    setDeactivateConfirm({
      promoId: row.promo_id,
      title: "Deactivate promotion?",
      message: `Deactivate "${row.promo_code}"? Customers will no longer see this code at checkout.`,
      confirmLabel: "Deactivate",
      tone: "warning"
    });
  }

  async function confirmDeactivate() {
    if (!deactivateConfirm) return;
    setIsDeactivating(true);
    try {
      await deleteJson("/api/staff/master/promotions", { promo_id: deactivateConfirm.promoId });
      if (selectedKey === String(deactivateConfirm.promoId)) startNew();
      setDeactivateConfirm(null);
      await loadPromotions();
    } finally {
      setIsDeactivating(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Tag}
        title="Promotions"
        description="Create coupon codes with route, seat class, and date rules. Customers enter the code at checkout."
        accent="amber"
      />

      {masterError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{masterError}</div>
      ) : null}

      <StaffAlertModal alert={alert} onClose={clearAlert} />
      <StaffConfirmModal
        confirm={deactivateConfirm}
        isPending={isDeactivating}
        onCancel={() => {
          if (!isDeactivating) setDeactivateConfirm(null);
        }}
        onConfirm={() => void confirmDeactivate()}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <form onSubmit={handleSubmit} className={formCardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">{selectedKey ? "Edit promotion" : "Add promotion"}</h2>
            {selectedKey ? (
              <button type="button" onClick={startNew} className="text-xs font-medium text-brand hover:underline">
                New instead
              </button>
            ) : null}
          </div>

          <p className="mb-4 text-sm text-zinc-500">
            Leave route fields as <span className="font-medium text-zinc-700">Any</span> to apply globally. Pick a
            specific schedule to target one recurring leg only.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <MasterFormField label="Promo ID" required>
              <input
                type="number"
                min={1}
                value={form.promo_id}
                onChange={(e) => setForm((prev) => ({ ...prev, promo_id: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Promo code" required hint="Shown to customers at checkout">
              <input
                value={form.promo_code}
                onChange={(e) => setForm((prev) => ({ ...prev, promo_code: e.target.value.toUpperCase() }))}
                className={masterInputClass}
                placeholder="SUMMER10"
                required
              />
            </MasterFormField>

            <div className="sm:col-span-2">
              <MasterFormField label="Description">
                <input
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  className={masterInputClass}
                  placeholder="Summer sale for ICN–JFK economy"
                />
              </MasterFormField>
            </div>

            <MasterFormField label="Discount (%)" required>
              <input
                type="number"
                min={1}
                max={100}
                step="0.01"
                value={form.discount_percent}
                onChange={(e) => setForm((prev) => ({ ...prev, discount_percent: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Seat class" hint="Any = all classes">
              <select
                value={form.class_id}
                onChange={(e) => setForm((prev) => ({ ...prev, class_id: e.target.value }))}
                className={masterInputClass}
              >
                <option value="">Any class</option>
                {SEAT_CLASS_OPTIONS.map((option) => (
                  <option key={option.class_id} value={option.class_id}>
                    {option.class_name}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Specific schedule" hint="Optional — overrides route picks below">
              <select
                value={form.schedule_id}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    schedule_id: e.target.value,
                    dep_airport: e.target.value ? "" : prev.dep_airport,
                    arr_airport: e.target.value ? "" : prev.arr_airport
                  }))
                }
                className={masterInputClass}
                disabled={masterLoading}
              >
                <option value="">Any schedule</option>
                {schedules.map((schedule) => (
                  <option key={schedule.schedule_id} value={schedule.schedule_id}>
                    #{schedule.schedule_id} · {schedule.flight_number} · {schedule.dep_airport} → {schedule.arr_airport}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Departure airport" hint="Any = all origins">
              <select
                value={form.dep_airport}
                onChange={(e) => setForm((prev) => ({ ...prev, dep_airport: e.target.value, schedule_id: "" }))}
                className={masterInputClass}
                disabled={Boolean(form.schedule_id)}
              >
                <option value="">Any departure</option>
                {airports.map((airport) => (
                  <option key={airport.airport_code} value={airport.airport_code}>
                    {airport.airport_code} · {airport.city}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Arrival airport" hint="Any = all destinations">
              <select
                value={form.arr_airport}
                onChange={(e) => setForm((prev) => ({ ...prev, arr_airport: e.target.value, schedule_id: "" }))}
                className={masterInputClass}
                disabled={Boolean(form.schedule_id)}
              >
                <option value="">Any arrival</option>
                {airports.map((airport) => (
                  <option key={airport.airport_code} value={airport.airport_code}>
                    {airport.airport_code} · {airport.city}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Valid from" required>
              <input
                type="date"
                lang="en-US"
                value={form.valid_from}
                onChange={(e) => setForm((prev) => ({ ...prev, valid_from: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Valid to" required>
              <input
                type="date"
                lang="en-US"
                value={form.valid_to}
                onChange={(e) => setForm((prev) => ({ ...prev, valid_to: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="size-4 rounded border-zinc-300 text-navy focus:ring-brand/30"
                />
                Active (customers can use this code)
              </label>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 text-sm text-amber-950">
            <span className="font-medium">Preview:</span> {scopePreview}
          </div>

          <button type="submit" className="mt-4 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
            {selectedKey ? "Update promotion" : "Save promotion"}
          </button>
        </form>

        <section className={formCardClass}>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">Saved promotions</h2>
          <p className="mb-4 text-sm text-zinc-500">Click a row to edit. Deactivate removes the code from checkout.</p>

          {loadingPromos ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <MasterRecordTable
              rows={promotions as unknown as Record<string, unknown>[]}
              rowKey={(row) => String((row as PromotionRow).promo_id)}
              selectedKey={selectedKey}
              onSelect={(row) => editRow(row as unknown as PromotionRow)}
              onDelete={(row) => requestDeactivate(row as unknown as PromotionRow)}
              pageSize={10}
              columns={[
                { key: "promo_code", label: "Code" },
                {
                  key: "scope",
                  label: "Applies to",
                  render: (row) => formatScope(row as unknown as PromotionRow)
                },
                {
                  key: "class_id",
                  label: "Class",
                  render: (row) => classLabel((row as PromotionRow).class_id)
                },
                {
                  key: "discount_percent",
                  label: "Off",
                  render: (row) => `${(row as PromotionRow).discount_percent}%`
                },
                {
                  key: "validity",
                  label: "Valid",
                  render: (row) =>
                    formatValidity(String((row as PromotionRow).valid_from), String((row as PromotionRow).valid_to))
                },
                {
                  key: "is_active",
                  label: "Status",
                  render: (row) => {
                    const active = Boolean((row as PromotionRow).is_active);
                    return active ? "Active" : "Inactive";
                  }
                }
              ]}
              emptyMessage="No promotions yet. Create one on the left."
            />
          )}
        </section>
      </div>
    </div>
  );
}
