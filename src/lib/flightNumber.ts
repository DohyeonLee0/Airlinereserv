type GenerateFlightNumberInput = {
  airlineId: string;
  aircraftId: number | string;
  date: string;
  scheduleId?: number | string;
  legIndex?: number;
};

/** Build a unique flight number within VARCHAR(10): AA + aircraft(3) + MMDD(4) + suffix(1). */
export function generateFlightNumber({
  airlineId,
  aircraftId,
  date,
  scheduleId,
  legIndex
}: GenerateFlightNumberInput): string {
  const airline = airlineId.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 2).padEnd(2, "X");
  const aircraft = String(aircraftId).replace(/\D/g, "").padStart(3, "0").slice(-3);
  const mmdd = date.replace(/\D/g, "").slice(4, 8);
  const suffix =
    legIndex != null
      ? String(legIndex).slice(-1)
      : String(Math.abs(Number(scheduleId) || 0) % 10);

  return `${airline}${aircraft}${mmdd}${suffix}`.slice(0, 10);
}
