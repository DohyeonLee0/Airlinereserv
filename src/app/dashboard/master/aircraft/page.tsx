"use client";

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { useMasterLists, type AircraftRow } from "@/app/components/dashboard/master/useMasterLists";
import { StaffMessage, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { AIRCRAFT_MODELS, nextNumericId } from "@/lib/masterDataOptions";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";

export default function AircraftMasterPage() {
  const { airlines, aircraft, loading, error, reload } = useMasterLists({ airlines: true, aircraft: true });
  const { message, postJson, setMessage } = useStaffAction(reload);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    aircraft_id: "",
    airline_id: "",
    model: AIRCRAFT_MODELS[0] as string,
    capacity: "300"
  });

  useEffect(() => {
    setMessage("");
  }, [selectedKey, setMessage]);

  useEffect(() => {
    if (!selectedKey && aircraft.length && !form.aircraft_id) {
      setForm((p) => ({
        ...p,
        aircraft_id: String(nextNumericId(aircraft as Record<string, unknown>[], "aircraft_id", 1)),
        airline_id: p.airline_id || airlines[0]?.airline_id || ""
      }));
    }
  }, [aircraft, airlines, form.aircraft_id, selectedKey]);

  function startNew() {
    setSelectedKey(null);
    setForm({
      aircraft_id: String(nextNumericId(aircraft as Record<string, unknown>[], "aircraft_id", 1)),
      airline_id: airlines[0]?.airline_id ?? "",
      model: AIRCRAFT_MODELS[0],
      capacity: "300"
    });
  }

  function editRow(row: AircraftRow) {
    setSelectedKey(String(row.aircraft_id));
    setForm({
      aircraft_id: String(row.aircraft_id),
      airline_id: row.airline_id,
      model: row.model,
      capacity: String(row.capacity)
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await postJson("/api/staff/master/aircraft", {
      aircraft_id: Number(form.aircraft_id),
      airline_id: form.airline_id,
      model: form.model,
      capacity: Number(form.capacity)
    });
    startNew();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Plane}
        title="Aircraft"
        description="Register fleet types and seat capacity per airline."
        accent="amber"
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <StaffMessage message={message} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <form onSubmit={handleSubmit} className={formCardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">{selectedKey ? "Edit aircraft" : "Add aircraft"}</h2>
            {selectedKey ? (
              <button type="button" onClick={startNew} className="text-xs font-medium text-brand hover:underline">
                New instead
              </button>
            ) : null}
          </div>

          <div className="space-y-4">
            <MasterFormField label="Aircraft ID" hint="Internal numeric ID" required>
              <input
                type="number"
                min={1}
                value={form.aircraft_id}
                onChange={(e) => setForm((p) => ({ ...p, aircraft_id: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Airline" required>
              <select
                value={form.airline_id}
                onChange={(e) => setForm((p) => ({ ...p, airline_id: e.target.value }))}
                className={masterInputClass}
                required
              >
                <option value="">Select airline…</option>
                {airlines.map((airline) => (
                  <option key={airline.airline_id} value={airline.airline_id}>
                    {airline.airline_id} · {airline.airline_name}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Model" required>
              <select
                value={form.model}
                onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
                className={masterInputClass}
                required
              >
                {AIRCRAFT_MODELS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Seat capacity" required>
              <input
                type="number"
                min={50}
                max={600}
                value={form.capacity}
                onChange={(e) => setForm((p) => ({ ...p, capacity: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>
          </div>

          <button type="submit" className="mt-5 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
            {selectedKey ? "Update aircraft" : "Save aircraft"}
          </button>
        </form>

        <section className={formCardClass}>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">Fleet list</h2>
          <p className="mb-4 text-sm text-zinc-500">Used when generating dated flights and seat maps.</p>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <MasterRecordTable
              rows={aircraft}
              rowKey={(row) => String(row.aircraft_id)}
              selectedKey={selectedKey}
              onSelect={editRow}
              columns={[
                { key: "aircraft_id", label: "ID" },
                { key: "airline_id", label: "Airline" },
                { key: "model", label: "Model" },
                { key: "capacity", label: "Seats" }
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
