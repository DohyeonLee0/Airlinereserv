"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocale } from "@/lib/useLocale";

type ReportKey = "revenue-flight" | "revenue-month" | "load-factor" | "revenue-route" | "revenue-class";

const copy = {
  ko: {
    title: "직원 포털",
    subtitle: "저장 프로시저 기반 항공편 생성, 좌석 배포, 매출 및 탑승률 통계",
    generateTab: "1. 항공편/좌석 자동 생성",
    reportsTab: "2. 통계 그리드",
    generateFlights: "항공편 자동 생성",
    generateSeats: "좌석 및 가격 배포",
    runGenerate: "생성 실행",
    runSeats: "좌석 생성",
    success: "처리가 완료되었습니다.",
    error: "처리 중 오류가 발생했습니다.",
    reportError: "리포트 조회 중 오류가 발생했습니다.",
    reports: {
      "revenue-flight": "항공편별 매출",
      "revenue-month": "월별 매출",
      "load-factor": "탑승률",
      "revenue-route": "노선별 순위",
      "revenue-class": "좌석 등급별 비율"
    }
  },
  en: {
    title: "Staff Portal",
    subtitle: "Stored procedure based flight generation, seat distribution, revenue, and load factor reports",
    generateTab: "1. Flight and Seat Generation",
    reportsTab: "2. Report Grid",
    generateFlights: "Generate Flights",
    generateSeats: "Generate Seats and Prices",
    runGenerate: "Run Generation",
    runSeats: "Generate Seats",
    success: "Completed successfully.",
    error: "An error occurred while processing.",
    reportError: "An error occurred while loading the report.",
    reports: {
      "revenue-flight": "Revenue by Flight",
      "revenue-month": "Revenue by Month",
      "load-factor": "Load Factor",
      "revenue-route": "Revenue by Route",
      "revenue-class": "Revenue by Seat Class"
    }
  }
};

export default function DashboardPage() {
  const { locale } = useLocale();
  const t = copy[locale];
  const [tab, setTab] = useState<"generate" | "reports">("generate");
  const [reportKey, setReportKey] = useState<ReportKey>("load-factor");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [flightForm, setFlightForm] = useState({
    schedule_id: "1",
    aircraft_id: "101",
    start_date: "2026-06-01",
    end_date: "2026-06-30",
    trip_type_id: "1"
  });
  const [seatForm, setSeatForm] = useState({
    flight_id: "1001",
    economy_price: "780",
    business_price: "2400",
    first_price: "5200"
  });

  async function loadReport(key = reportKey) {
    const response = await fetch(`/api/staff/reports/${key}`);
    const json = await response.json();
    setRows(json.data?.rows ?? []);
    if (!response.ok) setMessage(json.message ?? t.reportError);
  }

  useEffect(() => {
    loadReport(reportKey);
  }, [reportKey]);

  async function postForm(event: FormEvent, endpoint: string, body: Record<string, string>) {
    event.preventDefault();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    setMessage(response.ok ? t.success : json.message ?? t.error);
  }

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold text-navy">{t.title}</h1>
        <p className="mt-2 text-sm text-slate-600">{t.subtitle}</p>
      </section>

      <div className="flex gap-2 border-b border-slate-200">
        {[
          ["generate", t.generateTab],
          ["reports", t.reportsTab]
        ].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key as "generate" | "reports")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold ${
              tab === key ? "border-navy text-navy" : "border-transparent text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && <div className="rounded border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{message}</div>}

      {tab === "generate" ? (
        <section className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={(event) => postForm(event, "/api/staff/flights/generate", flightForm)}
            className="rounded border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-navy">{t.generateFlights}</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {Object.keys(flightForm).map((key) => (
                <label key={key} className="text-sm font-medium text-slate-700">
                  {key}
                  <input
                    type={key.includes("date") ? "date" : "text"}
                    value={flightForm[key as keyof typeof flightForm]}
                    onChange={(event) => setFlightForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
              ))}
            </div>
            <button className="mt-5 rounded bg-navy px-4 py-2 text-sm font-semibold text-white">{t.runGenerate}</button>
          </form>

          <form
            onSubmit={(event) => postForm(event, "/api/staff/flights/seats-generate", seatForm)}
            className="rounded border border-slate-200 bg-white p-5"
          >
            <h2 className="text-lg font-semibold text-navy">{t.generateSeats}</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {Object.keys(seatForm).map((key) => (
                <label key={key} className="text-sm font-medium text-slate-700">
                  {key}
                  <input
                    value={seatForm[key as keyof typeof seatForm]}
                    onChange={(event) => setSeatForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
              ))}
            </div>
            <button className="mt-5 rounded bg-navy px-4 py-2 text-sm font-semibold text-white">{t.runSeats}</button>
          </form>
        </section>
      ) : (
        <section className="rounded border border-slate-200 bg-white p-5">
          <div className="mb-5 flex flex-wrap gap-2">
            {(Object.keys(t.reports) as ReportKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setReportKey(key)}
                className={`rounded border px-3 py-2 text-sm font-semibold ${
                  reportKey === key ? "border-navy bg-navy text-white" : "border-slate-200 text-slate-700"
                }`}
              >
                {t.reports[key]}
              </button>
            ))}
          </div>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-slate-600">
                  {columns.map((column) => (
                    <th key={column} className="border border-slate-200 px-3 py-2 font-semibold">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-slate-50">
                    {columns.map((column) => (
                      <td key={column} className="border border-slate-200 px-3 py-2">
                        {String(row[column] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
