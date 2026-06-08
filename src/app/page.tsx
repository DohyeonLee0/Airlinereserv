"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronRight,
  Globe2,
  Plane,
  ShieldCheck,
  Sparkles,
  Tag,
  Zap
} from "lucide-react";
import FlightResultCard, { priceOf, routeLabel, seatHref } from "@/app/components/home/FlightResultCard";
import FlightSearchWidget from "@/app/components/home/FlightSearchWidget";
import PopularRouteCard from "@/app/components/home/PopularRouteCard";
import Button from "@/app/components/ui/Button";
import { cn } from "@/lib/cn";
import { estimateRoundTripFrom, routeKey, type JourneyType } from "@/lib/flightSearch";
import {
  flightIdsOf,
  flightNumbersOf,
  isApproximateFare,
  stopLabel,
  priceLabelOf,
  roundTripSeatsHref,
  type RouteRow
} from "@/lib/routeSearch";

type SeatClass = "" | "Economy" | "Business" | "First";

type SearchResults = {
  outbound: RouteRow[];
  return: RouteRow[];
  bestOutboundKey: string | null;
  bestReturnKey: string | null;
  noPromotionalDeals: boolean;
  journeyType: JourneyType;
  searchedClassName: SeatClass;
};

type ExploreDeal = {
  arr: string;
  city: string;
  country: string;
  topRoute: RouteRow | null;
  loading: boolean;
};

const POPULAR_FROM_ICN = [
  { arr: "JFK", city: "New York", country: "United States" },
  { arr: "LAX", city: "Los Angeles", country: "United States" },
  { arr: "NRT", city: "Tokyo", country: "Japan" },
  { arr: "SIN", city: "Singapore", country: "Singapore" },
  { arr: "CDG", city: "Paris", country: "France" },
  { arr: "BKK", city: "Bangkok", country: "Thailand" }
] as const;

const HERO_STATS = [
  { label: "Global routes", value: "120+" },
  { label: "Partner airlines", value: "8" },
  { label: "Smart scoring", value: "Live" }
] as const;

const FEATURES = [
  {
    icon: Globe2,
    title: "Global routes",
    description: "Search direct and one-stop paths from ICN to major hubs worldwide."
  },
  {
    icon: Tag,
    title: "Live promo codes",
    description: "Apply codes like SUMMER10 and see discounted fares applied instantly."
  },
  {
    icon: Sparkles,
    title: "Smart scoring",
    description: "Price, seat availability, and connection quality ranked in real time."
  },
  {
    icon: Zap,
    title: "Real-time availability",
    description: "Seat counts and lowest fares pulled straight from the database."
  },
  {
    icon: ShieldCheck,
    title: "Secure booking",
    description: "Authenticated sessions, role-based access, and auditable reservation logs."
  },
  {
    icon: ArrowLeftRight,
    title: "Direct & connecting",
    description: "Compare non-stop flights and one-stop connections in a single search."
  }
] as const;

const STEPS = [
  { step: "01", title: "Search your route", desc: "Enter airports, date, and cabin — filter by price or promo code." },
  { step: "02", title: "Compare smart picks", desc: "Our scoring engine ranks routes by value, seats, and connection quality." },
  { step: "03", title: "Choose your seat", desc: "Select seats and complete your booking in a few clicks." }
] as const;

function flightIdOf(row: RouteRow) {
  return flightIdsOf(row)[0] ?? "";
}

