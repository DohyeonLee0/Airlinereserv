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
import {
  GenerateDatedFlightsPanel,
  type FlightGeneratePricing
} from "@/app/components/dashboard/master/GenerateDatedFlightsPanel";
import {
  EMPTY_SCHEDULE_BROWSE_FILTERS,
  filterConnectingItineraryRow,
  filterScheduleLegRow,
  ScheduleBrowseFiltersBar,
  type ScheduleBrowseFilters
} from "@/app/components/dashboard/master/ScheduleBrowseFilters";
import { StaffAlertModal, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { generateFlightNumber } from "@/lib/flightNumber";
import { normalizeTime24 } from "@/lib/formatDate";
import { nextNumericId } from "@/lib/masterDataOptions";
import { cn } from "@/lib/cn";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";
const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const DEFAULT_OPERATING_DAYS = ["MON", "WED", "FRI"];

const DEFAULT_GENERATE_PRICING: FlightGeneratePricing = {
  start_date: "2026-06-01",
  end_date: "2026-06-30",
  economy_price: "780",
  business_price: "2400",
  first_price: "5200"
};

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
  leg_schedule_ids?: number[] | string | null;
  operating_days?: string[] | string | null;
};

function parseOperatingDays(value: unknown): string[] {
  if (Array.isArray(value)) {
    const days = value
      .map((day) => String(day).trim().toUpperCase())
      .filter((day) => WEEKDAYS.includes(day as (typeof WEEKDAYS)[number]));
    return days.length ? days : [...DEFAULT_OPERATING_DAYS];
  }
  if (typeof value === "string") {
    try {
      return parseOperatingDays(JSON.parse(value));
    } catch {
      return [...DEFAULT_OPERATING_DAYS];
    }
  }
  if (value && typeof value === "object") {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
      try {
        return parseOperatingDays(JSON.parse(value.toString("utf8")));
      } catch {
        return [...DEFAULT_OPERATING_DAYS];
      }
    }
    const objectValues = Object.values(value as Record<string, unknown>);
    if (objectValues.length) {
      return parseOperatingDays(objectValues);
    }
  }
  return [...DEFAULT_OPERATING_DAYS];
}

type ConnectingItineraryDetailLeg = {
  schedule_id: number;
  airline_id: string;
  flight_number: string;
  dep_airport: string;
  arr_airport: string;
  dep_time: string;
  arr_time: string;
  valid_from: string;
  valid_to: string;
  leg_index: number;
};

