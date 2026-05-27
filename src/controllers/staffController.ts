import { NextRequest } from "next/server";
import { callProcedure } from "@/config/db";
import { badRequest, created, ok, readJson, serverError } from "./http";

export async function generateFlights(request: NextRequest) {
  const body = await readJson(request);
  const required = ["schedule_id", "aircraft_id", "start_date", "end_date"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  try {
    await callProcedure("CALL generate_flights_from_schedule(?, ?, ?, ?)", [
      Number(body.schedule_id),
      Number(body.aircraft_id),
      String(body.start_date),
      String(body.end_date)
    ]);
    return created({
      schedule_id: Number(body.schedule_id),
      aircraft_id: Number(body.aircraft_id),
      start_date: String(body.start_date),
      end_date: String(body.end_date),
      trip_type_id: body.trip_type_id ?? null
    });
  } catch (error) {
    return serverError(error);
  }
}

export async function generateFlightSeats(request: NextRequest) {
  const body = await readJson(request);
  const required = ["flight_id", "economy_price", "business_price", "first_price"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  try {
    await callProcedure("CALL generate_flight_seats(?, ?, ?, ?)", [
      Number(body.flight_id),
      Number(body.economy_price),
      Number(body.business_price),
      Number(body.first_price)
    ]);
    return created({ flight_id: Number(body.flight_id), seatsGenerated: true });
  } catch (error) {
    return serverError(error);
  }
}

const reportCalls = {
  revenueFlight: "CALL revenue_report_by_flight()",
  revenueMonth: "CALL revenue_report_by_month()",
  loadFactor: "CALL revenue_and_load_factor_report()",
  revenueRoute: "CALL revenue_report_by_route()",
  revenueClass: "CALL revenue_breakdown_by_seat_class()"
} as const;

export async function getReport(kind: keyof typeof reportCalls) {
  try {
    const rows = await callProcedure(reportCalls[kind]);
    return ok({ kind, rows });
  } catch (error) {
    return serverError(error);
  }
}

export function getRevenueFlightReport() {
  return getReport("revenueFlight");
}

export function getRevenueMonthReport() {
  return getReport("revenueMonth");
}

export function getLoadFactorReport() {
  return getReport("loadFactor");
}

export function getRevenueRouteReport() {
  return getReport("revenueRoute");
}

export function getRevenueClassReport() {
  return getReport("revenueClass");
}
