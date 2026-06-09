import { RowDataPacket } from "mysql2/promise";
import { getPool } from "@/config/db";
import { hasActivePromotion } from "@/lib/flightSearch";
import { flightIdsOf, type RouteRow } from "@/lib/routeSearch";

type LegPromoQuote = {
  flightId: number;
  className: string;
  availableSeats: number;
  originalPrice: number;
  finalPrice: number;
  discountPercent: number;
  promoCode: string;
  promoDescription: string | null;
};

type LegPromoRow = RowDataPacket & {
  flight_id: number;
  class_name: string;
  available_seats: number;
  original_lowest_price: number;
  discount_percent: number;
  final_lowest_price: number;
  applied_promo_code: string;
  promo_description: string | null;
};

function pickBestQuotePerFlight(rows: LegPromoRow[]): Map<number, LegPromoQuote> {
  const bestByFlight = new Map<number, LegPromoQuote>();

  for (const row of rows) {
    const quote: LegPromoQuote = {
      flightId: Number(row.flight_id),
      className: String(row.class_name),
      availableSeats: Number(row.available_seats ?? 0),
      originalPrice: Number(row.original_lowest_price ?? 0),
      finalPrice: Number(row.final_lowest_price ?? 0),
      discountPercent: Number(row.discount_percent ?? 0),
      promoCode: String(row.applied_promo_code ?? "NO_PROMO"),
      promoDescription: row.promo_description ? String(row.promo_description) : null
    };

    const existing = bestByFlight.get(quote.flightId);
    if (!existing || quote.finalPrice < existing.finalPrice) {
      bestByFlight.set(quote.flightId, quote);
    }
  }

  return bestByFlight;
}

export async function fetchFlightPromoQuotes(
  flightIds: number[],
  classId: number | null
): Promise<Map<number, LegPromoQuote>> {
  if (!flightIds.length) return new Map();

  const placeholders = flightIds.map(() => "?").join(", ");
  const [rows] = await getPool().query<LegPromoRow[]>(
    `SELECT
       f.flight_id,
       sc.class_name,
       COUNT(fls.seat_number) AS available_seats,
       MIN(fls.price) AS original_lowest_price,
       COALESCE(MAX(CASE WHEN p.promo_id IS NOT NULL THEN p.discount_percent END), 0) AS discount_percent,
       ROUND(
         MIN(fls.price)
         * (1 - COALESCE(MAX(CASE WHEN p.promo_id IS NOT NULL THEN p.discount_percent END), 0) / 100),
         2
       ) AS final_lowest_price,
       COALESCE(MAX(CASE WHEN p.promo_id IS NOT NULL THEN p.promo_code END), 'NO_PROMO') AS applied_promo_code,
       MAX(CASE WHEN p.promo_id IS NOT NULL THEN p.description END) AS promo_description
     FROM flights f
     JOIN flight_schedules fs ON f.schedule_id = fs.schedule_id
     JOIN flight_seats fls ON f.flight_id = fls.flight_id
     JOIN seat_classes sc ON fls.class_id = sc.class_id
     LEFT JOIN promotions p
       ON p.is_active = TRUE
      AND f.flight_date BETWEEN p.valid_from AND p.valid_to
      AND (p.schedule_id IS NULL OR p.schedule_id = fs.schedule_id)
      AND (p.dep_airport IS NULL OR p.dep_airport = fs.dep_airport)
      AND (p.arr_airport IS NULL OR p.arr_airport = fs.arr_airport)
      AND (p.class_id IS NULL OR p.class_id = fls.class_id)
     WHERE f.flight_id IN (${placeholders})
       AND f.status = 'Scheduled'
       AND fls.is_available = 1
       AND (? IS NULL OR fls.class_id = ?)
     GROUP BY f.flight_id, sc.class_name, sc.class_id`,
    [...flightIds, classId, classId]
  );

  return pickBestQuotePerFlight(rows);
}

function pickPrimaryPromoLeg(quotes: LegPromoQuote[]) {
  const promoted = quotes.filter((quote) => quote.promoCode !== "NO_PROMO");
  if (!promoted.length) return null;

  return promoted.reduce((best, quote) => {
    if (quote.discountPercent > best.discountPercent) return quote;
    if (quote.discountPercent < best.discountPercent) return best;
    return quote.promoCode < best.promoCode ? quote : best;
  });
}

export async function enrichConnectingRoutesWithPromos(
  routes: RouteRow[],
  classId: number | null,
  maxPrice: number | null
): Promise<RouteRow[]> {
  if (!routes.length) return [];

  const allFlightIds = [...new Set(routes.flatMap((route) => flightIdsOf(route)))];
  const quotesByFlight = await fetchFlightPromoQuotes(allFlightIds, classId);
  const enriched: RouteRow[] = [];

  for (const route of routes) {
    const legIds = flightIdsOf(route);
    const legQuotes = legIds
      .map((flightId) => quotesByFlight.get(flightId))
      .filter((quote): quote is LegPromoQuote => Boolean(quote));

    if (legQuotes.length !== legIds.length) continue;
    if (!legQuotes.some((quote) => quote.promoCode !== "NO_PROMO")) continue;

    const originalTotal = legQuotes.reduce((sum, quote) => sum + quote.originalPrice, 0);
    const finalTotal = legQuotes.reduce((sum, quote) => sum + quote.finalPrice, 0);
    if (maxPrice !== null && finalTotal > maxPrice) continue;

    const primaryPromo = pickPrimaryPromoLeg(legQuotes);
    const classNames = [...new Set(legQuotes.map((quote) => quote.className))];
    const availableSeats = Math.min(...legQuotes.map((quote) => quote.availableSeats));
    const overallDiscount =
      originalTotal > 0 ? Number(((1 - finalTotal / originalTotal) * 100).toFixed(2)) : 0;

    enriched.push({
      ...route,
      class_name: classNames.length === 1 ? classNames[0] : route.class_name,
      available_seats: availableSeats,
      original_lowest_price: originalTotal,
      final_lowest_price: finalTotal,
      total_lowest_price: finalTotal,
      discount_percent: overallDiscount,
      applied_promo_code: primaryPromo?.promoCode,
      promo_description: primaryPromo?.promoDescription ?? undefined
    });
  }

  return enriched.filter(hasActivePromotion);
}
