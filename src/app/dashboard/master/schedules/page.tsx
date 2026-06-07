"use client";

import { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { useMasterLists, type ScheduleRow } from "@/app/components/dashboard/master/useMasterLists";
import { StaffMessage, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { normalizeTime24 } from "@/lib/formatDate";
import { nextNumericId } from "@/lib/masterDataOptions";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";

function formatTimeValue(value: unknown) {
  const raw = String(value ?? "");
  return raw.length >= 5 ? raw.slice(0, 5) : raw;
}

export default function SchedulesMasterPage() {
  const { airlines, airports, schedules, loading, error, reload } = useMasterLists({
    airlines: true,
    airports: true,
    schedules: true
  });
  const { message, postJson, setMessage } = useStaffAction(reload);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    schedule_id: "",
    airline_id: "",
    flight_number: "",
    dep_airport: "",
    arr_airport: "",
    dep_time: "09:00",
    arr_time: "12:00",
    valid_from: "2026-06-01",
    valid_to: "2026-06-30"
  });

  useEffect(() => {
    setMessage("");
  }, [selectedKey, setMessage]);

  useEffect(() => {
    if (!selectedKey && schedules.length && !form.schedule_id) {
      setForm((p) => ({
        ...p,
        schedule_id: String(nextNumericId(schedules as Record<string, unknown>[], "schedule_id", 1)),
        airline_id: p.airline_id || airlines[0]?.airline_id || "",
        dep_airport: p.dep_airport || airports[0]?.airport_code || "",
        arr_airport: p.arr_airport || airports[1]?.airport_code || airports[0]?.airport_code || ""
      }));
    }
  }, [schedules, airlines, airports, form.schedule_id, selectedKey]);

  function startNew() {
    setSelectedKey(null);
    setForm({
      schedule_id: String(nextNumericId(schedules as Record<string, unknown>[], "schedule_id", 1)),
      airline_id: airlines[0]?.airline_id ?? "",
      flight_number: "",
      dep_airport: airports[0]?.airport_code ?? "",
      arr_airport: airports[1]?.airport_code ?? airports[0]?.airport_code ?? "",
      dep_time: "09:00",
      arr_time: "12:00",
      valid_from: "2026-06-01",
      valid_to: "2026-06-30"
    });
  }

  function editRow(row: ScheduleRow) {
    setSelectedKey(String(row.schedule_id));
    setForm({
      schedule_id: String(row.schedule_id),
      airline_id: row.airline_id,
      flight_number: row.flight_number,
      dep_airport: row.dep_airport,
      arr_airport: row.arr_airport,
      dep_time: formatTimeValue(row.dep_time),
      arr_time: formatTimeValue(row.arr_time),
      valid_from: String(row.valid_from).slice(0, 10),
      valid_to: String(row.valid_to).slice(0, 10)
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await postJson("/api/staff/master/schedules", {
      schedule_id: Number(form.schedule_id),
      airline_id: form.airline_id,
      flight_number: form.flight_number.trim(),
      dep_airport: form.dep_airport,
      arr_airport: form.arr_airport,
      dep_time: `${normalizeTime24(form.dep_time)}:00`,
      arr_time: `${normalizeTime24(form.arr_time)}:00`,
      valid_from: form.valid_from,
      valid_to: form.valid_to
    });
    startNew();
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={CalendarClock}
        title="Flight Schedules"
        description="Define recurring routes, times, and validity windows for flight generation."
        accent="violet"
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <StaffMessage message={message} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        <form onSubmit={handleSubmit} className={formCardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">{selectedKey ? "Edit schedule" : "Add schedule"}</h2>
            {selectedKey ? (
              <button type="button" onClick={startNew} className="text-xs font-medium text-brand hover:underline">
                New instead
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MasterFormField label="Schedule ID" required>
              <input
                type="number"
                min={1}
                value={form.schedule_id}
                onChange={(e) => setForm((p) => ({ ...p, schedule_id: e.target.value }))}
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

            <div className="sm:col-span-2">
              <MasterFormField label="Flight number" hint="e.g. KE081" required>
                <input
                  value={form.flight_number}
                  onChange={(e) => setForm((p) => ({ ...p, flight_number: e.target.value.toUpperCase() }))}
                  placeholder="KE081"
                  className={masterInputClass}
                  required
                />
              </MasterFormField>
            </div>

            <MasterFormField label="Departure airport" required>
              <select
                value={form.dep_airport}
                onChange={(e) => setForm((p) => ({ ...p, dep_airport: e.target.value }))}
                className={masterInputClass}
                required
              >
                <option value="">Select airport…</option>
                {airports.map((airport) => (
                  <option key={airport.airport_code} value={airport.airport_code}>
                    {airport.airport_code} · {airport.city}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Arrival airport" required>
              <select
                value={form.arr_airport}
                onChange={(e) => setForm((p) => ({ ...p, arr_airport: e.target.value }))}
                className={masterInputClass}
                required
              >
                <option value="">Select airport…</option>
                {airports.map((airport) => (
                  <option key={airport.airport_code} value={airport.airport_code}>
                    {airport.airport_code} · {airport.city}
                  </option>
                ))}
              </select>
            </MasterFormField>

            <MasterFormField label="Departure time" hint="24-hour HH:MM" required>
              <input
                value={form.dep_time}
                onChange={(e) => setForm((p) => ({ ...p, dep_time: e.target.value }))}
                onBlur={(e) => setForm((p) => ({ ...p, dep_time: normalizeTime24(e.target.value) }))}
                placeholder="09:00"
                pattern="^(?:[01]\d|2[0-3]):[0-5]\d$"
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Arrival time" hint="24-hour HH:MM" required>
              <input
                value={form.arr_time}
                onChange={(e) => setForm((p) => ({ ...p, arr_time: e.target.value }))}
                onBlur={(e) => setForm((p) => ({ ...p, arr_time: normalizeTime24(e.target.value) }))}
                placeholder="12:00"
                pattern="^(?:[01]\d|2[0-3]):[0-5]\d$"
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Valid from" required>
              <input
                type="date"
                lang="en-US"
                value={form.valid_from}
                onChange={(e) => setForm((p) => ({ ...p, valid_from: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>

            <MasterFormField label="Valid to" required>
              <input
                type="date"
                lang="en-US"
                value={form.valid_to}
                onChange={(e) => setForm((p) => ({ ...p, valid_to: e.target.value }))}
                className={masterInputClass}
                required
              />
            </MasterFormField>
          </div>

          <button type="submit" className="mt-5 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
            {selectedKey ? "Update schedule" : "Save schedule"}
          </button>
        </form>

        <section className={formCardClass}>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">Existing schedules</h2>
          <p className="mb-4 text-sm text-zinc-500">Pick a template route, then generate dated flights from Flight Generation.</p>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <MasterRecordTable
              rows={schedules}
              rowKey={(row) => String(row.schedule_id)}
              selectedKey={selectedKey}
              onSelect={editRow}
              columns={[
                { key: "schedule_id", label: "ID" },
                { key: "flight_number", label: "Flight" },
                {
                  key: "route",
                  label: "Route",
                  render: (r) => `${r.dep_airport} → ${r.arr_airport}`
                },
                {
                  key: "dep_time",
                  label: "Times",
                  render: (r) => `${formatTimeValue(r.dep_time)} – ${formatTimeValue(r.arr_time)}`
                },
                {
                  key: "valid_from",
                  label: "Valid",
                  render: (r) => `${String(r.valid_from).slice(0, 10)} → ${String(r.valid_to).slice(0, 10)}`
                }
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
