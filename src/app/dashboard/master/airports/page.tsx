"use client";

import { useEffect, useMemo, useState } from "react";
import { TowerControl } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { useMasterLists, type AirportRow } from "@/app/components/dashboard/master/useMasterLists";
import { StaffAlertModal, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { COUNTRY_OPTIONS } from "@/lib/masterDataOptions";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";

export default function AirportsMasterPage() {
  const { airports, countryOptions, loading, error, reload } = useMasterLists({ airports: true });
  const { alert, clearAlert, postJson, deleteJson } = useStaffAction(reload);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState({ airport_code: "", airport_name: "", city: "", country: "" });

  const countries = useMemo(
    () => Array.from(new Set([...COUNTRY_OPTIONS, ...countryOptions])).sort(),
    [countryOptions]
  );

  useEffect(() => {
    clearAlert();
  }, [selectedKey, clearAlert]);

  function startNew() {
    setSelectedKey(null);
    setForm({ airport_code: "", airport_name: "", city: "", country: countries[0] ?? "" });
  }

  function editRow(row: AirportRow) {
    setSelectedKey(row.airport_code);
    setForm({
      airport_code: row.airport_code,
      airport_name: row.airport_name,
      city: row.city,
      country: row.country
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const airportCode = form.airport_code.trim().toUpperCase();
    const result = await postJson("/api/staff/master/airports", {
      ...(selectedKey ? { original_airport_code: selectedKey } : {}),
      airport_code: airportCode,
      airport_name: form.airport_name.trim(),
      city: form.city.trim(),
      country: form.country
    });
    if (result.ok) startNew();
  }

  async function handleDelete(row: AirportRow) {
    if (!confirm(`Delete airport ${row.airport_code}?`)) return;
    await deleteJson("/api/staff/master/airports/delete", { airport_code: row.airport_code });
    if (selectedKey === row.airport_code) startNew();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={TowerControl}
        title="Airports"
        description="Maintain IATA airport codes used in schedules and bookings."
        accent="sky"
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <StaffAlertModal alert={alert} onClose={clearAlert} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={handleSubmit} className={formCardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">{selectedKey ? "Edit airport" : "Add airport"}</h2>
            {selectedKey ? (
              <button type="button" onClick={startNew} className="text-xs font-medium text-brand hover:underline">
                New instead
              </button>
            ) : null}
          </div>

          <div className="space-y-4">
            <MasterFormField
              label="Airport code"
              hint={
                selectedKey
                  ? "Changing the code also updates linked schedules, routes, and promotions."
                  : "3-letter IATA code"
              }
              required
            >
              <input
                value={form.airport_code}
                onChange={(e) => setForm((p) => ({ ...p, airport_code: e.target.value.toUpperCase() }))}
                maxLength={3}
                placeholder="ICN"
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Airport name" required>
              <input
                value={form.airport_name}
                onChange={(e) => setForm((p) => ({ ...p, airport_name: e.target.value }))}
                placeholder="Incheon International Airport"
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="City" required>
              <input
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="Incheon"
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Country" required>
              <select
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                className={masterInputClass}
                required
              >
                <option value="">Select country…</option>
                {countries.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>
            </MasterFormField>
          </div>

          <button type="submit" className="mt-5 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
            {selectedKey ? "Update airport" : "Save airport"}
          </button>
        </form>

        <section className={formCardClass}>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">Existing airports</h2>
          <p className="mb-4 text-sm text-zinc-500">These codes appear in flight schedule dropdowns.</p>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <MasterRecordTable
              rows={airports}
              rowKey={(row) => row.airport_code}
              selectedKey={selectedKey}
              onSelect={editRow}
              onDelete={handleDelete}
              columns={[
                { key: "airport_code", label: "Code" },
                { key: "airport_name", label: "Name" },
                { key: "city", label: "City" },
                { key: "country", label: "Country" }
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
