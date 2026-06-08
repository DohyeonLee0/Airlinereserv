"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Minus, Plus } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { useMasterLists, type ScheduleRow } from "@/app/components/dashboard/master/useMasterLists";
import {
  RegistrationSuccessModal,
  type RegistrationSuccessDetail
} from "@/app/components/dashboard/master/RegistrationSuccessModal";
import { StaffMessage, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { generateFlightNumber } from "@/lib/flightNumber";
import { normalizeTime24 } from "@/lib/formatDate";
import { nextNumericId } from "@/lib/masterDataOptions";
import { cn } from "@/lib/cn";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const DEFAULT_OPERATING_DAYS = ["MON", "WED", "FRI"];

type ScheduleMode = "direct" | "connecting";

type LegForm = {
  schedule_id: string;
  airline_id: string;
  flight_number: string;
  dep_airport: string;
  arr_airport: string;
  dep_time: string;
  arr_time: string;
  aircraft_id: string;
};

type ConnectingItineraryRow = {
  itinerary_id: number;
  departure_airport_code: string;
  arrival_airport_code: string;
  route_label: string | null;
  leg_summary: string | null;
  schedule_leg_count: number;
  generated_leg_count: number;
};

function buildConnectingRouteLabel(legs: LegForm[]) {
  if (!legs.length) return "";
  return [legs[0].dep_airport, ...legs.map((leg) => leg.arr_airport)].join(" → ");
}

function formatTimeValue(value: unknown) {
  const raw = String(value ?? "");
  return raw.length >= 5 ? raw.slice(0, 5) : raw;
}

function toSqlTime(value: string) {
  return `${normalizeTime24(value)}:00`;
}

function addMinutesToTime(time: string, minutes: number) {
  const [hours, mins] = time.split(":").map(Number);
  const total = hours * 60 + mins + minutes;
  const nextHours = Math.floor(total / 60) % 24;
  const nextMinutes = total % 60;
  return `${String(nextHours).padStart(2, "0")}:${String(nextMinutes).padStart(2, "0")}`;
}

function createLeg(
  scheduleId: number,
  dep: string,
  arr: string,
  airlineId = "",
  aircraftId = "101",
  validFrom = "2026-06-01",
  legIndex = 1,
  previousArrTime?: string
): LegForm {
  const dep_time = legIndex === 1 ? "08:00" : addMinutesToTime(previousArrTime ?? "18:00", 60);
  const arr_time = legIndex === 1 ? "18:00" : addMinutesToTime(dep_time, 180);

  return {
    schedule_id: String(scheduleId),
    airline_id: airlineId,
    flight_number: airlineId
      ? generateFlightNumber({ airlineId, aircraftId, date: validFrom, scheduleId, legIndex })
      : "",
    dep_airport: dep,
    arr_airport: arr,
    dep_time,
    arr_time,
    aircraft_id: aircraftId
  };
}

function layoverMinutes(previousArrTime: string, nextDepTime: string) {
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  return toMinutes(nextDepTime) - toMinutes(previousArrTime);
}

export default function SchedulesMasterPage() {
  const { airlines, airports, aircraft, schedules, loading, error, reload } = useMasterLists({
    airlines: true,
    airports: true,
    aircraft: true,
    schedules: true
  });
  async function refreshMasterData() {
    await reload();
    await loadConnectingItineraries();
  }

  const { message, postJson, deleteJson, setMessage } = useStaffAction(refreshMasterData);
  const [successDetail, setSuccessDetail] = useState<RegistrationSuccessDetail | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<ScheduleMode>("direct");
  const [connectingItineraries, setConnectingItineraries] = useState<ConnectingItineraryRow[]>([]);
  const [selectedDirectKey, setSelectedDirectKey] = useState<string | null>(null);
  const [selectedItineraryKey, setSelectedItineraryKey] = useState<string | null>(null);
  const [directForm, setDirectForm] = useState({
    schedule_id: "",
    airline_id: "",
    aircraft_id: "101",
    dep_airport: "",
    arr_airport: "",
    dep_time: "09:00",
    arr_time: "12:00",
    valid_from: "2026-06-01",
    valid_to: "2026-06-30"
  });
  const [connectingForm, setConnectingForm] = useState({
    itinerary_id: "",
    departure_airport_code: "ICN",
    arrival_airport_code: "JFK",
    valid_from: "2026-06-01",
    valid_to: "2026-06-30",
    start_date: "2026-06-01",
    end_date: "2026-06-30",
    operating_days: [...DEFAULT_OPERATING_DAYS],
    legs: [
      createLeg(1, "ICN", "LAX", "", "101", "2026-06-01", 1),
      createLeg(2, "LAX", "JFK", "", "101", "2026-06-01", 2)
    ] as LegForm[]
  });

  async function loadConnectingItineraries() {
    const response = await fetch("/api/staff/master/itineraries/connecting");
    const json = await response.json();
    if (response.ok) {
      setConnectingItineraries((json.data?.rows ?? []) as ConnectingItineraryRow[]);
    }
  }

  useEffect(() => {
    void loadConnectingItineraries();
  }, [message, schedules.length]);

  useEffect(() => {
    setMessage("");
  }, [selectedDirectKey, selectedItineraryKey, mode, setMessage]);

  useEffect(() => {
    if (!selectedDirectKey && schedules.length && !directForm.schedule_id) {
      setDirectForm((prev) => ({
        ...prev,
        schedule_id: String(nextNumericId(schedules as Record<string, unknown>[], "schedule_id", 1)),
        airline_id: prev.airline_id || airlines[0]?.airline_id || "",
        dep_airport: prev.dep_airport || airports[0]?.airport_code || "",
        arr_airport: prev.arr_airport || airports[1]?.airport_code || airports[0]?.airport_code || ""
      }));
    }
  }, [schedules, airlines, airports, directForm.schedule_id, selectedDirectKey]);

  useEffect(() => {
    if (!selectedItineraryKey && !connectingForm.itinerary_id) {
      const baseScheduleId = nextNumericId(schedules as Record<string, unknown>[], "schedule_id", 1);
      const airlineId = airlines[0]?.airline_id ?? "";
      const origin = airports[0]?.airport_code ?? "ICN";
      const hub = airports.find((airport) => airport.airport_code === "LAX")?.airport_code ?? airports[1]?.airport_code ?? "LAX";
      const destination =
        airports.find((airport) => airport.airport_code === "JFK")?.airport_code ?? airports[2]?.airport_code ?? "JFK";
      setConnectingForm((prev) => ({
        ...prev,
        itinerary_id: String(nextNumericId(connectingItineraries as unknown as Record<string, unknown>[], "itinerary_id", 7000)),
        departure_airport_code: origin,
        arrival_airport_code: destination,
        legs: [
          createLeg(baseScheduleId, origin, hub, airlineId, "101", prev.valid_from, 1),
          createLeg(baseScheduleId + 1, hub, destination, airlineId, "101", prev.valid_from, 2)
        ]
      }));
    }
  }, [schedules, airlines, airports, connectingForm.itinerary_id, connectingItineraries, selectedItineraryKey]);

  function startNewDirect() {
    setMode("direct");
    setSelectedDirectKey(null);
    setSelectedItineraryKey(null);
    setDirectForm({
      schedule_id: String(nextNumericId(schedules as Record<string, unknown>[], "schedule_id", 1)),
      airline_id: airlines[0]?.airline_id ?? "",
      aircraft_id: String(aircraft[0]?.aircraft_id ?? 101),
      dep_airport: airports[0]?.airport_code ?? "",
      arr_airport: airports[1]?.airport_code ?? airports[0]?.airport_code ?? "",
      dep_time: "09:00",
      arr_time: "12:00",
      valid_from: "2026-06-01",
      valid_to: "2026-06-30"
    });
  }

  function startNewConnecting() {
    setMode("connecting");
    setSelectedDirectKey(null);
    setSelectedItineraryKey(null);
    const baseScheduleId = nextNumericId(schedules as Record<string, unknown>[], "schedule_id", 1);
    const airlineId = airlines[0]?.airline_id ?? "";
    const origin = airports[0]?.airport_code ?? "ICN";
    const hub = airports.find((airport) => airport.airport_code === "LAX")?.airport_code ?? airports[1]?.airport_code ?? "LAX";
    const destination =
      airports.find((airport) => airport.airport_code === "JFK")?.airport_code ?? airports[2]?.airport_code ?? "JFK";
    setConnectingForm({
      itinerary_id: String(nextNumericId(connectingItineraries as unknown as Record<string, unknown>[], "itinerary_id", 7000)),
      departure_airport_code: origin,
      arrival_airport_code: destination,
      valid_from: "2026-06-01",
      valid_to: "2026-06-30",
      start_date: "2026-06-01",
      end_date: "2026-06-30",
      operating_days: [...DEFAULT_OPERATING_DAYS],
      legs: [
        createLeg(baseScheduleId, origin, hub, airlineId, String(aircraft[0]?.aircraft_id ?? 101), "2026-06-01", 1),
        createLeg(baseScheduleId + 1, hub, destination, airlineId, String(aircraft[0]?.aircraft_id ?? 101), "2026-06-01", 2)
      ]
    });
  }

  function editDirectRow(row: ScheduleRow) {
    setMode("direct");
    setSelectedDirectKey(String(row.schedule_id));
    setSelectedItineraryKey(null);
    setDirectForm({
      schedule_id: String(row.schedule_id),
      airline_id: row.airline_id,
      aircraft_id: String(aircraft[0]?.aircraft_id ?? 101),
      dep_airport: row.dep_airport,
      arr_airport: row.arr_airport,
      dep_time: formatTimeValue(row.dep_time),
      arr_time: formatTimeValue(row.arr_time),
      valid_from: String(row.valid_from).slice(0, 10),
      valid_to: String(row.valid_to).slice(0, 10)
    });
  }

  function updateLeg(index: number, patch: Partial<LegForm>) {
    setConnectingForm((prev) => {
      const legs = prev.legs.map((leg, legIndex) => (legIndex === index ? { ...leg, ...patch } : leg));
      if (patch.arr_airport && index < legs.length - 1) {
        legs[index + 1] = { ...legs[index + 1], dep_airport: patch.arr_airport };
      }
      if (patch.dep_airport && index > 0) {
        legs[index - 1] = { ...legs[index - 1], arr_airport: patch.dep_airport };
      }
      if (patch.arr_time && index < legs.length - 1) {
        const minNextDep = addMinutesToTime(patch.arr_time, 60);
        const nextDep = legs[index + 1].dep_time;
        if (layoverMinutes(patch.arr_time, nextDep) < 60) {
          legs[index + 1] = { ...legs[index + 1], dep_time: minNextDep };
        }
      }
      return {
        ...prev,
        legs: legs.map((leg, legIndex) => ({
          ...leg,
          flight_number: leg.airline_id
            ? generateFlightNumber({
                airlineId: leg.airline_id,
                aircraftId: leg.aircraft_id,
                date: prev.valid_from,
                scheduleId: leg.schedule_id,
                legIndex: legIndex + 1
              })
            : ""
        }))
      };
    });
  }

  function addLeg() {
    setConnectingForm((prev) => {
      const last = prev.legs.at(-1);
      const nextScheduleId = nextNumericId(
        [...schedules, ...prev.legs.map((leg) => ({ schedule_id: Number(leg.schedule_id) }))] as Record<string, unknown>[],
        "schedule_id",
        1
      );
      const dep = last?.arr_airport ?? prev.departure_airport_code;
      const arr = prev.arrival_airport_code;
      return {
        ...prev,
        legs: [
          ...prev.legs,
          createLeg(
            nextScheduleId,
            dep,
            arr,
            airlines[0]?.airline_id ?? "",
            String(aircraft[0]?.aircraft_id ?? 101),
            prev.valid_from,
            prev.legs.length + 1,
            last?.arr_time
          )
        ]
      };
    });
  }

  function removeLeg(index: number) {
    setConnectingForm((prev) => {
      if (prev.legs.length <= 2) return prev;
      const legs = prev.legs.filter((_, legIndex) => legIndex !== index);
      legs[0] = { ...legs[0], dep_airport: prev.departure_airport_code };
      legs[legs.length - 1] = { ...legs[legs.length - 1], arr_airport: prev.arrival_airport_code };
      for (let i = 1; i < legs.length; i += 1) {
        legs[i] = { ...legs[i], dep_airport: legs[i - 1].arr_airport };
      }
      return {
        ...prev,
        legs: legs.map((leg, legIndex) => ({
          ...leg,
          flight_number: leg.airline_id
            ? generateFlightNumber({
                airlineId: leg.airline_id,
                aircraftId: leg.aircraft_id,
                date: prev.valid_from,
                scheduleId: leg.schedule_id,
                legIndex: legIndex + 1
              })
            : ""
        }))
      };
    });
  }

  function toggleOperatingDay(day: (typeof WEEKDAYS)[number]) {
    setConnectingForm((prev) => ({
      ...prev,
      operating_days: prev.operating_days.includes(day)
        ? prev.operating_days.filter((value) => value !== day)
        : [...prev.operating_days, day]
    }));
  }

  const directFlightNumber = useMemo(() => {
    if (!directForm.airline_id) return "";
    return generateFlightNumber({
      airlineId: directForm.airline_id,
      aircraftId: directForm.aircraft_id,
      date: directForm.valid_from,
      scheduleId: directForm.schedule_id
    });
  }, [directForm.airline_id, directForm.aircraft_id, directForm.valid_from, directForm.schedule_id]);

  function airlineName(airlineId: string) {
    return airlines.find((airline) => airline.airline_id === airlineId)?.airline_name ?? airlineId;
  }

  function aircraftLabel(aircraftId: string) {
    const item = aircraft.find((row) => String(row.aircraft_id) === aircraftId);
    return item ? `${item.aircraft_id} · ${item.model}` : aircraftId;
  }

  function buildConnectingLegDetails(legs: typeof connectingLegsPrepared) {
    return legs.map((leg, index) => ({
      leg_index: index + 1,
      schedule_id: Number(leg.schedule_id),
      airline_id: leg.airline_id,
      airline_name: airlineName(leg.airline_id),
      flight_number: leg.flight_number,
      dep_airport: leg.dep_airport,
      arr_airport: leg.arr_airport,
      dep_time: leg.dep_time,
      arr_time: leg.arr_time
    }));
  }

  const connectingLegsPrepared = useMemo(
    () =>
      connectingForm.legs.map((leg, index) => ({
        ...leg,
        flight_number: leg.airline_id
          ? generateFlightNumber({
              airlineId: leg.airline_id,
              aircraftId: leg.aircraft_id,
              date: connectingForm.valid_from,
              scheduleId: leg.schedule_id,
              legIndex: index + 1
            })
          : ""
      })),
    [connectingForm.legs, connectingForm.valid_from]
  );

  async function handleDirectSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = await postJson("/api/staff/master/schedules", {
      schedule_id: Number(directForm.schedule_id),
      airline_id: directForm.airline_id,
      flight_number: directFlightNumber,
      dep_airport: directForm.dep_airport,
      arr_airport: directForm.arr_airport,
      dep_time: toSqlTime(directForm.dep_time),
      arr_time: toSqlTime(directForm.arr_time),
      valid_from: directForm.valid_from,
      valid_to: directForm.valid_to
    });
    if (!result.ok) return;

    setMessage("");
    setSuccessDetail({
      kind: "direct",
      schedule_id: directForm.schedule_id,
      airline_id: directForm.airline_id,
      airline_name: airlineName(directForm.airline_id),
      aircraft_label: aircraftLabel(directForm.aircraft_id),
      flight_number: directFlightNumber,
      dep_airport: directForm.dep_airport,
      arr_airport: directForm.arr_airport,
      dep_time: directForm.dep_time,
      arr_time: directForm.arr_time,
      valid_from: directForm.valid_from,
      valid_to: directForm.valid_to
    });
    startNewDirect();
  }

  async function handleConnectingSubmit(e: React.FormEvent) {
    e.preventDefault();

    for (let index = 0; index < connectingLegsPrepared.length; index += 1) {
      const leg = connectingLegsPrepared[index];
      if (!leg.airline_id) {
        setMessage(`Leg ${index + 1}: select an airline.`);
        return;
      }
      if (!leg.flight_number) {
        setMessage(`Leg ${index + 1}: flight number could not be generated.`);
        return;
      }
    }

    for (let index = 0; index < connectingLegsPrepared.length - 1; index += 1) {
      const current = connectingLegsPrepared[index];
      const next = connectingLegsPrepared[index + 1];
      if (current.arr_airport !== next.dep_airport) {
        setMessage(`Leg ${index + 1} must arrive where leg ${index + 2} departs.`);
        return;
      }
      if (layoverMinutes(current.arr_time, next.dep_time) < 60) {
        setMessage(`Layover between leg ${index + 1} and leg ${index + 2} must be at least 1 hour.`);
        return;
      }
    }

    const legDetails = buildConnectingLegDetails(connectingLegsPrepared);
    const routeLabel = buildConnectingRouteLabel(connectingLegsPrepared);

    const result = await postJson("/api/staff/master/schedules/connecting-route", {
      itinerary_id: Number(connectingForm.itinerary_id),
      departure_airport_code: connectingForm.departure_airport_code,
      arrival_airport_code: connectingForm.arrival_airport_code,
      valid_from: connectingForm.valid_from,
      valid_to: connectingForm.valid_to,
      operating_days: connectingForm.operating_days,
      legs: connectingLegsPrepared.map((leg) => ({
        schedule_id: Number(leg.schedule_id),
        airline_id: leg.airline_id,
        flight_number: leg.flight_number,
        dep_airport: leg.dep_airport,
        arr_airport: leg.arr_airport,
        dep_time: toSqlTime(leg.dep_time),
        arr_time: toSqlTime(leg.arr_time)
      }))
    });
    if (!result.ok) return;

    setMessage("");
    setSuccessDetail({
      kind: "connecting",
      itinerary_id: Number(connectingForm.itinerary_id),
      route_label: routeLabel,
      departure_airport_code: connectingForm.departure_airport_code,
      arrival_airport_code: connectingForm.arrival_airport_code,
      valid_from: connectingForm.valid_from,
      valid_to: connectingForm.valid_to,
      operating_days: [...connectingForm.operating_days],
      legs: legDetails
    });
    await loadConnectingItineraries();
    startNewConnecting();
  }

  async function handleDeleteItinerary(row: ConnectingItineraryRow) {
    const label = row.route_label ?? `${row.departure_airport_code} → ${row.arrival_airport_code}`;
    if (
      !confirm(
        `Delete connecting itinerary #${row.itinerary_id} (${label})?\n\nGenerated flights for this itinerary will also be removed. Schedule legs stay in the list.`
      )
    ) {
      return;
    }
    await deleteJson("/api/staff/master/itineraries/connecting/delete", { itinerary_id: row.itinerary_id });
    if (selectedItineraryKey === String(row.itinerary_id)) {
      startNewConnecting();
    }
  }

  async function generateConnectingFlights() {
    const itineraryId = Number(connectingForm.itinerary_id);
    if (!connectingForm.itinerary_id) {
      setMessage("Enter an itinerary ID.");
      return;
    }
    if (!connectingForm.start_date || !connectingForm.end_date) {
      setMessage("Choose a start and end date.");
      return;
    }
    if (connectingForm.start_date > connectingForm.end_date) {
      setMessage("Start date must be on or before end date.");
      return;
    }
    const savedRoute = connectingItineraries.find((row) => row.itinerary_id === itineraryId);
    if (!savedRoute) {
      setMessage("Save the connecting route first, then generate dated flights.");
      return;
    }
    if ((savedRoute.schedule_leg_count ?? 0) < 2) {
      setMessage("This itinerary has no saved legs. Save the connecting route again, then retry.");
      return;
    }

    const legDetails = buildConnectingLegDetails(connectingLegsPrepared);
    const routeLabel =
      savedRoute.route_label ?? buildConnectingRouteLabel(connectingLegsPrepared) ?? `${savedRoute.departure_airport_code} → ${savedRoute.arrival_airport_code}`;

    setIsGenerating(true);
    try {
      const result = await postJson("/api/staff/flights/generate-connecting", {
        itinerary_id: itineraryId,
        start_date: connectingForm.start_date,
        end_date: connectingForm.end_date,
        legs: connectingLegsPrepared.map((leg) => ({
          schedule_id: Number(leg.schedule_id),
          aircraft_id: Number(leg.aircraft_id)
        }))
      });
      if (!result.ok) return;

      const generatedFlights = Number(
        (result.data as { generated_flights?: number } | undefined)?.generated_flights ?? 0
      );
      if (generatedFlights <= 0) {
        setMessage("No flights were created. Check operating days and whether flights already exist for those dates.");
        return;
      }

      setMessage("");
      setSuccessDetail({
        kind: "generated",
        itinerary_id: itineraryId,
        route_label: routeLabel,
        start_date: connectingForm.start_date,
        end_date: connectingForm.end_date,
        generated_flights: generatedFlights,
        legs: legDetails
      });
      await loadConnectingItineraries();
    } finally {
      setIsGenerating(false);
    }
  }

  const autoRouteLabel = useMemo(() => buildConnectingRouteLabel(connectingLegsPrepared), [connectingLegsPrepared]);

  const layoverWarnings = connectingForm.legs.slice(0, -1).map((leg, index) => {
    const next = connectingForm.legs[index + 1];
    return layoverMinutes(leg.arr_time, next.dep_time);
  });

  return (
    <div className="space-y-6">
      <RegistrationSuccessModal detail={successDetail} onClose={() => setSuccessDetail(null)} />

      <PageTitle
        icon={CalendarClock}
        title="Flight Schedules"
        description="Register direct legs or multi-stop connecting routes using itineraries + schedule legs (no extra tables)."
        accent="violet"
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <StaffMessage message={message} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["direct", "Direct leg"],
                ["connecting", "Connecting route"]
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => (key === "direct" ? startNewDirect() : startNewConnecting())}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition",
                  mode === key ? "bg-navy text-white shadow-sm" : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "direct" ? (
            <form onSubmit={handleDirectSubmit} className={formCardClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-900">{selectedDirectKey ? "Edit direct schedule" : "Add direct schedule"}</h2>
                {selectedDirectKey ? (
                  <button type="button" onClick={startNewDirect} className="text-xs font-medium text-brand hover:underline">
                    New instead
                  </button>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <MasterFormField label="Schedule ID" required>
                  <input type="number" min={1} value={directForm.schedule_id} onChange={(e) => setDirectForm((p) => ({ ...p, schedule_id: e.target.value }))} className={masterInputClass} required />
                </MasterFormField>
                <MasterFormField label="Airline" required>
                  <select value={directForm.airline_id} onChange={(e) => setDirectForm((p) => ({ ...p, airline_id: e.target.value }))} className={masterInputClass} required>
                    <option value="">Select airline…</option>
                    {airlines.map((airline) => (
                      <option key={airline.airline_id} value={airline.airline_id}>
                        {airline.airline_id} · {airline.airline_name}
                      </option>
                    ))}
                  </select>
                </MasterFormField>
                <MasterFormField label="Aircraft" required>
                  <select value={directForm.aircraft_id} onChange={(e) => setDirectForm((p) => ({ ...p, aircraft_id: e.target.value }))} className={masterInputClass} required>
                    {aircraft.map((item) => (
                      <option key={item.aircraft_id} value={item.aircraft_id}>
                        {item.aircraft_id} · {item.model}
                      </option>
                    ))}
                  </select>
                </MasterFormField>
                <div className="sm:col-span-2">
                  <MasterFormField label="Flight number" hint="Auto: airline + aircraft + valid-from (MMDD) + schedule suffix">
                    <input readOnly value={directFlightNumber} className={`${masterInputClass} bg-zinc-50 font-semibold text-zinc-900`} />
                  </MasterFormField>
                </div>
                <MasterFormField label="Departure airport" required>
                  <select value={directForm.dep_airport} onChange={(e) => setDirectForm((p) => ({ ...p, dep_airport: e.target.value }))} className={masterInputClass} required>
                    {airports.map((airport) => (
                      <option key={airport.airport_code} value={airport.airport_code}>
                        {airport.airport_code} · {airport.city}
                      </option>
                    ))}
                  </select>
                </MasterFormField>
                <MasterFormField label="Arrival airport" required>
                  <select value={directForm.arr_airport} onChange={(e) => setDirectForm((p) => ({ ...p, arr_airport: e.target.value }))} className={masterInputClass} required>
                    {airports.map((airport) => (
                      <option key={airport.airport_code} value={airport.airport_code}>
                        {airport.airport_code} · {airport.city}
                      </option>
                    ))}
                  </select>
                </MasterFormField>
                <MasterFormField label="Departure time" required>
                  <input value={directForm.dep_time} onChange={(e) => setDirectForm((p) => ({ ...p, dep_time: e.target.value }))} onBlur={(e) => setDirectForm((p) => ({ ...p, dep_time: normalizeTime24(e.target.value) }))} className={masterInputClass} required />
                </MasterFormField>
                <MasterFormField label="Arrival time" required>
                  <input value={directForm.arr_time} onChange={(e) => setDirectForm((p) => ({ ...p, arr_time: e.target.value }))} onBlur={(e) => setDirectForm((p) => ({ ...p, arr_time: normalizeTime24(e.target.value) }))} className={masterInputClass} required />
                </MasterFormField>
                <MasterFormField label="Valid from" required>
                  <input type="date" lang="en-US" value={directForm.valid_from} onChange={(e) => setDirectForm((p) => ({ ...p, valid_from: e.target.value }))} className={masterInputClass} required />
                </MasterFormField>
                <MasterFormField label="Valid to" required>
                  <input type="date" lang="en-US" value={directForm.valid_to} onChange={(e) => setDirectForm((p) => ({ ...p, valid_to: e.target.value }))} className={masterInputClass} required />
                </MasterFormField>
              </div>

              <button type="submit" className="mt-5 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
                {selectedDirectKey ? "Update direct schedule" : "Save direct schedule"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleConnectingSubmit} className={formCardClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-900">Add connecting route</h2>
                <button type="button" onClick={startNewConnecting} className="text-xs font-medium text-brand hover:underline">
                  Reset
                </button>
              </div>

              <p className="mb-4 text-sm text-zinc-500">
                Saves each leg into <code className="text-xs">flight_schedules</code> and links them with a <code className="text-xs">Connecting</code> itinerary. Add as many legs as you need.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <MasterFormField label="Itinerary ID" required>
                  <input type="number" min={1} value={connectingForm.itinerary_id} onChange={(e) => setConnectingForm((p) => ({ ...p, itinerary_id: e.target.value }))} className={masterInputClass} required />
                </MasterFormField>
                <div className="sm:col-span-2">
                  <MasterFormField label="Label" hint="Auto-generated from origin, connection hubs, and destination">
                    <input
                      readOnly
                      value={autoRouteLabel}
                      className={`${masterInputClass} bg-zinc-50 font-semibold text-zinc-900`}
                      aria-label="Route label"
                    />
                  </MasterFormField>
                </div>
                <MasterFormField label="Origin" required>
                  <select value={connectingForm.departure_airport_code} onChange={(e) => setConnectingForm((p) => ({ ...p, departure_airport_code: e.target.value, legs: p.legs.map((leg, i) => (i === 0 ? { ...leg, dep_airport: e.target.value } : leg)) }))} className={masterInputClass}>
                    {airports.map((airport) => (
                      <option key={airport.airport_code} value={airport.airport_code}>
                        {airport.airport_code} · {airport.city}
                      </option>
                    ))}
                  </select>
                </MasterFormField>
                <MasterFormField label="Final destination" required>
                  <select value={connectingForm.arrival_airport_code} onChange={(e) => setConnectingForm((p) => ({ ...p, arrival_airport_code: e.target.value, legs: p.legs.map((leg, i, arr) => (i === arr.length - 1 ? { ...leg, arr_airport: e.target.value } : leg)) }))} className={masterInputClass}>
                    {airports.map((airport) => (
                      <option key={airport.airport_code} value={airport.airport_code}>
                        {airport.airport_code} · {airport.city}
                      </option>
                    ))}
                  </select>
                </MasterFormField>
                <MasterFormField label="Valid from" hint="Used in auto flight numbers (MMDD)" required>
                  <input type="date" lang="en-US" value={connectingForm.valid_from} onChange={(e) => setConnectingForm((p) => ({ ...p, valid_from: e.target.value }))} className={masterInputClass} required />
                </MasterFormField>
                <MasterFormField label="Valid to" required>
                  <input type="date" lang="en-US" value={connectingForm.valid_to} onChange={(e) => setConnectingForm((p) => ({ ...p, valid_to: e.target.value }))} className={masterInputClass} required />
                </MasterFormField>
              </div>

              <div className="mt-5 space-y-4">
                {connectingLegsPrepared.map((leg, index) => (
                  <div key={`${leg.schedule_id}-${index}`} className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-zinc-900">
                        Leg {index + 1} · {leg.dep_airport} → {leg.arr_airport} · {leg.flight_number}
                      </p>
                      {connectingForm.legs.length > 2 ? (
                        <button type="button" onClick={() => removeLeg(index)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline">
                          <Minus className="size-3.5" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <MasterFormField label="Schedule ID" required>
                        <input type="number" min={1} value={leg.schedule_id} onChange={(e) => updateLeg(index, { schedule_id: e.target.value })} className={masterInputClass} required />
                      </MasterFormField>
                      <MasterFormField label="Aircraft (for generation)" required>
                        <select value={leg.aircraft_id} onChange={(e) => updateLeg(index, { aircraft_id: e.target.value })} className={masterInputClass} required>
                          {aircraft.map((item) => (
                            <option key={item.aircraft_id} value={item.aircraft_id}>
                              {item.aircraft_id} · {item.model}
                            </option>
                          ))}
                        </select>
                      </MasterFormField>
                      <MasterFormField label="Airline" required>
                        <select value={leg.airline_id} onChange={(e) => updateLeg(index, { airline_id: e.target.value })} className={masterInputClass} required>
                          {airlines.map((airline) => (
                            <option key={airline.airline_id} value={airline.airline_id}>
                              {airline.airline_id} · {airline.airline_name}
                            </option>
                          ))}
                        </select>
                      </MasterFormField>
                      <MasterFormField label="Flight number" hint="Auto-generated">
                        <input readOnly value={leg.flight_number} className={`${masterInputClass} bg-white font-semibold text-zinc-900`} />
                      </MasterFormField>
                      <MasterFormField label="Departure airport" required>
                        <select value={leg.dep_airport} onChange={(e) => updateLeg(index, { dep_airport: e.target.value })} className={masterInputClass} required disabled={index === 0}>
                          {airports.map((airport) => (
                            <option key={airport.airport_code} value={airport.airport_code}>
                              {airport.airport_code}
                            </option>
                          ))}
                        </select>
                      </MasterFormField>
                      <MasterFormField label="Arrival airport" required>
                        <select value={leg.arr_airport} onChange={(e) => updateLeg(index, { arr_airport: e.target.value })} className={masterInputClass} required disabled={index === connectingForm.legs.length - 1}>
                          {airports.map((airport) => (
                            <option key={airport.airport_code} value={airport.airport_code}>
                              {airport.airport_code}
                            </option>
                          ))}
                        </select>
                      </MasterFormField>
                      <MasterFormField label="Departure time" required>
                        <input value={leg.dep_time} onChange={(e) => updateLeg(index, { dep_time: e.target.value })} onBlur={(e) => updateLeg(index, { dep_time: normalizeTime24(e.target.value) })} className={masterInputClass} required />
                      </MasterFormField>
                      <MasterFormField label="Arrival time" required>
                        <input value={leg.arr_time} onChange={(e) => updateLeg(index, { arr_time: e.target.value })} onBlur={(e) => updateLeg(index, { arr_time: normalizeTime24(e.target.value) })} className={masterInputClass} required />
                      </MasterFormField>
                    </div>
                    {index < layoverWarnings.length ? (
                      <p className={cn("mt-3 text-xs font-medium", layoverWarnings[index] >= 60 ? "text-emerald-700" : "text-amber-700")}>
                        Layover before next leg: {layoverWarnings[index]} min (minimum 60)
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>

              <button type="button" onClick={addLeg} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-dashed border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50">
                <Plus className="size-4" />
                Add leg
              </button>

              <div className="mt-4">
                <MasterFormField label="Operating days">
                  <div className="mt-2 flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleOperatingDay(day)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                          connectingForm.operating_days.includes(day) ? "bg-navy text-white" : "border border-zinc-200 bg-white text-zinc-600"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </MasterFormField>
              </div>

              <button type="submit" className="mt-5 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
                Save {autoRouteLabel || "connecting route"} ({connectingForm.legs.length} legs)
              </button>

              <div className="mt-5 rounded-xl border border-cerulean-100 bg-cerulean-50/40 p-4">
                <p className="text-sm font-semibold text-cerulean-900">Generate dated flights</p>
                <p className="mt-1 text-xs text-cerulean-800">
                  Save the route first. Creates all legs on matching operating days (default MON/WED/FRI) within the date range.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <MasterFormField label="Start date">
                    <input type="date" lang="en-US" value={connectingForm.start_date} onChange={(e) => setConnectingForm((p) => ({ ...p, start_date: e.target.value }))} className={masterInputClass} />
                  </MasterFormField>
                  <MasterFormField label="End date">
                    <input type="date" lang="en-US" value={connectingForm.end_date} onChange={(e) => setConnectingForm((p) => ({ ...p, end_date: e.target.value }))} className={masterInputClass} />
                  </MasterFormField>
                </div>
                <button
                  type="button"
                  disabled={isGenerating}
                  onClick={() => void generateConnectingFlights()}
                  className={cn(
                    "mt-3 rounded-xl border border-cerulean-200 bg-white px-4 py-2 text-sm font-semibold text-cerulean-900 hover:bg-cerulean-50",
                    isGenerating && "cursor-wait opacity-70"
                  )}
                >
                  {isGenerating ? "Generating…" : "Generate connecting flights"}
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="space-y-6">
          <section className={formCardClass}>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">Connecting itineraries</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Routes stored as <code className="text-xs">itineraries</code> + per-leg schedules.{" "}
              <span className="font-medium text-zinc-700">Legs</span> show saved schedule legs;{" "}
              <span className="font-medium text-zinc-700">Generated</span> counts dated flights after you run Generate.
            </p>
            <MasterRecordTable
              rows={connectingItineraries}
              rowKey={(row) => String(row.itinerary_id)}
              selectedKey={selectedItineraryKey}
              onSelect={(row) => {
                setSelectedItineraryKey(String(row.itinerary_id));
                setConnectingForm((prev) => ({
                  ...prev,
                  itinerary_id: String(row.itinerary_id),
                  departure_airport_code: row.departure_airport_code,
                  arrival_airport_code: row.arrival_airport_code
                }));
                setMode("connecting");
              }}
              onDelete={handleDeleteItinerary}
              columns={[
                { key: "itinerary_id", label: "ID" },
                {
                  key: "route_label",
                  label: "Label",
                  render: (r) => r.route_label ?? `${r.departure_airport_code} → ${r.arrival_airport_code}`
                },
                { key: "schedule_leg_count", label: "Legs", render: (r) => (r.schedule_leg_count ? String(r.schedule_leg_count) : "—") },
                {
                  key: "leg_summary",
                  label: "Leg detail",
                  render: (r) => r.leg_summary ?? "—"
                },
                {
                  key: "generated_leg_count",
                  label: "Generated",
                  render: (r) => String(r.generated_leg_count ?? 0)
                }
              ]}
              emptyMessage="No connecting itineraries yet."
            />
          </section>

          <section className={formCardClass}>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">Schedule legs</h2>
            <p className="mb-4 text-sm text-zinc-500">All registered recurring legs (direct or part of a connecting route).</p>
            {loading ? (
              <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
            ) : (
              <MasterRecordTable
                rows={schedules}
                rowKey={(row) => String(row.schedule_id)}
                selectedKey={selectedDirectKey}
                onSelect={editDirectRow}
                columns={[
                  { key: "schedule_id", label: "ID" },
                  { key: "flight_number", label: "Flight" },
                  { key: "route", label: "Route", render: (r) => `${r.dep_airport} → ${r.arr_airport}` },
                  { key: "dep_time", label: "Times", render: (r) => `${formatTimeValue(r.dep_time)} – ${formatTimeValue(r.arr_time)}` },
                  { key: "valid_from", label: "Valid", render: (r) => `${String(r.valid_from).slice(0, 10)} → ${String(r.valid_to).slice(0, 10)}` }
                ]}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
