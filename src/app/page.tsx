"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useLocale } from "@/lib/useLocale";

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

const copy = {
  ko: {
    welcome: "환영합니다",
    title: "항공권 검색",
    recommended: "강력 추천 Top 5",
    score: "점",
    tabs: {
      basic: "일반 검색",
      promotions: "프로모션 코드",
      recommend: "추천 경로 검색"
    },
    dep: "출발 공항",
    arr: "도착 공항",
    date: "출발일",
    seatClass: "좌석 등급",
    maxPrice: "최대 가격",
    promoCode: "프로모션 코드",
    promoHint: "예: SUMMER10, BUSINESS15, ICNUSA20, ASIA12",
    search: "검색",
    searching: "검색 중",
    seatsLeft: "잔여 좌석",
    chooseSeat: "좌석 선택",
    noResults: "검색 결과가 없습니다. ICN → JFK, 2026-06-01, 이코노미 조건으로 먼저 확인해 보세요.",
    promoNoResults: "해당 프로모션 코드가 적용되는 항공편이 없습니다.",
    error: "검색 중 오류가 발생했습니다.",
    discount: "할인",
    original: "정가",
    filters: {
      direct: "직항만",
      all: "경유 포함",
      connections: "경유만"
    },
    classes: {
      Economy: "이코노미",
      Business: "비즈니스",
      First: "퍼스트"
    }
  },
  en: {
    welcome: "Welcome",
    title: "Flight Search",
    recommended: "Top 5 Recommended Routes",
    score: "pts",
    tabs: {
      basic: "Basic Search",
      promotions: "Promotion Code",
      recommend: "Recommended Routes"
    },
    dep: "Departure Airport",
    arr: "Arrival Airport",
    date: "Flight Date",
    seatClass: "Seat Class",
    maxPrice: "Max Price",
    promoCode: "Promotion Code",
    promoHint: "Try SUMMER10, BUSINESS15, ICNUSA20, ASIA12",
    search: "Search",
    searching: "Searching",
    seatsLeft: "Seats left",
    chooseSeat: "Choose Seat",
    noResults: "No flights found. Try ICN → JFK, 2026-06-01, Economy first.",
    promoNoResults: "No flights match this promotion code.",
    error: "An error occurred while searching.",
    discount: "Discount",
    original: "Original",
    filters: {
      direct: "Direct Only",
      all: "Include Connections",
      connections: "Connections Only"
    },
    classes: {
      Economy: "Economy",
      Business: "Business",
      First: "First"
    }
  }
};

function priceOf(row: RouteRow) {
  return row.final_lowest_price ?? row.total_lowest_price ?? row.lowest_price ?? row.lowest_available_price ?? 0;
}

function flightIdOf(row: RouteRow) {
  return row.first_flight_id ?? row.flight_id ?? "";
}

function seatHref(row: RouteRow) {
  const first = row.first_flight_id ?? row.flight_id;
  if (row.route_type === "ONE_STOP" && first && row.second_flight_id) {
    return `/seats?flight_ids=${first},${row.second_flight_id}`;
  }
  return `/seats?flight_id=${first ?? ""}`;
}

function filterRoutes(routes: RouteRow[], filter: ResultFilter, isPromotionTab: boolean) {
  if (isPromotionTab) return routes;
  if (filter === "direct") return routes.filter((row) => row.route_type !== "ONE_STOP");
  if (filter === "connections") return routes.filter((row) => row.route_type === "ONE_STOP");
  return routes;
}

