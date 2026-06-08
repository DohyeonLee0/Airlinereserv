const EN_US = "en-US";

export function formatDateTime(value: unknown): string {
  if (value == null || value === "") return "—";
  const date = parseDateValue(value);
  if (!date) return String(value);
  return date.toLocaleString(EN_US, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
}

export function formatDate(value: unknown): string {
  if (value == null || value === "") return "—";
  const date = parseDateValue(value);
  if (!date) return String(value);
  return date.toLocaleDateString(EN_US, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function parseDateValue(value: unknown): Date | null {
  const raw = String(value).trim();
  if (!raw) return null;

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(raw);
  const date = new Date(dateOnly ? `${raw}T00:00:00` : raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** Normalize HH:MM or H:MM to zero-padded 24-hour time. */
export function normalizeTime24(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value.trim();
  const hours = Number(match[1]);
  const minutes = match[2];
  if (hours < 0 || hours > 23 || Number(minutes) > 59) return value.trim();
  return `${String(hours).padStart(2, "0")}:${minutes}`;
}
