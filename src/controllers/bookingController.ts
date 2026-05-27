import { NextRequest } from "next/server";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { callProcedure, getPool } from "@/config/db";
import { badRequest, conflict, created, isConflictDbError, ok, readJson, requiredParams, serverError } from "./http";

type IdRow = RowDataPacket & {
  booking_id: number;
  ticket_id: number;
  payment_id: number;
  refund_id: number;
};

async function allocateReservationIds(connection: PoolConnection) {
  const [rows] = await connection.query<IdRow[]>(
    `SELECT
       GREATEST(COALESCE((SELECT MAX(booking_id) FROM bookings), 4999), 4999) + 1 AS booking_id,
       GREATEST(COALESCE((SELECT MAX(ticket_id) FROM tickets), 6999), 6999) + 1 AS ticket_id,
       GREATEST(COALESCE((SELECT MAX(payment_id) FROM payments), 8999), 8999) + 1 AS payment_id`
  );
  return rows[0];
}

async function allocateRefundId(connection: PoolConnection) {
  await connection.query("SELECT GET_LOCK('ars_refund_ids', 5)");
  const [rows] = await connection.query<IdRow[]>(
    `SELECT GREATEST(COALESCE((SELECT MAX(refund_id) FROM refunds), 2999), 2999) + 1 AS refund_id`
  );
  return rows[0].refund_id;
}

export async function getCustomerProfiles() {
  try {
    const rows = await callProcedure("CALL get_customer_full_name()");
    return ok({ customers: rows });
  } catch (error) {
    return serverError(error);
  }
}

export async function createBooking(request: NextRequest) {
  const body = await readJson(request);
  const required = ["user_id", "flight_id", "seat_number", "payment_method"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);

  const connection = await getPool().getConnection();
  try {
    await connection.query("SELECT GET_LOCK('ars_reservation_ids', 5)");
    const ids = await allocateReservationIds(connection);

    await connection.query("CALL make_reservation_with_promo(?, ?, ?, ?, ?, ?, ?, ?)", [
      ids.booking_id,
      ids.ticket_id,
      ids.payment_id,
      String(body.user_id),
      Number(body.flight_id),
      String(body.seat_number),
      String(body.payment_method),
      body.promo_code ? String(body.promo_code).toUpperCase() : null
    ]);
    await connection.query("SELECT RELEASE_LOCK('ars_reservation_ids')");
    return created({ ...ids, status: "Active" });
  } catch (error) {
    try {
      await connection.query("SELECT RELEASE_LOCK('ars_reservation_ids')");
    } catch {
      // ignore rollback after committed id allocation
    }
    if (isConflictDbError(error)) {
      return conflict("선택하신 좌석은 이미 다른 고객이 결제 중이거나 예약 완료된 좌석입니다.");
    }
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function createItineraryBooking(request: NextRequest) {
  const body = await readJson(request);
  const legs = Array.isArray(body.legs) ? body.legs : [];
  const required = ["user_id", "payment_method"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  if (legs.length === 0) return badRequest("Missing field(s): legs");

  const connection = await getPool().getConnection();
  const createdRows: Array<{ booking_id: number; ticket_id: number; payment_id: number; flight_id: number; seat_number: string }> = [];

  try {
    await connection.query("SELECT GET_LOCK('ars_reservation_ids', 5)");

    for (const leg of legs) {
      if (!leg.flight_id || !leg.seat_number) return badRequest("Each leg requires flight_id and seat_number");

      const ids = await allocateReservationIds(connection);
      await connection.query("CALL make_reservation_with_promo(?, ?, ?, ?, ?, ?, ?, ?)", [
        ids.booking_id,
        ids.ticket_id,
        ids.payment_id,
        String(body.user_id),
        Number(leg.flight_id),
        String(leg.seat_number),
        String(body.payment_method),
        leg.promo_code ? String(leg.promo_code).toUpperCase() : null
      ]);
      createdRows.push({
        ...ids,
        flight_id: Number(leg.flight_id),
        seat_number: String(leg.seat_number)
      });
    }

    await connection.query("SELECT RELEASE_LOCK('ars_reservation_ids')");
    return created({ bookings: createdRows, status: "Active" });
  } catch (error) {
    await connection.query("SELECT RELEASE_LOCK('ars_reservation_ids')").catch(() => undefined);
    if (isConflictDbError(error)) {
      return conflict("선택하신 좌석 중 하나가 이미 다른 고객이 결제 중이거나 예약 완료된 좌석입니다.");
    }
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function cancelBooking(request: NextRequest) {
  const body = await readJson(request);
  if (body.booking_id === undefined || body.booking_id === "") return badRequest("Missing field(s): booking_id");

  const connection = await getPool().getConnection();
  try {
    const refundId = await allocateRefundId(connection);

    await connection.query("CALL cancel_reservation(?, ?)", [refundId, Number(body.booking_id)]);
    await connection.query("SELECT RELEASE_LOCK('ars_refund_ids')");
    return ok({ booking_id: Number(body.booking_id), status: "Cancelled", refund_id: refundId });
  } catch (error) {
    try {
      await connection.query("SELECT RELEASE_LOCK('ars_refund_ids')");
    } catch {
      // ignore rollback after committed id allocation
    }
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function getBookingLedger(request: NextRequest) {
  const parsed = requiredParams(request, ["booking_id"]);
  if (parsed.error || !parsed.values) return parsed.error;

  try {
    const bookingId = Number(parsed.values.get("booking_id"));
    const [bookingRows] = await getPool().query(
      `SELECT
         b.booking_id,
         b.user_id,
         b.flight_id,
         b.booking_time,
         b.status,
         bs.seat_number,
         t.ticket_id,
         p.payment_id,
         p.amount,
         p.payment_method,
         p.status AS payment_status,
         p.payment_time
       FROM bookings b
       LEFT JOIN booking_seats bs ON b.booking_id = bs.booking_id
       LEFT JOIN tickets t ON b.booking_id = t.booking_id
       LEFT JOIN payments p ON b.booking_id = p.booking_id
       WHERE b.booking_id = ?`,
      [bookingId]
    );
    const [refundRows] = await getPool().query(
      `SELECT refund_id, booking_id, payment_id, refund_amount, refund_time
       FROM refunds
       WHERE booking_id = ?
       ORDER BY refund_time DESC`,
      [bookingId]
    );

    return ok({
      booking: Array.isArray(bookingRows) ? bookingRows[0] ?? null : null,
      refunds: refundRows
    });
  } catch (error) {
    return serverError(error);
  }
}
