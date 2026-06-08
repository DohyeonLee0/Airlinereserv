import {
  flightIdsOf,
  isConnectingRoute,
  priceOf,
  stopCountOf,
  type RouteRow
} from "@/lib/routeSearch";

export type JourneyType = "one_way" | "round_trip";

export function routeKey(row: RouteRow): string {
  const ids = flightIdsOf(row);
  return `${row.route_type ?? "DIRECT"}-${ids.join("-")}-${row.class_name ?? "any"}`;
}

/** Mirrors recommend_routes SP scoring formula. */
export function computeRecommendationScore(row: RouteRow): number {
  const directBonus = isConnectingRoute(row) ? 0 : 30;
  const seatBonus = Math.min(row.available_seats ?? 0, 20);
  const pricePenalty = Math.min(priceOf(row) / 50, 40);
  return Number((directBonus + seatBonus - pricePenalty).toFixed(2));
}

export function attachRecommendationScores(routes: RouteRow[], recommended: RouteRow[]): RouteRow[] {
  const scoreMap = new Map<string, number>();
  for (const row of recommended) {
    scoreMap.set(routeKey(row), row.recommendation_score ?? computeRecommendationScore(row));
  }
  return routes.map((row) => ({
    ...row,
    recommendation_score: scoreMap.get(routeKey(row)) ?? computeRecommendationScore(row)
  }));
}

function pickBestRoute(routes: RouteRow[]): RouteRow | null {
  if (!routes.length) return null;
  return routes.reduce((best, row) => {
    const bestScore = best.recommendation_score ?? 0;
    const rowScore = row.recommendation_score ?? 0;
    if (rowScore > bestScore) return row;
    if (rowScore < bestScore) return best;
    const priceDiff = priceOf(row) - priceOf(best);
    if (priceDiff < 0) return row;
    if (priceDiff > 0) return best;
    return stopCountOf(row) < stopCountOf(best) ? row : best;
  });
}

export function sortSearchResults(routes: RouteRow[]): { sorted: RouteRow[]; bestKey: string | null } {
  if (!routes.length) return { sorted: [], bestKey: null };

  const best = pickBestRoute(routes);
  if (!best) return { sorted: [], bestKey: null };

  const bestKey = routeKey(best);
  const rest = routes
    .filter((row) => routeKey(row) !== bestKey)
    .sort((a, b) => {
      const priceDiff = priceOf(a) - priceOf(b);
      if (priceDiff !== 0) return priceDiff;
      return stopCountOf(a) - stopCountOf(b);
    });

  return { sorted: [best, ...rest], bestKey };
}

export function hasActivePromotion(row: RouteRow): boolean {
  const code = row.applied_promo_code?.trim();
  return Boolean(code && code !== "NO_PROMO");
}

export function promoRowsToRoutes(rows: Record<string, unknown>[]): RouteRow[] {
  return rows.map((row) => {
    const flightId = row.flight_id as number | undefined;
    return {
      route_type: "DIRECT",
      flight_id: flightId,
      first_flight_id: flightId,
      dep_airport: String(row.dep_airport ?? ""),
      arr_airport: String(row.arr_airport ?? ""),
      dep_time: row.dep_time as string | undefined,
      arr_time: row.arr_time as string | undefined,
      flight_number: row.flight_number as string | undefined,
      first_flight_number: row.flight_number as string | undefined,
      class_name: row.class_name as string | undefined,
      available_seats: Number(row.available_seats ?? 0),
      original_lowest_price: row.original_lowest_price as number | undefined,
      final_lowest_price: row.final_lowest_price as number | undefined,
      discount_percent: row.discount_percent as number | undefined,
      applied_promo_code: row.applied_promo_code as string | undefined,
      promo_description: row.promo_description as string | undefined
    } satisfies RouteRow;
  });
}
