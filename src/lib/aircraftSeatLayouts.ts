export type AircraftSeatInput = {
  seat_number: string;
  class_id: number;
};

export const SEAT_CLASS_OPTIONS = [
  { class_id: 1, class_name: "Economy" },
  { class_id: 2, class_name: "Business" },
  { class_id: 3, class_name: "First" }
] as const;

function rowRange(start: number, end: number) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildSeats(rows: number[], letters: string[], classId: number): AircraftSeatInput[] {
  const seats: AircraftSeatInput[] = [];
  for (const row of rows) {
    for (const letter of letters) {
      seats.push({ seat_number: `${row}${letter}`, class_id: classId });
    }
  }
  return seats;
}

function mergeSeatSections(sections: AircraftSeatInput[]) {
  const seen = new Set<string>();
  const merged: AircraftSeatInput[] = [];
  for (const seat of sections) {
    const key = seat.seat_number.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ seat_number: key, class_id: seat.class_id });
  }
  return merged.sort((a, b) => {
    const parse = (value: string) => {
      const match = value.match(/^(\d+)([A-Z]+)$/);
      return { row: match ? Number(match[1]) : 0, letter: match?.[2] ?? value };
    };
    const left = parse(a.seat_number);
    const right = parse(b.seat_number);
    if (left.row !== right.row) return left.row - right.row;
    return left.letter.localeCompare(right.letter);
  });
}

function layoutBoeing777() {
  return mergeSeatSections([
    ...buildSeats(rowRange(1, 2), ["A", "D", "G", "K"], 3),
    ...buildSeats(rowRange(7, 15), ["A", "C", "D", "G", "H", "K"], 2),
    ...buildSeats(rowRange(28, 53), ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K"], 1)
  ]);
}

function layoutBoeing787() {
  return mergeSeatSections([
    ...buildSeats(rowRange(1, 4), ["A", "C", "D", "G", "H", "K"], 2),
    ...buildSeats(rowRange(28, 55), ["A", "B", "C", "D", "E", "F", "H", "J", "K"], 1)
  ]);
}

function layoutAirbusA350() {
  return mergeSeatSections([
    ...buildSeats(rowRange(1, 7), ["A", "D", "G", "K"], 2),
    ...buildSeats(rowRange(10, 41), ["A", "B", "C", "D", "E", "F", "H", "J", "K"], 1)
  ]);
}

function layoutAirbusA330neo() {
  return mergeSeatSections([
    ...buildSeats(rowRange(1, 7), ["A", "D", "G", "K"], 2),
    ...buildSeats(rowRange(20, 51), ["A", "B", "C", "D", "F", "G", "H", "J"], 1)
  ]);
}

function layoutBoeing737() {
  return mergeSeatSections([
    ...buildSeats(rowRange(1, 4), ["A", "C", "D", "F"], 2),
    ...buildSeats(rowRange(8, 35), ["A", "B", "C", "D", "E", "F"], 1)
  ]);
}

/** Default seat map templates aligned with sample_data.sql layouts. */
export function defaultSeatsForModel(model: string): AircraftSeatInput[] {
  if (model.includes("777")) return layoutBoeing777();
  if (model.includes("787")) return layoutBoeing787();
  if (model === "Airbus A350-900") return layoutAirbusA350();
  if (model === "Airbus A330-900neo") return layoutAirbusA330neo();
  if (model.includes("737")) return layoutBoeing737();
  return layoutBoeing787();
}

export function summarizeSeatLayout(seats: AircraftSeatInput[]) {
  const counts = { economy: 0, business: 0, first: 0 };
  for (const seat of seats) {
    if (seat.class_id === 3) counts.first += 1;
    else if (seat.class_id === 2) counts.business += 1;
    else counts.economy += 1;
  }
  return { ...counts, total: seats.length };
}

export function normalizeAircraftSeats(value: unknown): AircraftSeatInput[] {
  if (!Array.isArray(value)) return [];
  const seats: AircraftSeatInput[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as { seat_number?: unknown; class_id?: unknown };
    const seatNumber = String(record.seat_number ?? "")
      .trim()
      .toUpperCase();
    const classId = Number(record.class_id);
    if (!seatNumber || !/^\d+[A-Z]+$/.test(seatNumber)) continue;
    if (![1, 2, 3].includes(classId)) continue;
    if (seen.has(seatNumber)) continue;
    seen.add(seatNumber);
    seats.push({ seat_number: seatNumber, class_id: classId });
  }

  return seats.sort((a, b) => {
    const parse = (seat: string) => {
      const match = seat.match(/^(\d+)([A-Z]+)$/);
      return { row: match ? Number(match[1]) : 0, letter: match?.[2] ?? seat };
    };
    const left = parse(a.seat_number);
    const right = parse(b.seat_number);
    if (left.row !== right.row) return left.row - right.row;
    return left.letter.localeCompare(right.letter);
  });
}

export function classNameForId(classId: number) {
  return SEAT_CLASS_OPTIONS.find((option) => option.class_id === classId)?.class_name ?? "Economy";
}

export type SeatTemplateListItem = {
  template_id: number;
  template_name: string;
  model_label: string | null;
  seat_count?: number;
};

export function findTemplateForModel(templates: SeatTemplateListItem[], model: string) {
  const exact = templates.find((template) => template.model_label === model);
  if (exact) return exact;

  const normalized = model.toLowerCase();
  return (
    templates.find((template) => template.model_label && normalized.includes(template.model_label.toLowerCase())) ??
    templates.find((template) => {
      const label = template.model_label?.toLowerCase() ?? "";
      if (normalized.includes("777") && label.includes("777")) return true;
      if (normalized.includes("787") && label.includes("787")) return true;
      if (normalized.includes("737") && label.includes("737")) return true;
      if (normalized.includes("a350") && label.includes("a350")) return true;
      if (normalized.includes("a330") && label.includes("a330")) return true;
      return false;
    }) ??
    null
  );
}
