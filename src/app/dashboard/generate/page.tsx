"use client";

import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { StaffMessage, useStaffAction } from "@/app/components/dashboard/useStaffAction";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";
const inputClass = "mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";
const buttonClass = "mt-5 rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90";

export default function GenerateFlightsPage() {
  const [schedules, setSchedules] = useState<Array<{ schedule_id: number; flight_number: string }>>([]);
  const [aircraft, setAircraft] = useState<Array<{ aircraft_id: number; model: string }>>([]);
  const { message, postJson } = useStaffAction(async () => {
    await loadMasterLists();
  });

  const [flightForm, setFlightForm] = useState({
    schedule_id: "1",
    aircraft_id: "101",
    start_date: "2026-06-01",
    end_date: "2026-06-30",
    trip_type_id: "1"
  });
  const [seatForm, setSeatForm] = useState({
    flight_id: "1001",
    economy_price: "780",
    business_price: "2400",
    first_price: "5200"
  });

  async function loadMasterLists() {
    const [scheduleRes, aircraftRes] = await Promise.all([
      fetch("/api/staff/master/schedules"),
      fetch("/api/staff/master/aircraft")
    ]);
    const scheduleJson = await scheduleRes.json();
    const aircraftJson = await aircraftRes.json();
    setSchedules((scheduleJson.data?.rows ?? []) as Array<{ schedule_id: number; flight_number: string }>);
    setAircraft((aircraftJson.data?.rows ?? []) as Array<{ aircraft_id: number; model: string }>);
  }

  useEffect(() => {
    loadMasterLists();
  }, []);

  return (
    <div className="space-y-8">
      <PageTitle icon={Plane} title="Flight Generation" description="Generate dated flights from schedules and populate seat inventory with prices." accent="sky" />
      <StaffMessage message={message} />
      <section className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            postJson("/api/staff/flights/generate", {
              schedule_id: Number(flightForm.schedule_id),
              aircraft_id: Number(flightForm.aircraft_id),
              start_date: flightForm.start_date,
              end_date: flightForm.end_date,
              trip_type_id: Number(flightForm.trip_type_id)
            });
          }}
          className={formCardClass}
        >
          <h2 className="text-lg font-semibold text-zinc-900">Generate Flights</h2>
          <div className="mt-5 grid gap-3">
            <label className="text-sm font-medium text-zinc-700">
              schedule_id
              <select value={flightForm.schedule_id} onChange={(e) => setFlightForm((p) => ({ ...p, schedule_id: e.target.value }))} className={inputClass}>
                {schedules.map((s) => (
                  <option key={s.schedule_id} value={s.schedule_id}>
                    {s.schedule_id} · {s.flight_number}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700">
              aircraft_id
              <select value={flightForm.aircraft_id} onChange={(e) => setFlightForm((p) => ({ ...p, aircraft_id: e.target.value }))} className={inputClass}>
                {aircraft.map((a) => (
                  <option key={a.aircraft_id} value={a.aircraft_id}>
                    {a.aircraft_id} · {a.model}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-zinc-700">
              trip_type_id
              <select value={flightForm.trip_type_id} onChange={(e) => setFlightForm((p) => ({ ...p, trip_type_id: e.target.value }))} className={inputClass}>
                <option value="1">1 · OneWay</option>
                <option value="2">2 · RoundTrip</option>
                <option value="3">3 · Connecting</option>
              </select>
            </label>
            {(["start_date", "end_date"] as const).map((key) => (
              <label key={key} className="text-sm font-medium text-zinc-700">
                {key}
                <input type="date" value={flightForm[key]} onChange={(e) => setFlightForm((p) => ({ ...p, [key]: e.target.value }))} className={inputClass} />
              </label>
            ))}
          </div>
          <button className={buttonClass}>Run Generation</button>
        </form>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            postJson("/api/staff/flights/seats-generate", {
              flight_id: Number(seatForm.flight_id),
              economy_price: Number(seatForm.economy_price),
              business_price: Number(seatForm.business_price),
              first_price: Number(seatForm.first_price)
            });
          }}
          className={formCardClass}
        >
          <h2 className="text-lg font-semibold text-zinc-900">Generate Seats and Prices</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {Object.keys(seatForm).map((key) => (
              <label key={key} className="text-sm font-medium text-zinc-700">
                {key}
                <input value={seatForm[key as keyof typeof seatForm]} onChange={(e) => setSeatForm((p) => ({ ...p, [key]: e.target.value }))} className={inputClass} />
              </label>
            ))}
          </div>
          <button className={buttonClass}>Generate Seats</button>
        </form>
      </section>
    </div>
  );
}