type ConnectingItineraryDetail = {
  itinerary: {
    itinerary_id: number;
    departure_airport_code: string;
    arrival_airport_code: string;
  };
  legs: ConnectingItineraryDetailLeg[];
  operating_days: string[];
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

const SCHEDULES_TABLE_PAGE_SIZE = 15;

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

  const { alert, showAlert, clearAlert, postJson, deleteJson } = useStaffAction(refreshMasterData);
  const [successDetail, setSuccessDetail] = useState<RegistrationSuccessDetail | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingItinerary, setIsLoadingItinerary] = useState(false);
  const [mode, setMode] = useState<ScheduleMode>("direct");
  const [connectingItineraries, setConnectingItineraries] = useState<ConnectingItineraryRow[]>([]);
  const [selectedDirectKey, setSelectedDirectKey] = useState<string | null>(null);
  const [selectedItineraryKey, setSelectedItineraryKey] = useState<string | null>(null);
  const [browseFilters, setBrowseFilters] = useState<ScheduleBrowseFilters>({ ...EMPTY_SCHEDULE_BROWSE_FILTERS });
  const [directForm, setDirectForm] = useState({
    schedule_id: "",
    airline_id: "",
    aircraft_id: "101",
    dep_airport: "",
    arr_airport: "",
    dep_time: "09:00",
    arr_time: "12:00",
    valid_from: "2026-06-01",
    valid_to: "2026-06-30",
    operating_days: [...DEFAULT_OPERATING_DAYS] as string[]
  });
  const [flightGenerate, setFlightGenerate] = useState<FlightGeneratePricing>({ ...DEFAULT_GENERATE_PRICING });
  const [connectingForm, setConnectingForm] = useState({
    itinerary_id: "",
    departure_airport_code: "ICN",
    arrival_airport_code: "JFK",
    valid_from: "2026-06-01",
    valid_to: "2026-06-30",
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
  }, [schedules.length]);

  useEffect(() => {
    clearAlert();
  }, [selectedDirectKey, selectedItineraryKey, mode, clearAlert]);

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
      valid_to: "2026-06-30",
      operating_days: [...DEFAULT_OPERATING_DAYS]
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
      operating_days: [...DEFAULT_OPERATING_DAYS],
      legs: [
        createLeg(baseScheduleId, origin, hub, airlineId, String(aircraft[0]?.aircraft_id ?? 101), "2026-06-01", 1),
        createLeg(baseScheduleId + 1, hub, destination, airlineId, String(aircraft[0]?.aircraft_id ?? 101), "2026-06-01", 2)
      ]
    });
  }

  function applyItineraryDetail(detail: ConnectingItineraryDetail) {
    const { itinerary, legs } = detail;
    const operatingDays = parseOperatingDays(detail.operating_days);
    const first = legs[0];
    const validFrom = first ? String(first.valid_from).slice(0, 10) : connectingForm.valid_from;
    const validTo = first ? String(first.valid_to).slice(0, 10) : connectingForm.valid_to;

    setConnectingForm({
      itinerary_id: String(itinerary.itinerary_id),
      departure_airport_code: itinerary.departure_airport_code,
      arrival_airport_code: itinerary.arrival_airport_code,
      valid_from: validFrom,
      valid_to: validTo,
      operating_days: operatingDays,
      legs: legs.length
        ? legs.map((leg) => ({
            schedule_id: String(leg.schedule_id),
            airline_id: leg.airline_id,
            flight_number: leg.flight_number,
            dep_airport: leg.dep_airport,
            arr_airport: leg.arr_airport,
            dep_time: formatTimeValue(leg.dep_time),
            arr_time: formatTimeValue(leg.arr_time),
            aircraft_id: String(aircraft[0]?.aircraft_id ?? 101)
          }))
        : connectingForm.legs
    });
  }

  async function loadItineraryFromDb(itineraryId: number) {
    const response = await fetch(`/api/staff/master/itineraries/connecting/${itineraryId}`);
    const json = await response.json();
    if (!response.ok) {
      showAlert(json.message ?? "Failed to load itinerary from the database.", { title: "Load failed" });
      return null;
    }
    const detail = json.data as ConnectingItineraryDetail;
    applyItineraryDetail(detail);
    const firstLeg = detail.legs[0];
    const validFrom = firstLeg ? String(firstLeg.valid_from).slice(0, 10) : flightGenerate.start_date;
    const validTo = firstLeg ? String(firstLeg.valid_to).slice(0, 10) : flightGenerate.end_date;
    setFlightGenerate((prev) => ({
      ...prev,
      start_date: validFrom,
      end_date: validTo
    }));
    return detail;
  }

  async function loadItineraryIntoForm(row: ConnectingItineraryRow) {
    setSelectedItineraryKey(String(row.itinerary_id));
    setSelectedDirectKey(null);
    setMode("connecting");
    setIsLoadingItinerary(true);
    try {
      await loadItineraryFromDb(row.itinerary_id);
    } finally {
      setIsLoadingItinerary(false);
    }
  }

  function editDirectRow(row: ScheduleRow) {
    setMode("direct");
    setSelectedDirectKey(String(row.schedule_id));
    setSelectedItineraryKey(null);
    const validFrom = String(row.valid_from).slice(0, 10);
    const validTo = String(row.valid_to).slice(0, 10);
    setDirectForm({
      schedule_id: String(row.schedule_id),
      airline_id: row.airline_id,
      aircraft_id: String(aircraft[0]?.aircraft_id ?? 101),
      dep_airport: row.dep_airport,
      arr_airport: row.arr_airport,
      dep_time: formatTimeValue(row.dep_time),
      arr_time: formatTimeValue(row.arr_time),
      valid_from: validFrom,
      valid_to: validTo,
      operating_days: parseOperatingDays(row.operating_days)
    });
    setFlightGenerate((prev) => ({
      ...prev,
      start_date: validFrom,
      end_date: validTo
    }));
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

  function toggleOperatingDay(day: (typeof WEEKDAYS)[number], target: ScheduleMode) {
    if (target === "direct") {
      setDirectForm((prev) => ({
        ...prev,
        operating_days: prev.operating_days.includes(day)
          ? prev.operating_days.filter((value) => value !== day)
          : [...prev.operating_days, day]
      }));
      return;
    }
    setConnectingForm((prev) => ({
      ...prev,
      operating_days: prev.operating_days.includes(day)
        ? prev.operating_days.filter((value) => value !== day)
        : [...prev.operating_days, day]
    }));
  }

  function patchFlightGenerate(patch: Partial<FlightGeneratePricing>) {
    setFlightGenerate((prev) => ({ ...prev, ...patch }));
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
    const result = await postJson(
      "/api/staff/master/schedules",
      {
        schedule_id: Number(directForm.schedule_id),
        airline_id: directForm.airline_id,
        flight_number: directFlightNumber,
        dep_airport: directForm.dep_airport,
        arr_airport: directForm.arr_airport,
        dep_time: toSqlTime(directForm.dep_time),
        arr_time: toSqlTime(directForm.arr_time),
        valid_from: directForm.valid_from,
        valid_to: directForm.valid_to,
        operating_days: directForm.operating_days
      },
      "POST",
      { silentSuccess: true }
    );
    if (!result.ok) return;
    setSelectedDirectKey(String(directForm.schedule_id));
    setMode("direct");
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
      valid_to: directForm.valid_to,
      operating_days: [...directForm.operating_days]
    });
    setFlightGenerate((prev) => ({
      ...prev,
      start_date: directForm.valid_from,
      end_date: directForm.valid_to
    }));
    await refreshMasterData();
  }

  async function handleConnectingSubmit(e: React.FormEvent) {
    e.preventDefault();

    for (let index = 0; index < connectingLegsPrepared.length; index += 1) {
      const leg = connectingLegsPrepared[index];
      if (!leg.airline_id) {
        showAlert(`Leg ${index + 1}: select an airline.`, { title: "Missing airline", variant: "warning" });
        return;
      }
      if (!leg.flight_number) {
        showAlert(`Leg ${index + 1}: flight number could not be generated.`, {
          title: "Missing flight number",
          variant: "warning"
        });
        return;
      }
    }

    for (let index = 0; index < connectingLegsPrepared.length - 1; index += 1) {
      const current = connectingLegsPrepared[index];
      const next = connectingLegsPrepared[index + 1];
      if (current.arr_airport !== next.dep_airport) {
        showAlert(`Leg ${index + 1} must arrive where leg ${index + 2} departs.`, {
          title: "Invalid connection",
          variant: "warning"
        });
        return;
      }
      if (layoverMinutes(current.arr_time, next.dep_time) < 60) {
        showAlert(`Layover between leg ${index + 1} and leg ${index + 2} must be at least 1 hour.`, {
          title: "Layover too short",
          variant: "warning"
        });
        return;
      }
    }

    const legDetails = buildConnectingLegDetails(connectingLegsPrepared);
    const routeLabel = buildConnectingRouteLabel(connectingLegsPrepared);

    const result = await postJson(
      "/api/staff/master/schedules/connecting-route",
      {
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
      },
      "POST",
      { silentSuccess: true }
    );
    if (!result.ok) return;
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
    await reload();
    setSelectedItineraryKey(String(connectingForm.itinerary_id));
    setMode("connecting");
    await loadItineraryFromDb(Number(connectingForm.itinerary_id));
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

  async function generateDirectFlights() {
    const scheduleId = Number(directForm.schedule_id);
    if (!directForm.schedule_id) {
      showAlert("Enter a schedule ID.", { title: "Missing schedule", variant: "warning" });
      return;
    }
    if (!flightGenerate.start_date || !flightGenerate.end_date) {
      showAlert("Choose a start and end date.", { title: "Missing dates", variant: "warning" });
      return;
    }
    if (flightGenerate.start_date > flightGenerate.end_date) {
      showAlert("Start date must be on or before end date.", { title: "Invalid date range", variant: "warning" });
      return;
    }
    const savedSchedule = schedules.find((row) => row.schedule_id === scheduleId);
    if (!savedSchedule) {
      showAlert("Save the direct schedule first, then generate dated flights.", {
        title: "Schedule not saved",
        variant: "warning"
      });
      return;
    }

    const routeLabel = `${directForm.dep_airport} → ${directForm.arr_airport}`;

    setIsGenerating(true);
    clearAlert();
    try {
      const result = await postJson(
        "/api/staff/flights/generate-direct",
        {
          schedule_id: scheduleId,
          aircraft_id: Number(directForm.aircraft_id),
          start_date: flightGenerate.start_date,
          end_date: flightGenerate.end_date,
          economy_price: Number(flightGenerate.economy_price),
          business_price: Number(flightGenerate.business_price),
          first_price: Number(flightGenerate.first_price)
        },
        "POST",
        { silentSuccess: true }
      );
      if (!result.ok) return;

      const generatedFlights = Number(
        (result.data as { generated_flights?: number } | undefined)?.generated_flights ?? 0
      );
      if (generatedFlights <= 0) {
        showAlert("No flights were created. Check operating days and whether flights already exist for those dates.", {
          title: "No flights created"
        });
        return;
      }

      setSuccessDetail({
        kind: "generated",
        route_type: "direct",
        schedule_id: scheduleId,
        route_label: routeLabel,
        flight_number: directFlightNumber || savedSchedule.flight_number,
        start_date: flightGenerate.start_date,
        end_date: flightGenerate.end_date,
        generated_flights: generatedFlights
      });
      await refreshMasterData();
    } catch {
      showAlert("Flight generation timed out or failed. Please try again.", { title: "Generation failed" });
    } finally {
      setIsGenerating(false);
    }
  }

  async function generateConnectingFlights() {
    const itineraryId = Number(connectingForm.itinerary_id);
    if (!connectingForm.itinerary_id) {
      showAlert("Enter an itinerary ID.", { title: "Missing itinerary", variant: "warning" });
      return;
    }
    if (!flightGenerate.start_date || !flightGenerate.end_date) {
      showAlert("Choose a start and end date.", { title: "Missing dates", variant: "warning" });
      return;
    }
    if (flightGenerate.start_date > flightGenerate.end_date) {
      showAlert("Start date must be on or before end date.", { title: "Invalid date range", variant: "warning" });
      return;
    }
    const savedRoute = connectingItineraries.find((row) => row.itinerary_id === itineraryId);
    if (!savedRoute) {
      showAlert("Save the connecting itinerary first, then generate dated flights.", {
        title: "Route not saved",
        variant: "warning"
      });
      return;
    }
    if ((savedRoute.schedule_leg_count ?? 0) < 2) {
      showAlert("This itinerary has no saved legs. Save the connecting itinerary again, then retry.", {
        title: "Missing legs",
        variant: "warning"
      });
      return;
    }

    const legDetails = buildConnectingLegDetails(connectingLegsPrepared);
    const routeLabel =
      savedRoute.route_label ?? buildConnectingRouteLabel(connectingLegsPrepared) ?? `${savedRoute.departure_airport_code} → ${savedRoute.arrival_airport_code}`;

    setIsGenerating(true);
    clearAlert();
    try {
      const result = await postJson(
        "/api/staff/flights/generate-connecting",
        {
          itinerary_id: itineraryId,
          start_date: flightGenerate.start_date,
          end_date: flightGenerate.end_date,
          economy_price: Number(flightGenerate.economy_price),
          business_price: Number(flightGenerate.business_price),
          first_price: Number(flightGenerate.first_price),
          legs: connectingLegsPrepared.map((leg) => ({
            schedule_id: Number(leg.schedule_id),
            aircraft_id: Number(leg.aircraft_id)
          }))
        },
        "POST",
        { silentSuccess: true }
      );
      if (!result.ok) return;

      const generatedFlights = Number(
        (result.data as { generated_flights?: number } | undefined)?.generated_flights ?? 0
      );
      if (generatedFlights <= 0) {
        showAlert("No flights were created. Check operating days and whether flights already exist for those dates.", {
          title: "No flights created"
        });
        return;
      }

      setSuccessDetail({
        kind: "generated",
        route_type: "connecting",
        itinerary_id: itineraryId,
        route_label: routeLabel,
        start_date: flightGenerate.start_date,
        end_date: flightGenerate.end_date,
        generated_flights: generatedFlights,
        legs: legDetails
      });
      await loadConnectingItineraries();
    } catch {
      showAlert("Flight generation timed out or failed. Please try again.", { title: "Generation failed" });
    } finally {
      setIsGenerating(false);
    }
  }

  const directScheduleSaved = useMemo(
    () => schedules.some((row) => row.schedule_id === Number(directForm.schedule_id)),
    [schedules, directForm.schedule_id]
  );

  const browseFilterKey = `${browseFilters.query}|${browseFilters.depAirport}|${browseFilters.arrAirport}|${browseFilters.airlineId}`;

  const filteredConnectingItineraries = useMemo(
    () =>
      connectingItineraries.filter((row) =>
        filterConnectingItineraryRow(row, browseFilters, parseOperatingDays(row.operating_days).join(", "))
      ),
    [connectingItineraries, browseFilters]
  );

  const filteredSchedules = useMemo(
    () =>
      schedules.filter((row) =>
        filterScheduleLegRow(row, browseFilters, parseOperatingDays(row.operating_days).join(", "))
      ),
    [schedules, browseFilters]
  );

  const autoRouteLabel = useMemo(() => buildConnectingRouteLabel(connectingLegsPrepared), [connectingLegsPrepared]);

  const layoverWarnings = connectingForm.legs.slice(0, -1).map((leg, index) => {
    const next = connectingForm.legs[index + 1];
    return layoverMinutes(leg.arr_time, next.dep_time);
  });

  return (
    <div className="space-y-6">
      <RegistrationSuccessModal detail={successDetail} onClose={() => setSuccessDetail(null)} />
      <StaffAlertModal alert={alert} onClose={clearAlert} />

      <PageTitle
        icon={CalendarClock}
        title="Flight Schedules"
        description="Step 1 — save a direct schedule or connecting itinerary. Step 2 — generate dated flights with seats and prices."
        accent="violet"
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,480px)_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["direct", "Direct flight"],
                ["connecting", "Connecting itinerary"]
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
                <div className="sm:col-span-2">
                  <MasterFormField label="Operating days" hint="Flights are generated only on these weekdays">
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleOperatingDay(day, "direct")}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                            directForm.operating_days.includes(day) ? "bg-navy text-white" : "border border-zinc-200 bg-white text-zinc-600"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </MasterFormField>
                </div>
              </div>

              <button type="submit" className="mt-5 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
                {selectedDirectKey ? "Update direct schedule" : "Save direct schedule"}
              </button>

              <GenerateDatedFlightsPanel
                pricing={flightGenerate}
                onChange={patchFlightGenerate}
                onGenerate={() => void generateDirectFlights()}
                isGenerating={isGenerating}
                disabled={!directScheduleSaved}
                buttonLabel="Generate direct flights"
                hint={
                  directScheduleSaved
                    ? "Creates one bookable flight per operating day in the range, using the aircraft above."
                    : "Save the schedule first — then you can generate dated flights here."
                }
              />
            </form>
          ) : (
            <form onSubmit={handleConnectingSubmit} className={formCardClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-zinc-900">
                  {selectedItineraryKey ? "Edit connecting itinerary" : "Add connecting itinerary"}
                </h2>
                <button type="button" onClick={startNewConnecting} className="text-xs font-medium text-brand hover:underline">
                  Reset
                </button>
              </div>

              <p className="mb-4 text-sm text-zinc-500">
                Link two or more legs into one bookable route. Each leg is saved as its own schedule row.
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
                <MasterFormField
                  label="Operating days"
                  hint={
                    isLoadingItinerary
                      ? "Loading saved days from database…"
                      : selectedItineraryKey
                        ? "Loaded from schedule_days for this itinerary."
                        : "Select a saved itinerary to load days from the database."
                  }
                >
                  <div className={cn("mt-2 flex flex-wrap gap-2", isLoadingItinerary && "pointer-events-none opacity-60")}>
                    {WEEKDAYS.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleOperatingDay(day, "connecting")}
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
                Save {autoRouteLabel || "connecting itinerary"} ({connectingForm.legs.length} legs)
              </button>

              <GenerateDatedFlightsPanel
                pricing={flightGenerate}
                onChange={patchFlightGenerate}
                onGenerate={() => void generateConnectingFlights()}
                isGenerating={isGenerating}
                disabled={isLoadingItinerary}
                buttonLabel="Generate connecting flights"
                hint="Save the itinerary first. Creates all legs on matching operating days within the date range."
              />
            </form>
          )}
        </div>

        <div className="space-y-6">
          <ScheduleBrowseFiltersBar
            airports={airports}
            airlines={airlines}
            filters={browseFilters}
            onChange={(patch) => setBrowseFilters((prev) => ({ ...prev, ...patch }))}
            onClear={() => setBrowseFilters({ ...EMPTY_SCHEDULE_BROWSE_FILTERS })}
            itineraryCount={filteredConnectingItineraries.length}
            itineraryTotal={connectingItineraries.length}
            legCount={filteredSchedules.length}
            legTotal={schedules.length}
          />

          <section className={formCardClass}>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">Connecting itineraries</h2>
            <p className="mb-4 text-sm text-zinc-500">
              Routes stored as <code className="text-xs">itineraries</code> + per-leg schedules.{" "}
              <span className="font-medium text-zinc-700">Legs</span> show saved schedule legs;{" "}
              <span className="font-medium text-zinc-700">Generated</span> counts dated flights after you run Generate.
            </p>
            <MasterRecordTable
              key={`connecting-${browseFilterKey}`}
              rows={filteredConnectingItineraries}
              pageSize={SCHEDULES_TABLE_PAGE_SIZE}
              rowKey={(row) => String(row.itinerary_id)}
              selectedKey={selectedItineraryKey}
              onSelect={loadItineraryIntoForm}
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
              emptyMessage={
                connectingItineraries.length
                  ? "No connecting itineraries match your filters."
                  : "No connecting itineraries yet."
              }
            />
          </section>

          <section className={formCardClass}>
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">Schedule legs</h2>
            <p className="mb-4 text-sm text-zinc-500">All registered recurring legs (direct or part of a connecting itinerary).</p>
            {loading ? (
              <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
            ) : (
              <MasterRecordTable
                key={`legs-${browseFilterKey}`}
                rows={filteredSchedules}
                pageSize={SCHEDULES_TABLE_PAGE_SIZE}
                rowKey={(row) => String(row.schedule_id)}
                selectedKey={selectedDirectKey}
                onSelect={editDirectRow}
                columns={[
                  { key: "schedule_id", label: "ID" },
                  { key: "flight_number", label: "Flight" },
                  { key: "route", label: "Route", render: (r) => `${r.dep_airport} → ${r.arr_airport}` },
                  {
                    key: "operating_days",
                    label: "Days",
                    render: (r) => parseOperatingDays(r.operating_days).join(", ")
                  },
                  { key: "dep_time", label: "Times", render: (r) => `${formatTimeValue(r.dep_time)} – ${formatTimeValue(r.arr_time)}` },
                  { key: "valid_from", label: "Valid", render: (r) => `${String(r.valid_from).slice(0, 10)} → ${String(r.valid_to).slice(0, 10)}` },
                  {
                    key: "generated_flight_count",
                    label: "Generated",
                    render: (r) => String(r.generated_flight_count ?? 0)
                  }
                ]}
                emptyMessage={
                  schedules.length ? "No schedule legs match your filters." : "No schedule legs yet."
                }
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
