"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { useMasterLists, type AirlineRow } from "@/app/components/dashboard/master/useMasterLists";
import { StaffAlertModal, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { COUNTRY_OPTIONS } from "@/lib/masterDataOptions";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";

export default function AirlinesMasterPage() {
  const { airlines, countryOptions, loading, error, reload } = useMasterLists({ airlines: true });
  const { alert, clearAlert, postJson, deleteJson } = useStaffAction(reload);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState({ airline_id: "", airline_name: "", country: "" });

  const countries = useMemo(
    () => Array.from(new Set([...COUNTRY_OPTIONS, ...countryOptions])).sort(),
    [countryOptions]
  );

  useEffect(() => {
    clearAlert();
  }, [selectedKey, clearAlert]);

  function startNew() {
    setSelectedKey(null);
    setForm({ airline_id: "", airline_name: "", country: countries[0] ?? "" });
  }

  function editRow(row: AirlineRow) {
    setSelectedKey(row.airline_id);
    setForm({
      airline_id: row.airline_id,
      airline_name: row.airline_name,
      country: row.country ?? ""
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const airlineId = form.airline_id.trim().toUpperCase();
    const result = await postJson("/api/staff/master/airlines", {
      ...(selectedKey ? { original_airline_id: selectedKey } : {}),
      airline_id: airlineId,
      airline_name: form.airline_name.trim(),
      country: form.country || null
    });
    if (result.ok) startNew();
  }

  async function handleDelete(row: AirlineRow) {
    if (!confirm(`Delete airline ${row.airline_id}?`)) return;
    await deleteJson("/api/staff/master/airlines/delete", { airline_id: row.airline_id });
    if (selectedKey === row.airline_id) startNew();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Building2}
        title="Airlines"
        description="Manage airline codes, names, and home countries."
        accent="brand"
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <StaffAlertModal alert={alert} onClose={clearAlert} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={handleSubmit} className={formCardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">{selectedKey ? "Edit airline" : "Add airline"}</h2>
            {selectedKey ? (
              <button type="button" onClick={startNew} className="text-xs font-medium text-brand hover:underline">
                New instead
              </button>
            ) : null}
          </div>

          <div className="space-y-4">
            <MasterFormField
              label="Airline code"
              hint={
                selectedKey
                  ? "Changing the code also updates linked aircraft and schedules."
                  : "2-letter IATA code, e.g. KE"
              }
              required
            >
              <input
                value={form.airline_id}
                onChange={(e) => setForm((p) => ({ ...p, airline_id: e.target.value.toUpperCase() }))}
                maxLength={10}
                placeholder="KE"
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Airline name" required>
              <input
                value={form.airline_name}
                onChange={(e) => setForm((p) => ({ ...p, airline_name: e.target.value }))}
                placeholder="Korean Air"
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Country">
              <select
                value={form.country}
                onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))}
                className={masterInputClass}
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
            {selectedKey ? "Update airline" : "Save airline"}
          </button>
        </form>

        <section className={formCardClass}>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">Existing airlines</h2>
          <p className="mb-4 text-sm text-zinc-500">Click a row to edit, or use the trash icon to remove.</p>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <MasterRecordTable
              rows={airlines}
              rowKey={(row) => row.airline_id}
              selectedKey={selectedKey}
              onSelect={editRow}
              onDelete={handleDelete}
              columns={[
                { key: "airline_id", label: "Code" },
                { key: "airline_name", label: "Name" },
                { key: "country", label: "Country", render: (r) => r.country ?? "—" }
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
