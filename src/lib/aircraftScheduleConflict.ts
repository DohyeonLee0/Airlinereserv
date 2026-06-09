import { PoolConnection, RowDataPacket } from "mysql2/promise";

export type AircraftFlightSlot = {
  flightDate: string;
  aircraftId: number;
  scheduleId: number;
  depTime: string;
  arrTime: string;
  flightNumber?: string;
};

type TimeSegment = { startMin: number; endMin: number };

const DAY_MS = 86_400_000;

export function addDaysIso(date: string, days: number) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

export function timeToMinutes(value: unknown): number {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTimeRange(depTime: unknown, arrTime: unknown) {
  const format = (value: unknown) => {
    const raw = String(value ?? "").trim();
    return raw.length >= 5 ? raw.slice(0, 5) : raw;
  };
  return `${format(depTime)}–${format(arrTime)}`;
}

function dayOffset(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T12:00:00Z`).getTime();
  const to = new Date(`${toDate}T12:00:00Z`).getTime();
  return Math.round((to - from) / DAY_MS);
}

function segmentsOnCalendarDay(
  flightDate: string,
  targetDate: string,
  depMin: number,
  arrMin: number
): TimeSegment[] {
  const offset = dayOffset(flightDate, targetDate);
  if (offset === 0) {
    if (depMin <= arrMin) return [{ startMin: depMin, endMin: arrMin }];
    return [{ startMin: depMin, endMin: 1440 }];
  }
  if (offset === 1 && depMin > arrMin) {
    return [{ startMin: 0, endMin: arrMin }];
  }
  return [];
}

function segmentsOverlap(a: TimeSegment, b: TimeSegment) {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}

function slotsOverlapOnDate(left: AircraftFlightSlot, right: AircraftFlightSlot, targetDate: string) {
  if (left.aircraftId !== right.aircraftId) return false;

  const leftSegments = segmentsOnCalendarDay(
    left.flightDate,
    targetDate,
    timeToMinutes(left.depTime),
    timeToMinutes(left.arrTime)
  );
  const rightSegments = segmentsOnCalendarDay(
    right.flightDate,
    targetDate,
    timeToMinutes(right.depTime),
    timeToMinutes(right.arrTime)
  );

  return leftSegments.some((leftSegment) =>
    rightSegments.some((rightSegment) => segmentsOverlap(leftSegment, rightSegment))
  );
}

export function findAircraftScheduleConflict(
  candidate: AircraftFlightSlot,
  others: AircraftFlightSlot[],
  options?: { ignoreSameSchedule?: boolean }
) {
  const ignoreSameSchedule = options?.ignoreSameSchedule ?? true;

  for (const other of others) {
    if (ignoreSameSchedule && other.scheduleId === candidate.scheduleId && other.flightDate === candidate.flightDate) {
      continue;
    }

    const datesToCheck = new Set([candidate.flightDate, addDaysIso(candidate.flightDate, -1)]);
    for (const targetDate of datesToCheck) {
      if (slotsOverlapOnDate(candidate, other, targetDate)) {
        return other;
      }
    }
  }

  return null;
}

export function buildAircraftConflictMessage(candidate: AircraftFlightSlot, conflict: AircraftFlightSlot) {
  const candidateLabel = candidate.flightNumber
    ? `${candidate.flightNumber} on ${candidate.flightDate}`
    : `schedule #${candidate.scheduleId} on ${candidate.flightDate}`;
  const conflictLabel = conflict.flightNumber
    ? `${conflict.flightNumber} on ${conflict.flightDate}`
    : `schedule #${conflict.scheduleId} on ${conflict.flightDate}`;

  return (
    `Aircraft #${candidate.aircraftId} is already assigned to ${conflictLabel} ` +
    `(${formatTimeRange(conflict.depTime, conflict.arrTime)}), which overlaps with the requested ` +
    `${candidateLabel} slot (${formatTimeRange(candidate.depTime, candidate.arrTime)}).`
  );
}

type DbFlightSlotRow = RowDataPacket & {
  flight_date: string;
  aircraft_id: number;
  schedule_id: number;
  dep_time: string;
  arr_time: string;
  flight_number: string;
};

export async function loadAircraftFlightSlots(
  connection: PoolConnection,
  aircraftIds: number[],
  startDate: string,
  endDate: string
): Promise<AircraftFlightSlot[]> {
  if (!aircraftIds.length) return [];

  const lookupStart = addDaysIso(startDate, -1);
  const placeholders = aircraftIds.map(() => "?").join(", ");

  const [rows] = await connection.query<DbFlightSlotRow[]>(
    `SELECT
       f.flight_date,
       f.aircraft_id,
       f.schedule_id,
       fs.dep_time,
       fs.arr_time,
       fs.flight_number
     FROM flights f
     JOIN flight_schedules fs ON fs.schedule_id = f.schedule_id
     WHERE f.aircraft_id IN (${placeholders})
       AND f.status <> 'Cancelled'
       AND f.flight_date BETWEEN ? AND ?`,
    [...aircraftIds, lookupStart, endDate]
  );

  return rows.map((row) => ({
    flightDate: String(row.flight_date).slice(0, 10),
    aircraftId: Number(row.aircraft_id),
    scheduleId: Number(row.schedule_id),
    depTime: String(row.dep_time),
    arrTime: String(row.arr_time),
    flightNumber: String(row.flight_number)
  }));
}

type ScheduleTimingRow = RowDataPacket & {
  schedule_id: number;
  dep_time: string;
  arr_time: string;
  flight_number: string;
};

export async function loadScheduleTimings(connection: PoolConnection, scheduleIds: number[]) {
  if (!scheduleIds.length) return new Map<number, ScheduleTimingRow>();

  const placeholders = scheduleIds.map(() => "?").join(", ");
  const [rows] = await connection.query<ScheduleTimingRow[]>(
    `SELECT schedule_id, dep_time, arr_time, flight_number
     FROM flight_schedules
     WHERE schedule_id IN (${placeholders})`,
    scheduleIds
  );

  return new Map(rows.map((row) => [Number(row.schedule_id), row]));
}

export function assertNoAircraftConflicts(
  candidates: AircraftFlightSlot[],
  existing: AircraftFlightSlot[]
): { conflict: AircraftFlightSlot; other: AircraftFlightSlot } | null {
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    const priorCandidates = candidates.slice(0, index);

    const conflictWithExisting = findAircraftScheduleConflict(candidate, existing);
    if (conflictWithExisting) {
      return { conflict: candidate, other: conflictWithExisting };
    }

    const conflictWithBatch = findAircraftScheduleConflict(candidate, priorCandidates, {
      ignoreSameSchedule: false
    });
    if (conflictWithBatch) {
      return { conflict: candidate, other: conflictWithBatch };
    }
  }

  return null;
}
