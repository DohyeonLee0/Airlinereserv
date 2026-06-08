"use client";

import { useCallback, useEffect, useState } from "react";

export type AirlineRow = { airline_id: string; airline_name: string; country: string | null };
export type AirportRow = { airport_code: string; airport_name: string; city: string; country: string };
export type AircraftRow = { aircraft_id: number; airline_id: string; airline_name?: string; model: string; capacity: number };
export type ScheduleRow = {
  schedule_id: number;
  airline_id: string;
  airline_name?: string;
  flight_number: string;
  dep_airport: string;
  arr_airport: string;
  dep_time: string;
  arr_time: string;
  valid_from: string;
  valid_to: string;
};

async function fetchRows<T>(endpoint: string): Promise<T[]> {
  const response = await fetch(endpoint);
  const json = await response.json();
  if (!response.ok) throw new Error(json.message ?? "Failed to load data");
  return (json.data?.rows ?? []) as T[];
}

type IncludeFlags = {
  airlines?: boolean;
  airports?: boolean;
  aircraft?: boolean;
  schedules?: boolean;
};

export function useMasterLists(include: IncludeFlags) {
  const includeKey = `${include.airlines}-${include.airports}-${include.aircraft}-${include.schedules}`;
  const [airlines, setAirlines] = useState<AirlineRow[]>([]);
  const [airports, setAirports] = useState<AirportRow[]>([]);
  const [aircraft, setAircraft] = useState<AircraftRow[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const tasks: Promise<void>[] = [];
      if (include.airlines) {
        tasks.push(fetchRows<AirlineRow>("/api/staff/master/airlines").then(setAirlines));
      }
      if (include.airports) {
        tasks.push(fetchRows<AirportRow>("/api/staff/master/airports").then(setAirports));
      }
      if (include.aircraft) {
        tasks.push(fetchRows<AircraftRow>("/api/staff/master/aircraft").then(setAircraft));
      }
      if (include.schedules) {
        tasks.push(fetchRows<ScheduleRow>("/api/staff/master/schedules").then(setSchedules));
      }
      await Promise.all(tasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load master data");
    } finally {
      setLoading(false);
    }
  }, [includeKey]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const countryOptions = Array.from(
    new Set([
      ...airports.map((a) => a.country),
      ...airlines.map((a) => a.country).filter(Boolean) as string[]
    ])
  ).sort();

  return { airlines, airports, aircraft, schedules, countryOptions, loading, error, reload };
}