export default function HomePage() {
  const { locale } = useLocale();
  const t = copy[locale];
  const [tab, setTab] = useState<SearchTab>("basic");
  const [form, setForm] = useState({
    dep_airport: "ICN",
    arr_airport: "JFK",
    flight_date: "2026-06-01",
    class_name: "Economy" as SeatClass,
    max_price: "",
    promo_code: "SUMMER10"
  });
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [resultFilter, setResultFilter] = useState<ResultFilter>("all");
  const [recommended, setRecommended] = useState<RouteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState("Customer Demo");
  const [error, setError] = useState("");
  const visibleRoutes = filterRoutes(routes, resultFilter, tab === "promotions");

  useEffect(() => {
    fetch("/api/customers/profiles")
      .then((res) => res.json())
      .then((json) => setProfile(json.data?.customers?.[0]?.full_name ?? "Customer Demo"))
      .catch(() => setProfile("Customer Demo"));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      dep_airport: form.dep_airport,
      arr_airport: form.arr_airport,
      flight_date: form.flight_date,
      class_name: form.class_name
    });
    fetch(`/api/flights/recommend?${params}`)
      .then((res) => res.json())
      .then((json) => setRecommended(json.data?.routes ?? []))
      .catch(() => setRecommended([]));
  }, [form.dep_airport, form.arr_airport, form.flight_date, form.class_name]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      dep_airport: form.dep_airport,
      arr_airport: form.arr_airport,
      flight_date: form.flight_date,
      class_name: form.class_name
    });
    if (form.max_price) params.set("max_price", form.max_price);
    if (tab === "promotions" && form.promo_code) params.set("promo_code", form.promo_code.trim().toUpperCase());

    const endpoint =
      tab === "basic"
        ? "/api/flights/search/connecting"
        : tab === "promotions"
          ? "/api/flights/search/promotions"
          : "/api/flights/recommend";

    try {
      const response = await fetch(`${endpoint}?${params}`);
      const json = await response.json();
      if (!response.ok || !json.success) {
        setError(json.message ?? t.error);
        setRoutes([]);
        return;
      }
      setRoutes(json.data?.routes ?? []);
      setResultFilter("all");
    } catch {
      setError(t.error);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {t.welcome}, {profile}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-navy">{t.title}</h1>
        </div>
        <div className="rounded border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-navy">{t.recommended}</p>
          <div className="mt-3 space-y-2">
            {recommended.slice(0, 5).map((row, index) => (
              <div key={`${row.first_flight_id}-${index}`} className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
                <span>
                  {row.dep_airport} → {row.connection_airport ? `${row.connection_airport} → ` : ""}
                  {row.arr_airport}
                </span>
                <span className="font-semibold text-navy">
                  {row.recommendation_score ?? "-"} {t.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <form onSubmit={submit} className="rounded border border-slate-200 bg-white p-5">
        <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          {(Object.keys(t.tabs) as SearchTab[]).map((key) => (
            <button
              type="button"
              key={key}
              onClick={() => setTab(key)}
              className={`rounded border px-4 py-2 text-sm font-semibold ${
                tab === key ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              {t.tabs[key]}
            </button>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-6">
          <label className="text-sm font-medium text-slate-700">
            {t.dep}
            <input
              value={form.dep_airport}
              onChange={(event) => setForm((prev) => ({ ...prev, dep_airport: event.target.value.toUpperCase() }))}
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-navy"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t.arr}
            <input
              value={form.arr_airport}
              onChange={(event) => setForm((prev) => ({ ...prev, arr_airport: event.target.value.toUpperCase() }))}
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-navy"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t.date}
            <input
              type="date"
              value={form.flight_date}
              onChange={(event) => setForm((prev) => ({ ...prev, flight_date: event.target.value }))}
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-navy"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t.seatClass}
            <select
              value={form.class_name}
              onChange={(event) => setForm((prev) => ({ ...prev, class_name: event.target.value as SeatClass }))}
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-navy"
            >
              {(["Economy", "Business", "First"] as SeatClass[]).map((seatClass) => (
                <option key={seatClass} value={seatClass}>
                  {t.classes[seatClass]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-700">
            {t.maxPrice}
            <input
              type="number"
              value={form.max_price}
              onChange={(event) => setForm((prev) => ({ ...prev, max_price: event.target.value }))}
              className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-navy"
            />
          </label>
          {tab === "promotions" && (
            <label className="text-sm font-medium text-slate-700">
              {t.promoCode}
              <input
                value={form.promo_code}
                onChange={(event) => setForm((prev) => ({ ...prev, promo_code: event.target.value.toUpperCase() }))}
                placeholder="SUMMER10"
                className="mt-2 w-full rounded border border-slate-300 px-3 py-2 outline-none focus:border-navy"
              />
            </label>
          )}
        </div>
        {tab === "promotions" && <p className="mt-3 text-xs text-slate-500">{t.promoHint}</p>}
        <button className="mt-5 rounded bg-navy px-5 py-2.5 text-sm font-semibold text-white" disabled={loading}>
          {loading ? t.searching : t.search}
        </button>
      </form>

      {routes.length > 0 && tab !== "promotions" && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(t.filters) as ResultFilter[]).map((key) => {
            const count =
              key === "direct"
                ? routes.filter((row) => row.route_type !== "ONE_STOP").length
                : key === "connections"
                  ? routes.filter((row) => row.route_type === "ONE_STOP").length
                  : routes.length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setResultFilter(key)}
                className={`rounded border px-4 py-2 text-sm font-semibold ${
                  resultFilter === key ? "border-navy bg-navy text-white" : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {t.filters[key]} ({count})
              </button>
            );
          })}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2">
        {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700 md:col-span-2">{error}</div>}
        {!error && !loading && routes.length === 0 && (
          <div className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-600 md:col-span-2">
            {tab === "promotions" ? t.promoNoResults : t.noResults}
          </div>
        )}
        {!error && !loading && routes.length > 0 && visibleRoutes.length === 0 && (
          <div className="rounded border border-slate-200 bg-white p-5 text-sm text-slate-600 md:col-span-2">
            {t.noResults}
          </div>
        )}
        {visibleRoutes.map((row, index) => (
          <article key={`${flightIdOf(row)}-${index}`} className="rounded border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-600">
                  {row.applied_promo_code ?? (row.route_type === "ONE_STOP" ? "ONE STOP" : "DIRECT")}
                </span>
                <h2 className="mt-3 text-xl font-semibold text-navy">
                  {row.dep_airport} → {row.connection_airport ? `${row.connection_airport} → ` : ""}
                  {row.arr_airport}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {row.first_flight_number ?? row.flight_number ?? "Flight"} {row.second_flight_number ? `+ ${row.second_flight_number}` : ""}
                </p>
                {row.promo_description && <p className="mt-2 text-sm text-emerald-700">{row.promo_description}</p>}
              </div>
              <div className="text-right">
                {row.original_lowest_price && row.final_lowest_price && (
                  <p className="text-xs text-slate-400 line-through">
                    {t.original}: ${row.original_lowest_price.toLocaleString()}
                  </p>
                )}
                <p className="text-lg font-semibold text-navy">${priceOf(row).toLocaleString()}</p>
                {row.discount_percent ? (
                  <p className="text-xs font-semibold text-emerald-700">
                    {t.discount} {row.discount_percent}%
                  </p>
                ) : null}
                <p className="text-xs text-slate-500">
                  {t.seatsLeft}: {row.available_seats}
                </p>
              </div>
            </div>
            <Link
              className="mt-5 inline-block rounded border border-navy px-4 py-2 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
              href={seatHref(row)}
            >
              {t.chooseSeat}
            </Link>
          </article>
        ))}
      </section>
    </div>
  );
}
