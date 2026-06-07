export const COUNTRY_OPTIONS = [
  "Australia",
  "Canada",
  "China",
  "France",
  "Germany",
  "Hong Kong",
  "Japan",
  "Singapore",
  "South Korea",
  "Thailand",
  "United Kingdom",
  "United States"
] as const;

export const AIRCRAFT_MODELS = [
  "Airbus A330-900neo",
  "Airbus A350-900",
  "Boeing 737-800",
  "Boeing 777-200ER",
  "Boeing 777-300ER",
  "Boeing 787-8",
  "Boeing 787-9"
] as const;

export function nextNumericId(rows: Array<Record<string, unknown>>, key: string, step = 1): number {
  const max = rows.reduce((acc, row) => {
    const value = Number(row[key]);
    return Number.isFinite(value) ? Math.max(acc, value) : acc;
  }, 0);
  return max + step;
}
