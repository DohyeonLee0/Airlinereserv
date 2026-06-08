type GenerateFlightNumberInput = {
  airlineId: string;
  aircraftId: number | string;
  date: string;
  scheduleId?: number | string;
  legIndex?: number;
};

/** Build a unique flight number within VARCHAR(10): AA + MMDD(4) + schedule(3) + leg(1). */
export function generateFlightNumber({
  airlineId,
  aircraftId: _aircraftId,
  date,
  scheduleId,
  legIndex
}: GenerateFlightNumberInput): string {
  const airline = airlineId.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2).padEnd(2, "X");
  const mmdd = date.replace(/\D/g, "").slice(4, 8);
  const sched = String(Math.abs(Number(scheduleId) || 0))
    .padStart(3, "0")
    .slice(-3);
  const leg = legIndex != null ? String(legIndex).slice(-1) : "0";

  return `${airline}${mmdd}${sched}${leg}`.slice(0, 10);
}
