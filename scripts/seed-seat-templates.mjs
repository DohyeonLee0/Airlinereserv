function rowRange(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function buildSeats(rows, letters, classId) {
  const seats = [];
  for (const row of rows) {
    for (const letter of letters) {
      seats.push({ seat_number: `${row}${letter}`, class_id: classId });
    }
  }
  return seats;
}

function mergeSeatSections(sections) {
  const seen = new Set();
  const merged = [];
  for (const seat of sections) {
    const key = seat.seat_number.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push({ seat_number: key, class_id: seat.class_id });
  }
  return merged.sort((a, b) => a.seat_number.localeCompare(b.seat_number, undefined, { numeric: true }));
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

export const DEFAULT_SEAT_TEMPLATES = [
  {
    template_id: 1,
    template_name: "Boeing 777 wide-body",
    model_label: "Boeing 777-300ER",
    description: "First 1-2-1 · Business 2-2-2 · Economy 3-4-3",
    seats: layoutBoeing777()
  },
  {
    template_id: 2,
    template_name: "Boeing 787 wide-body",
    model_label: "Boeing 787-9",
    description: "Business 2-2-2 · Economy 3-3-3",
    seats: layoutBoeing787()
  },
  {
    template_id: 3,
    template_name: "Airbus A350-900",
    model_label: "Airbus A350-900",
    description: "Business 1-2-1 · Economy 3-3-3",
    seats: layoutAirbusA350()
  },
  {
    template_id: 4,
    template_name: "Airbus A330-900neo",
    model_label: "Airbus A330-900neo",
    description: "Business 1-2-1 · Economy 2-4-2",
    seats: layoutAirbusA330neo()
  },
  {
    template_id: 5,
    template_name: "Boeing 737-800",
    model_label: "Boeing 737-800",
    description: "Business 2-2 · Economy 3-3 narrow-body",
    seats: layoutBoeing737()
  }
];

export async function seedSeatTemplates(connection) {
  for (const template of DEFAULT_SEAT_TEMPLATES) {
    await connection.query("CALL upsert_aircraft_seat_template(?, ?, ?, ?, ?)", [
      template.template_id,
      template.template_name,
      template.model_label,
      template.description,
      JSON.stringify(template.seats)
    ]);
  }
}