export default function HomePage() {
  const resultsRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState({
    dep_airport: "ICN",
    arr_airport: "JFK",
    flight_date: "2026-06-10",
    return_date: "2026-06-17",
    journey_type: "one_way" as JourneyType,
    class_name: "" as SeatClass,
    max_price: "",
    apply_promotions: false
  });
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [selectedOutbound, setSelectedOutbound] = useState<RouteRow | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<RouteRow | null>(null);
  const [recommended, setRecommended] = useState<RouteRow[]>([]);
  const [exploreDeals, setExploreDeals] = useState<ExploreDeal[]>(
    POPULAR_FROM_ICN.map((d) => ({ ...d, topRoute: null, loading: true }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ role: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data?.user) {
          setSessionUser(json.data.user);
        } else {
          setSessionUser(null);
        }
      })
      .catch(() => setSessionUser(null))
      .finally(() => setAuthReady(true));
  }, []);

  const loadRecommended = useCallback(async (dep: string, arr: string, date: string, className: string) => {
    const params = new URLSearchParams({
      dep_airport: dep,
      arr_airport: arr,
      flight_date: date
    });
    if (className) params.set("class_name", className);
    const response = await fetch(`/api/flights/recommend?${params}`);
    const json = await response.json();
    return (json.data?.routes ?? []) as RouteRow[];
  }, []);

  useEffect(() => {
    loadRecommended(form.dep_airport, form.arr_airport, form.flight_date, form.class_name)
      .then((rows) => setRecommended(rows))
      .catch(() => setRecommended([]));
  }, [form.dep_airport, form.arr_airport, form.flight_date, form.class_name, loadRecommended]);

  useEffect(() => {
    let cancelled = false;
    async function loadExploreDeals() {
      const updates = await Promise.all(
        POPULAR_FROM_ICN.map(async (dest) => {
          try {
            const rows = await loadRecommended("ICN", dest.arr, form.flight_date, form.class_name);
            return { ...dest, topRoute: rows[0] ?? null, loading: false };
          } catch {
            return { ...dest, topRoute: null, loading: false };
          }
        })
      );
      if (!cancelled) setExploreDeals(updates);
    }
    loadExploreDeals();
    return () => {
      cancelled = true;
    };
  }, [form.flight_date, form.class_name, loadRecommended]);

  async function runSearch(scrollToResults = true, overrides?: Partial<typeof form>) {
    const activeForm = { ...form, ...overrides };
    setLoading(true);
    setError("");
    setHasSearched(true);
    setSelectedOutbound(null);
    setSelectedReturn(null);

    const params = new URLSearchParams({
      dep_airport: activeForm.dep_airport,
      arr_airport: activeForm.arr_airport,
      flight_date: activeForm.flight_date,
      journey_type: activeForm.journey_type,
      apply_promotions: String(activeForm.apply_promotions)
    });
    if (activeForm.class_name) params.set("class_name", activeForm.class_name);
    if (activeForm.max_price) params.set("max_price", activeForm.max_price);
    if (activeForm.journey_type === "round_trip") {
      params.set("return_date", activeForm.return_date);
    }

    try {
      const response = await fetch(`/api/flights/search?${params}`);
      const json = await response.json();
      if (!response.ok || !json.success) {
        setError(json.message ?? "An error occurred while searching.");
        setSearchResults(null);
        return;
      }

      const data = json.data ?? {};
      setSearchResults({
        outbound: data.outbound ?? data.routes ?? [],
        return: data.return ?? [],
        bestOutboundKey: data.bestOutboundKey ?? data.bestRouteKey ?? null,
        bestReturnKey: data.bestReturnKey ?? null,
        noPromotionalDeals: Boolean(data.noPromotionalDeals),
        journeyType: data.journeyType ?? activeForm.journey_type,
        searchedClassName: activeForm.class_name
      });

      if (scrollToResults) {
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch {
      setError("An error occurred while searching.");
      setSearchResults(null);
    } finally {
      setLoading(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runSearch();
  }

  function swapAirports() {
    setForm((prev) => ({ ...prev, dep_airport: prev.arr_airport, arr_airport: prev.dep_airport }));
  }

  function pickDestination(arr: string) {
    setForm((prev) => ({ ...prev, arr_airport: arr, journey_type: "one_way" }));
    void runSearch(true, { arr_airport: arr, journey_type: "one_way" });
  }

  function renderResultCards(
    routes: RouteRow[],
    bestKey: string | null,
    keyPrefix: string,
    leg?: "outbound" | "return",
    roundTrip?: { origin: string; destination: string; outboundDate: string; returnDate: string },
    selectionMode = false,
    selected: RouteRow | null = null,
    onSelect?: (row: RouteRow) => void,
    pairedLeg?: RouteRow | null,
    seatClassFilter: SeatClass = "",
    journeyType: JourneyType = "one_way"
  ) {
    return routes.map((row, index) => (
      <FlightResultCard
        key={`${keyPrefix}-${routeKey(row)}-${index}`}
        row={row}
        isBest={bestKey !== null && routeKey(row) === bestKey}
        leg={leg}
        roundTrip={roundTrip}
        selectionMode={selectionMode}
        isSelected={selected !== null && routeKey(selected) === routeKey(row)}
        onSelect={onSelect ? () => onSelect(row) : undefined}
        pairedLeg={pairedLeg}
        seatClassFilter={seatClassFilter}
        journeyType={journeyType}
      />
    ));
  }

  const roundTripSelectionTotal =
    selectedOutbound && selectedReturn ? priceOf(selectedOutbound) + priceOf(selectedReturn) : null;
  const roundTripReady = Boolean(selectedOutbound && selectedReturn && searchResults?.return.length);

  const roundTripEstimate =
    searchResults?.journeyType === "round_trip"
      ? estimateRoundTripFrom(searchResults.outbound, searchResults.return)
      : null;

  return (
    <div className="bg-white">
      <div className="border-b border-zinc-100 bg-zinc-50/80">
        <div className="mx-auto flex max-w-[1120px] items-center justify-center gap-2 px-5 py-3 sm:px-8">
          <span className="rounded-full bg-cerulean-500/10 px-2.5 py-0.5 text-xs font-semibold text-cerulean-800">Demo</span>
          <p className="text-sm text-zinc-600">CSE305 airline reservation — search, score, and book in one place</p>
          <ChevronRight className="size-4 text-zinc-400" />
        </div>
      </div>

      <section id="hero" className="relative overflow-hidden px-5 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
        <div className="pointer-events-none absolute -right-32 -top-32 size-[480px] rounded-full bg-gradient-to-br from-cerulean-400/20 via-sky-blue-light/30 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -left-20 top-1/2 size-[320px] rounded-full bg-gradient-to-tr from-yale-blue-2-400/10 to-transparent blur-3xl" />

        <div className="relative mx-auto max-w-[1120px]">
          <h1 className="max-w-[720px] text-[40px] font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-[56px] lg:text-[64px]">
            CSE305 Air makes
            <br />
            <span className="bg-gradient-to-r from-deep-space-blue via-cerulean-700 to-yale-blue-2-600 bg-clip-text text-transparent">
              flight search simple
            </span>
          </h1>
          <p className="mt-6 max-w-[540px] text-lg leading-relaxed text-zinc-500 sm:text-xl">
            <span className="font-medium text-zinc-800">Direct and connecting routes.</span> Compare fares, apply promo
            codes, and let our scoring engine surface the smartest options.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-zinc-100 bg-zinc-50/80 px-5 py-4">
                <p className="text-2xl font-bold tracking-tight text-zinc-900">{stat.value}</p>
                <p className="mt-0.5 text-sm text-zinc-500">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <FlightSearchWidget
              form={form}
              loading={loading}
              onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              onSubmit={submit}
              onSwapAirports={swapAirports}
            />
          </div>

          <p className="mt-4 text-sm text-zinc-400">MariaDB stored procedures · Live seat inventory · Smart recommendations</p>
        </div>
      </section>

      {!hasSearched && (
        <>
          <section id="destinations" className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-24 sm:px-8">
            <div className="mx-auto max-w-[1120px]">
              <p className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Trending</p>
              <h2 className="mt-3 max-w-[520px] text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                Popular from ICN
              </h2>
              <p className="mt-4 max-w-[560px] text-lg text-zinc-500">
                Tap a destination — we&apos;ll search and surface the best route for your date.
              </p>
              <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {exploreDeals.map((deal) => (
                  <PopularRouteCard
                    key={deal.arr}
                    dep="ICN"
                    arr={deal.arr}
                    city={deal.city}
                    country={deal.country}
                    flightDate={form.flight_date}
                    seatClass={form.class_name}
                    price={deal.topRoute ? priceOf(deal.topRoute) : undefined}
                    priceApproximate={
                      deal.topRoute ? isApproximateFare(deal.topRoute, form.journey_type) : false
                    }
                    score={deal.topRoute?.recommendation_score}
                    badge={
                      deal.topRoute?.discount_percent
                        ? `-${deal.topRoute.discount_percent}%`
                        : deal.topRoute
                          ? stopLabel(deal.topRoute)
                          : undefined
                    }
                    onSelect={() => pickDestination(deal.arr)}
                  />
                ))}
              </div>
            </div>
          </section>

          <section id="smart-picks" className="border-t border-zinc-100 bg-white px-5 py-24 sm:px-8">
            <div className="mx-auto max-w-[1120px]">
              <p className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Smart picks</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                    {form.dep_airport} → {form.arr_airport}
                  </h2>
                  <p className="mt-4 max-w-[560px] text-lg text-zinc-500">
                    Top scored routes — price, availability, and connection quality combined.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    void runSearch(true);
                  }}
                >
                  Search this route
                </Button>
              </div>

              <div className="mt-10 overflow-hidden rounded-2xl border border-zinc-100 bg-white">
                <div className="divide-y divide-zinc-100">
                  {recommended.slice(0, 5).map((row, index) => (
                    <div
                      key={`${flightIdOf(row)}-${index}`}
                      className="flex flex-wrap items-center justify-between gap-4 px-6 py-5 transition hover:bg-zinc-50/80"
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            index === 0 ? "bg-deep-space-blue text-white" : "bg-zinc-100 text-zinc-600"
                          )}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-semibold text-zinc-900">{routeLabel(row)}</p>
                          <p className="text-sm text-zinc-500">
                            {flightNumbersOf(row).join(" · ")} · {row.available_seats} seats left
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold tabular-nums text-zinc-900">
                            ${priceLabelOf(row, form.journey_type)}
                          </p>
                          <p className="text-xs text-zinc-500">{row.recommendation_score ?? "—"} score</p>
                        </div>
                        <Link href={seatHref(row, form.class_name || undefined)}>
                          <Button size="sm">Select</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                  {recommended.length === 0 && (
                    <p className="px-6 py-10 text-center text-sm text-zinc-500">Loading recommendations for your route…</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="border-t border-zinc-100 bg-zinc-50/50 px-5 py-24 sm:px-8">
            <div className="mx-auto max-w-[1120px]">
              <p className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Features</p>
              <h2 className="mt-3 max-w-[520px] text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                Everything you need to find the right flight
              </h2>
              <p className="mt-4 max-w-[560px] text-lg text-zinc-500">
                Search, compare, and book — in one calm, focused interface.
              </p>
              <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, description }) => (
                  <div
                    key={title}
                    className="group rounded-2xl border border-zinc-100 bg-white p-7 transition-all duration-200 hover:border-zinc-200 hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
                  >
                    <div className="flex size-11 items-center justify-center rounded-xl bg-zinc-900 text-white transition-transform duration-200 group-hover:scale-105">
                      <Icon className="size-5" strokeWidth={1.75} />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-zinc-900">{title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">{description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="how-it-works" className="border-t border-zinc-100 bg-white px-5 py-24 sm:px-8">
            <div className="mx-auto max-w-[1120px]">
              <h2 className="text-center text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">How it works</h2>
              <p className="mx-auto mt-4 max-w-md text-center text-lg text-zinc-500">Three steps from search to seat selection</p>
              <div className="mt-16 grid gap-8 md:grid-cols-3">
                {STEPS.map((item) => (
                  <div key={item.step} className="relative text-center md:text-left">
                    <span className="text-5xl font-bold text-zinc-100">{item.step}</span>
                    <h3 className="mt-2 text-xl font-semibold text-zinc-900">{item.title}</h3>
                    <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      {hasSearched && (
        <section ref={resultsRef} className={cn(
          "scroll-mt-24 border-t border-zinc-100 bg-zinc-50/50 px-5 py-16 sm:px-8",
          searchResults?.journeyType === "round_trip" && "pb-36"
        )}>
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Results</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
                  {searchResults?.journeyType === "round_trip" ? (
                    <>
                      {form.dep_airport} ↔ {form.arr_airport}
                      <span className="text-zinc-500"> · Round-trip</span>
                    </>
                  ) : (
                    <>
                      {form.dep_airport} → {form.arr_airport}
                    </>
                  )}
                </h2>
                <p className="mt-1 text-zinc-500">
                  {searchResults?.journeyType === "round_trip"
                    ? `${form.flight_date} – ${form.return_date}`
                    : form.flight_date}
                  {form.class_name ? ` · ${form.class_name}` : " · All classes"}
                  {form.max_price ? ` · Max $${form.max_price}` : ""}
                  {form.apply_promotions ? " · Promotions only" : ""}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setHasSearched(false)}>
                ← Back to explore
              </Button>
            </div>

            {error && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>
            )}

            {!error && !loading && searchResults?.noPromotionalDeals && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
                No promotional deals available for this route/date.
              </div>
            )}

            {!error && !loading && searchResults?.journeyType === "round_trip" && (
              <div className="mb-6 rounded-2xl border border-cerulean-200/80 bg-cerulean-50/50 px-5 py-4">
                {roundTripEstimate ? (
                  <>
                    <p className="text-sm font-semibold text-zinc-900">
                      Round-trip total from ${roundTripEstimate.fromTotal.toLocaleString("en-US")}
                      <span className="font-normal text-zinc-600">
                        {" "}
                        · {roundTripEstimate.classLabel} · outbound + return per leg
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      Select one outbound and one return flight, then continue to choose seats for both legs.
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-zinc-600">
                    Select one outbound and one return flight. Each card shows the fare for that leg only.
                    {searchResults.return.length === 0
                      ? " No return flights were found for your return date."
                      : ""}
                  </p>
                )}
              </div>
            )}

            {!error && !loading && searchResults && searchResults.outbound.length === 0 && searchResults.return.length === 0 && !searchResults.noPromotionalDeals && (
              <div className="rounded-2xl border border-zinc-100 bg-white p-8 text-center text-zinc-500">
                No flights found. Try another date or destination.
              </div>
            )}

            {searchResults && searchResults.outbound.length > 0 && (
              <div className="mb-10">
                <h3 className="mb-1 text-lg font-semibold text-zinc-900">
                  {searchResults.journeyType === "round_trip" ? "Outbound flights" : "Flights"}
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({searchResults.outbound.length} result{searchResults.outbound.length === 1 ? "" : "s"})
                  </span>
                </h3>
                {searchResults.journeyType === "round_trip" ? (
                  <p className="mb-4 text-sm text-zinc-500">
                    {form.dep_airport} → {form.arr_airport} · {form.flight_date}
                  </p>
                ) : null}
                <div className="grid gap-4 lg:grid-cols-2">
                  {renderResultCards(
                    searchResults.outbound,
                    searchResults.bestOutboundKey,
                    "outbound",
                    searchResults.journeyType === "round_trip" ? "outbound" : undefined,
                    searchResults.journeyType === "round_trip"
                      ? {
                          origin: form.dep_airport,
                          destination: form.arr_airport,
                          outboundDate: form.flight_date,
                          returnDate: form.return_date
                        }
                      : undefined,
                    searchResults.journeyType === "round_trip",
                    selectedOutbound,
                    setSelectedOutbound,
                    selectedReturn,
                    searchResults.searchedClassName,
                    searchResults.journeyType
                  )}
                </div>
              </div>
            )}

            {searchResults && searchResults.journeyType === "round_trip" && (
              <div>
                <h3 className="mb-1 text-lg font-semibold text-zinc-900">
                  Return flights
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({searchResults.return.length} result{searchResults.return.length === 1 ? "" : "s"})
                  </span>
                </h3>
                <p className="mb-4 text-sm text-zinc-500">
                  {form.arr_airport} → {form.dep_airport} · {form.return_date}
                </p>
                {searchResults.return.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {renderResultCards(
                      searchResults.return,
                      searchResults.bestReturnKey,
                      "return",
                      "return",
                      {
                        origin: form.dep_airport,
                        destination: form.arr_airport,
                        outboundDate: form.flight_date,
                        returnDate: form.return_date
                      },
                      true,
                      selectedReturn,
                      setSelectedReturn,
                      selectedOutbound,
                      searchResults.searchedClassName,
                      searchResults.journeyType
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-zinc-100 bg-white p-6 text-sm text-zinc-500">
                    No return flights on this date. Try another return date.
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {hasSearched && searchResults?.journeyType === "round_trip" && (
        <div className="sticky bottom-0 z-40 border-t border-zinc-200 bg-white/95 px-5 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur sm:px-8">
          <div className="mx-auto flex max-w-[1120px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-zinc-600">
              <p className="font-semibold text-zinc-900">Round-trip selection</p>
              <p className="mt-1">
                Outbound:{" "}
                {selectedOutbound ? (
                  <span className="font-medium text-zinc-800">
                    {flightNumbersOf(selectedOutbound).join(" · ")} · ${priceOf(selectedOutbound).toLocaleString("en-US")}
                  </span>
                ) : (
                  <span className="text-zinc-400">Not selected</span>
                )}
                {" · "}
                Return:{" "}
                {selectedReturn ? (
                  <span className="font-medium text-zinc-800">
                    {flightNumbersOf(selectedReturn).join(" · ")} · ${priceOf(selectedReturn).toLocaleString("en-US")}
                  </span>
                ) : (
                  <span className="text-zinc-400">Not selected</span>
                )}
              </p>
              {roundTripSelectionTotal !== null ? (
                <p className="mt-1 font-semibold text-zinc-900">
                  Total from ${roundTripSelectionTotal.toLocaleString("en-US")}
                </p>
              ) : null}
            </div>
            {roundTripReady && selectedOutbound && selectedReturn ? (
              <Link
                href={roundTripSeatsHref(
                  selectedOutbound,
                  selectedReturn,
                  searchResults?.searchedClassName || undefined
                )}
              >
                <Button size="lg">Choose seats · round-trip</Button>
              </Link>
            ) : (
              <Button size="lg" disabled>
                Choose seats · round-trip
              </Button>
            )}
          </div>
        </div>
      )}

      {!hasSearched && authReady && !sessionUser && (
        <section className="mx-5 mb-24 sm:mx-8">
          <div className="mx-auto max-w-[1120px] overflow-hidden rounded-3xl bg-deep-space-blue px-8 py-16 text-center sm:px-16 sm:py-20">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Ready to book your next flight?</h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-sky-blue-light/90">
              Create an account to save bookings, or sign in as staff to manage operations.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link href="/signup">
                <Button variant="inverted" size="lg">
                  Create account
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="onDark" size="lg">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-zinc-100 bg-zinc-50/50">
        <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 items-center justify-center rounded-lg bg-deep-space-blue text-white">
                  <Plane className="size-3.5" strokeWidth={1.75} />
                </span>
                <span className="font-semibold text-zinc-900">CSE305 Air</span>
              </div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-500">
                MariaDB stored procedure airline reservation demo for CSE305.
              </p>
            </div>
            <div className="flex gap-12 text-sm">
              <div>
                <p className="font-medium text-zinc-900">Product</p>
                <ul className="mt-3 space-y-2 text-zinc-500">
                  <li>
                    <Link href="/" className="hover:text-zinc-800">
                      Search flights
                    </Link>
                  </li>
                  <li>
                    <Link href="/login" className="hover:text-zinc-800">
                      Sign in
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup" className="hover:text-zinc-800">
                      Create account
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-zinc-900">Staff</p>
                <ul className="mt-3 space-y-2 text-zinc-500">
                  <li>
                    <Link href="/dashboard" className="hover:text-zinc-800">
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link href="/signup/staff" className="hover:text-zinc-800">
                      Request access
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <p className="mt-10 border-t border-zinc-200/80 pt-8 text-center text-xs text-zinc-400 sm:text-left">
            © {new Date().getFullYear()} CSE305 Air. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
