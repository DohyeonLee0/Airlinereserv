import { NextRequest } from "next/server";
import { PoolConnection, RowDataPacket } from "mysql2/promise";
import { callProcedure, getPool } from "@/config/db";
import { getSessionUser } from "@/lib/auth";
import { badRequest, conflict, created, forbidden, isConflictDbError, ok, readJson, requiredParams, serverError, unauthorized } from "./http";
import { toDateKey } from "@/lib/bookingPolicy";

type IdRow = RowDataPacket & {
  booking_id: number;
  ticket_id: number;
  payment_id: number;
  refund_id: number;
};

type FlightRow = RowDataPacket & {
  itinerary_id: number;
  status: string;
};

type SeatRow = RowDataPacket & {
  is_available: number;
  price: number;
  class_id: number;
};

type PromoRow = RowDataPacket & {
  discount_percent: number;
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

async function allocateTicketIds(connection: PoolConnection, count: number) {
  const [rows] = await connection.query<IdRow[]>(
    `SELECT GREATEST(COALESCE((SELECT MAX(ticket_id) FROM tickets), 6999), 6999) + ? AS ticket_id`,
    [count]
  );
  const start = rows[0].ticket_id - count + 1;
  return Array.from({ length: count }, (_, index) => start + index);
}

async function allocateRefundId(connection: PoolConnection) {
  await connection.query("SELECT GET_LOCK('ars_refund_ids', 5)");
  const [rows] = await connection.query<IdRow[]>(
    `SELECT GREATEST(COALESCE((SELECT MAX(refund_id) FROM refunds), 2999), 2999) + 1 AS refund_id`
  );
  return rows[0].refund_id;
}

type RouteRow = RowDataPacket & {
  dep_airport: string;
  arr_airport: string;
};

async function getFlightRoute(connection: PoolConnection, flightId: number) {
  const [rows] = await connection.query<RouteRow[]>(
    `SELECT fs.dep_airport, fs.arr_airport
     FROM flights f
     JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
     WHERE f.flight_id = ?`,
    [flightId]
  );
  const row = rows[0];
  if (!row) {
    throw new Error("Flight route not found");
  }
  return { dep: row.dep_airport, arr: row.arr_airport };
}

async function resolveRoundTripItineraryId(
  connection: PoolConnection,
  outboundFlightId: number,
  returnFlightId: number
) {
  const outbound = await getFlightRoute(connection, outboundFlightId);
  const inbound = await getFlightRoute(connection, returnFlightId);
  if (outbound.dep !== inbound.arr || outbound.arr !== inbound.dep) {
    throw new Error("Return flight must route back to the outbound origin");
  }

  const [existing] = await connection.query<RowDataPacket[]>(
    `SELECT itinerary_id
     FROM itineraries
     WHERE trip_type = 'RoundTrip'
       AND departure_airport_code = ?
       AND arrival_airport_code = ?
     ORDER BY itinerary_id
     LIMIT 1`,
    [outbound.dep, outbound.arr]
  );
  if (existing[0]?.itinerary_id != null) {
    return Number(existing[0].itinerary_id);
  }

  const [maxRows] = await connection.query<RowDataPacket[]>(
    "SELECT COALESCE(MAX(itinerary_id), 0) + 1 AS next_id FROM itineraries"
  );
  const nextId = Number(maxRows[0]?.next_id ?? 1);
  await connection.query(
    `INSERT INTO itineraries (itinerary_id, trip_type, departure_airport_code, arrival_airport_code)
     VALUES (?, 'RoundTrip', ?, ?)`,
    [nextId, outbound.dep, outbound.arr]
  );
  return nextId;
}

async function resolvePromoPrice(
  connection: PoolConnection,
  flightId: number,
  classId: number,
  basePrice: number,
  promoCode: string | null
) {
  if (!promoCode) return basePrice;

  const [rows] = await connection.query<PromoRow[]>(
    `SELECT MAX(p.discount_percent) AS discount_percent
     FROM promotions p
     JOIN flights f ON f.flight_id = ?
     JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
     WHERE p.is_active = TRUE
       AND p.promo_code = ?
       AND f.flight_date BETWEEN p.valid_from AND p.valid_to
       AND (p.schedule_id IS NULL OR p.schedule_id = fs.schedule_id)
       AND (p.dep_airport IS NULL OR p.dep_airport = fs.dep_airport)
       AND (p.arr_airport IS NULL OR p.arr_airport = fs.arr_airport)
       AND (p.class_id IS NULL OR p.class_id = ?)`,
    [flightId, promoCode.toUpperCase(), classId]
  );

  const discount = rows[0]?.discount_percent;
  if (discount == null) {
    throw new Error("Promotion code is not applicable to this flight and seat");
  }

  return Math.round(basePrice * (1 - discount / 100) * 100) / 100;
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
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorized();
  if (sessionUser.role !== "Customer") return forbidden("Only customers can create bookings");

  const body = await readJson(request);
  const required = ["flight_id", "seat_number", "payment_method"];
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
      sessionUser.user_id,
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
      return conflict("The selected seat is already held or reserved by another customer.");
    }
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function createItineraryBooking(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorized();
  if (sessionUser.role !== "Customer") return forbidden("Only customers can create bookings");

  const body = await readJson(request);
  const legs = Array.isArray(body.legs) ? body.legs : [];
  const required = ["payment_method"];
  const missing = required.filter((key) => body[key] === undefined || body[key] === "");
  if (missing.length) return badRequest(`Missing field(s): ${missing.join(", ")}`);
  if (legs.length === 0) return badRequest("Missing field(s): legs");

  if (legs.length === 1) {
    const leg = legs[0];
    const singleRequest = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({
        flight_id: leg.flight_id,
        seat_number: leg.seat_number,
        payment_method: body.payment_method,
        promo_code: leg.promo_code ?? body.promo_code
      })
    });
    return createBooking(singleRequest as NextRequest);
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM seat_holds WHERE expires_at < CURRENT_TIMESTAMP");

    const [roleRows] = await connection.query<RowDataPacket[]>(
      "SELECT role FROM users WHERE user_id = ? FOR UPDATE",
      [sessionUser.user_id]
    );
    if (roleRows[0]?.role !== "Customer") {
      throw new Error("Only customers can make reservations");
    }

    let itineraryId: number | null = null;
    let totalAmount = 0;
    const legDetails: Array<{ flight_id: number; seat_number: string; ticket_id: number; price: number }> = [];

    for (const leg of legs) {
      if (!leg.flight_id || !leg.seat_number) {
        throw new Error("Each leg requires flight_id and seat_number");
      }

      const flightId = Number(leg.flight_id);
      const seatNumber = String(leg.seat_number);

      const [flightRows] = await connection.query<FlightRow[]>(
        "SELECT itinerary_id, status FROM flights WHERE flight_id = ? FOR UPDATE",
        [flightId]
      );
      const flight = flightRows[0];
      if (!flight || flight.status !== "Scheduled") {
        throw new Error("Flight is not available for reservation");
      }

      if (itineraryId == null) {
        itineraryId = flight.itinerary_id;
      } else if (
        body.journey_type !== "round_trip" &&
        itineraryId !== flight.itinerary_id
      ) {
        throw new Error("All legs must belong to the same itinerary");
      }

      const [seatRows] = await connection.query<SeatRow[]>(
        "SELECT is_available, price, class_id FROM flight_seats WHERE flight_id = ? AND seat_number = ? FOR UPDATE",
        [flightId, seatNumber]
      );
      const seat = seatRows[0];
      if (!seat || seat.is_available !== 1) {
        throw new Error("Seat is not available");
      }

      const [holdRows] = await connection.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS hold_count
         FROM seat_holds
         WHERE flight_id = ? AND seat_number = ?
           AND expires_at >= CURRENT_TIMESTAMP
           AND user_id <> ?`,
        [flightId, seatNumber, sessionUser.user_id]
      );
      if (Number(holdRows[0]?.hold_count ?? 0) > 0) {
        throw new Error("Seat is currently held by another customer");
      }

      const promoCode = leg.promo_code ? String(leg.promo_code).toUpperCase() : null;
      const legPrice = await resolvePromoPrice(connection, flightId, seat.class_id, Number(seat.price), promoCode);
      totalAmount += legPrice;
      legDetails.push({ flight_id: flightId, seat_number: seatNumber, ticket_id: 0, price: legPrice });
    }

    if (body.journey_type === "round_trip" && legDetails.length >= 2) {
      itineraryId = await resolveRoundTripItineraryId(
        connection,
        legDetails[0].flight_id,
        legDetails[1].flight_id
      );
    }

    const ids = await allocateReservationIds(connection);
    const ticketIds = await allocateTicketIds(connection, legDetails.length);
    legDetails.forEach((leg, index) => {
      leg.ticket_id = ticketIds[index];
    });

    await connection.query(
      "INSERT INTO bookings (booking_id, user_id, itinerary_id, status) VALUES (?, ?, ?, 'Active')",
      [ids.booking_id, sessionUser.user_id, itineraryId]
    );

    for (const leg of legDetails) {
      await connection.query(
        "INSERT INTO booking_seats (booking_id, flight_id, seat_number) VALUES (?, ?, ?)",
        [ids.booking_id, leg.flight_id, leg.seat_number]
      );
      await connection.query(
        "UPDATE flight_seats SET is_available = 0 WHERE flight_id = ? AND seat_number = ?",
        [leg.flight_id, leg.seat_number]
      );
      await connection.query(
        "INSERT INTO tickets (ticket_id, booking_id, flight_id, seat_number) VALUES (?, ?, ?, ?)",
        [leg.ticket_id, ids.booking_id, leg.flight_id, leg.seat_number]
      );
      await connection.query(
        "DELETE FROM seat_holds WHERE user_id = ? AND flight_id = ? AND seat_number = ?",
        [sessionUser.user_id, leg.flight_id, leg.seat_number]
      );
    }

    await connection.query(
      "INSERT INTO payments (payment_id, booking_id, amount, payment_method, status) VALUES (?, ?, ?, ?, 'SUCCESS')",
      [ids.payment_id, ids.booking_id, totalAmount, String(body.payment_method)]
    );

    await connection.commit();

    return created({
      booking_id: ids.booking_id,
      payment_id: ids.payment_id,
      journey_type: body.journey_type === "round_trip" ? "round_trip" : "connecting",
      tickets: legDetails.map((leg) => ({
        ticket_id: leg.ticket_id,
        flight_id: leg.flight_id,
        seat_number: leg.seat_number,
        price: leg.price
      })),
      status: "Active"
    });
  } catch (error) {
    await connection.rollback();
    if (isConflictDbError(error)) {
      return conflict("One of the selected seats is already held or reserved by another customer.");
    }
    return serverError(error);
  } finally {
    connection.release();
  }
}

export async function cancelBooking(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorized();
  if (sessionUser.role !== "Customer") return forbidden("Only customers can cancel bookings");

  const body = await readJson(request);
  if (body.booking_id === undefined || body.booking_id === "") return badRequest("Missing field(s): booking_id");

  const connection = await getPool().getConnection();
  try {
    const [dateRows] = await connection.query<RowDataPacket[]>(
      `SELECT MIN(f.flight_date) AS earliest_departure
       FROM bookings b
       JOIN booking_seats bs ON b.booking_id = bs.booking_id
       JOIN flights f ON bs.flight_id = f.flight_id
       WHERE b.booking_id = ? AND b.user_id = ?`,
      [Number(body.booking_id), sessionUser.user_id]
    );
    const earliest = dateRows[0]?.earliest_departure;
    if (!earliest) {
      return badRequest("Booking not found");
    }
    const earliestKey = String(earliest).slice(0, 10);
    if (earliestKey < toDateKey()) {
      return badRequest("Cannot cancel a booking after the departure date has passed.");
    }

    const refundId = await allocateRefundId(connection);

    await connection.query("CALL cancel_reservation(?, ?, ?)", [
      refundId,
      Number(body.booking_id),
      sessionUser.user_id
    ]);
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

export async function getMyBookings() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorized();
  if (sessionUser.role !== "Customer") return forbidden("Only customers can view their bookings");

  try {
    const rows = await callProcedure("CALL get_customer_bookings(?)", [sessionUser.user_id]);
    return ok({ bookings: rows });
  } catch (error) {
    return serverError(error);
  }
}

export async function getBookingLedger(request: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return unauthorized();

  const parsed = requiredParams(request, ["booking_id"]);
  if (parsed.error || !parsed.values) return parsed.error;

  try {
    const bookingId = Number(parsed.values.get("booking_id"));
    const [bookingRows] = await getPool().query(
      `SELECT
         b.booking_id,
         b.user_id,
         b.itinerary_id,
         i.trip_type,
         i.departure_airport_code,
         i.arrival_airport_code,
         b.booking_time,
         b.status,
         bs.flight_id,
         bs.seat_number,
         t.ticket_id,
         p.payment_id,
         p.amount,
         p.payment_method,
         p.status AS payment_status,
         p.payment_time
       FROM bookings b
       JOIN itineraries i ON b.itinerary_id = i.itinerary_id
       LEFT JOIN booking_seats bs ON b.booking_id = bs.booking_id
       LEFT JOIN tickets t
         ON b.booking_id = t.booking_id
        AND bs.flight_id = t.flight_id
        AND bs.seat_number = t.seat_number
       LEFT JOIN payments p ON b.booking_id = p.booking_id
       WHERE b.booking_id = ?`,
      [bookingId]
    );
    const rows = Array.isArray(bookingRows) ? bookingRows : [];
    if (rows.length === 0) return badRequest("Booking not found");

    const ownerId = (rows[0] as { user_id?: string }).user_id;
    if (sessionUser.role === "Customer") {
      if (ownerId !== sessionUser.user_id) return forbidden("You can only view your own bookings");
    } else if (!["Staff", "Admin", "SuperAdmin"].includes(sessionUser.role)) {
      return forbidden();
    }

    const [refundRows] = await getPool().query(
      `SELECT refund_id, booking_id, payment_id, refund_amount, refund_time
       FROM refunds
       WHERE booking_id = ?
       ORDER BY refund_time DESC`,
      [bookingId]
    );

    return ok({
      booking: rows,
      refunds: refundRows
    });
  } catch (error) {
    return serverError(error);
  }
}
