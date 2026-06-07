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

type RouteRow = {
  route_type?: "DIRECT" | "ONE_STOP";
  flight_id?: number;
  first_flight_id?: number;
  first_flight_number?: string;
  second_flight_id?: number | null;
  flight_number?: string;
  second_flight_number?: string | null;
  dep_airport: string;
  arr_airport: string;
  flight_date: string;
  connection_airport?: string | null;
  available_seats: number;
  lowest_available_price?: number;
  lowest_price?: number;
  total_lowest_price?: number;
  original_lowest_price?: number;
  final_lowest_price?: number;
  discount_percent?: number;
  applied_promo_code?: string;
  promo_description?: string;
  recommendation_score?: number;
};

type SearchTab = "basic" | "promotions" | "recommend";
type ResultFilter = "direct" | "all" | "connections";
type SeatClass = "Economy" | "Business" | "First";

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

const QUICK_PROMOS = ["SUMMER10", "BUSINESS15", "ICNUSA20", "ASIA12"];

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

function filterRoutes(routes: RouteRow[], filter: ResultFilter, isPromotionTab: boolean) {
  if (isPromotionTab) return routes;
  if (filter === "direct") return routes.filter((row) => row.route_type !== "ONE_STOP");
  if (filter === "connections") return routes.filter((row) => row.route_type === "ONE_STOP");
  return routes;
}

function flightIdOf(row: RouteRow) {
  return row.first_flight_id ?? row.flight_id ?? "";
}

export default function HomePage() {
  const resultsRef = useRef<HTMLElement>(null);
  const [tab, setTab] = useState<SearchTab>("basic");
  const [form, setForm] = useState({
    dep_airport: "ICN",
    arr_airport: "JFK",
    flight_date: "2026-06-10",
    class_name: "Economy" as SeatClass,
    max_price: "",
    promo_code: "SUMMER10"
  });
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [recommended, setRecommended] = useState<RouteRow[]>([]);
  const [exploreDeals, setExploreDeals] = useState<ExploreDeal[]>(
    POPULAR_FROM_ICN.map((d) => ({ ...d, topRoute: null, loading: true }))
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [sessionUser, setSessionUser] = useState<{ role: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const visibleRoutes = filterRoutes(routes, resultFilter, tab === "promotions");

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
      flight_date: date,
      class_name: className
    });
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

  async function runSearch(nextTab = tab, scrollToResults = true, overrides?: Partial<typeof form>) {
    const activeForm = { ...form, ...overrides };
    setLoading(true);
    setError("");
    setHasSearched(true);

    const params = new URLSearchParams({
      dep_airport: activeForm.dep_airport,
      arr_airport: activeForm.arr_airport,
      flight_date: activeForm.flight_date,
      class_name: activeForm.class_name
    });
    if (activeForm.max_price) params.set("max_price", activeForm.max_price);
    if (nextTab === "promotions" && activeForm.promo_code) params.set("promo_code", activeForm.promo_code.trim().toUpperCase());

    const endpoint =
      nextTab === "basic"
        ? "/api/flights/search/connecting"
        : nextTab === "promotions"
          ? "/api/flights/search/promotions"
          : "/api/flights/recommend";

    try {
      const response = await fetch(`${endpoint}?${params}`);
      const json = await response.json();
      if (!response.ok || !json.success) {
        setError(json.message ?? "An error occurred while searching.");
        setRoutes([]);
        return;
      }
      setRoutes(json.data?.routes ?? []);
      setResultFilter("all");
      if (scrollToResults) {
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch {
      setError("An error occurred while searching.");
      setRoutes([]);
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
    setForm((prev) => ({ ...prev, arr_airport: arr }));
    setTab("basic");
    void runSearch("basic", true, { arr_airport: arr });
  }

  function applyPromo(code: string) {
    setForm((prev) => ({ ...prev, promo_code: code }));
    setTab("promotions");
    void runSearch("promotions", true, { promo_code: code });
  }

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
              tab={tab}
              form={form}
              loading={loading}
              quickPromos={QUICK_PROMOS}
              onTabChange={setTab}
              onFormChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              onSubmit={submit}
              onSwapAirports={swapAirports}
              onApplyPromo={applyPromo}
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
                    score={deal.topRoute?.recommendation_score}
                    badge={
                      deal.topRoute?.discount_percent
                        ? `-${deal.topRoute.discount_percent}%`
                        : deal.topRoute?.route_type === "DIRECT"
                          ? "Direct"
                          : deal.topRoute
                            ? "1 stop"
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
                    setTab("recommend");
                    void runSearch("recommend");
                  }}
                >
                  View all smart picks
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
                            {row.first_flight_number ?? row.flight_number}
                            {row.second_flight_number ? ` + ${row.second_flight_number}` : ""} · {row.available_seats} seats left
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xl font-bold tabular-nums text-zinc-900">${priceOf(row).toLocaleString("en-US")}</p>
                          <p className="text-xs text-zinc-500">{row.recommendation_score ?? "—"} score</p>
                        </div>
                        <Link href={seatHref(row)}>
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
        <section ref={resultsRef} className="scroll-mt-24 border-t border-zinc-100 bg-zinc-50/50 px-5 py-16 sm:px-8">
          <div className="mx-auto max-w-[1120px]">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Results</p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900">
                  {form.dep_airport} → {form.arr_airport}
                </h2>
                <p className="mt-1 text-zinc-500">
                  {form.flight_date} · {form.class_name} · {routes.length} result{routes.length === 1 ? "" : "s"}
                </p>
              </div>
              <Button variant="ghost" onClick={() => setHasSearched(false)}>
                ← Back to explore
              </Button>
            </div>

            {routes.length > 0 && tab !== "promotions" && (
              <div className="mb-6 flex flex-wrap gap-2">
                {(
                  [
                    ["all", "All"],
                    ["direct", "Direct only"],
                    ["connections", "1+ stops"]
                  ] as const
                ).map(([key, label]) => {
                  const count =
                    key === "direct"
                      ? routes.filter((r) => r.route_type !== "ONE_STOP").length
                      : key === "connections"
                        ? routes.filter((r) => r.route_type === "ONE_STOP").length
                        : routes.length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setResultFilter(key)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-semibold transition",
                        resultFilter === key
                          ? "bg-deep-space-blue text-white shadow-sm"
                          : "border border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
                      )}
                    >
                      {label} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 lg:col-span-2">{error}</div>
              )}
              {!error && !loading && routes.length === 0 && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-8 text-center text-zinc-500 lg:col-span-2">
                  {tab === "promotions"
                    ? "No flights match this promotion code."
                    : "No flights found. Try another date or destination."}
                </div>
              )}
              {!error && !loading && routes.length > 0 && visibleRoutes.length === 0 && (
                <div className="rounded-2xl border border-zinc-100 bg-white p-8 text-center text-zinc-500 lg:col-span-2">
                  No flights match this filter. Try &quot;All&quot; or another tab.
                </div>
              )}
              {visibleRoutes.map((row, index) => (
                <FlightResultCard key={`${flightIdOf(row)}-${index}`} row={row} index={index} />
              ))}
            </div>
          </div>
        </section>
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
