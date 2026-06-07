"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import ReportDataTable from "@/app/components/dashboard/ReportDataTable";
import ReportRowDetail, { reportRowKey } from "@/app/components/dashboard/ReportRowDetail";
import { PageTitle } from "@/app/components/dashboard/PageTitle";

type ReportKey =
  | "revenue-flight"
  | "revenue-month"
  | "revenue-quarter"
  | "load-factor"
  | "revenue-route"
  | "revenue-class";

const REPORT_LABELS: Record<ReportKey, string> = {
  "revenue-flight": "Revenue by Flight",
  "revenue-month": "Revenue by Month",
  "revenue-quarter": "Revenue by Quarter",
  "load-factor": "Load Factor",
  "revenue-route": "Revenue by Route",
  "revenue-class": "Revenue by Seat Class"
};

export default function ReportsPage() {
  const [reportKey, setReportKey] = useState<ReportKey>("load-factor");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  async function loadReport(key = reportKey) {
    setLoading(true);
    const response = await fetch(`/api/staff/reports/${key}`);
    const json = await response.json();
    setRows(json.data?.rows ?? []);
    if (!response.ok) setMessage(json.message ?? "Failed to load report");
    else setMessage("");
    setLoading(false);
  }

  useEffect(() => {
    setSelectedRow(null);
    setSelectedRowKey(null);
    loadReport(reportKey);
  }, [reportKey]);

  function handleRowClick(row: Record<string, unknown>) {
    const key = reportRowKey(reportKey, row);
    if (selectedRowKey === key) {
      setSelectedRow(null);
      setSelectedRowKey(null);
      return;
    }
    setSelectedRow(row);
    setSelectedRowKey(key);
  }

  return (
    <div className="space-y-8">
      <PageTitle icon={BarChart3} title="Reports" description="Revenue, load factor, route, and seat-class analytics from stored procedures." accent="violet" />

      {message && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-wrap gap-2">
          {(Object.entries(REPORT_LABELS) as [ReportKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setReportKey(key)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                reportKey === key ? "border-navy bg-navy text-white" : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-zinc-500">Click any row to view the full detail breakdown below.</p>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 w-full max-w-sm rounded-xl bg-zinc-200" />
            <div className="h-64 rounded-xl bg-zinc-100" />
          </div>
        ) : (
          <ReportDataTable
            key={reportKey}
            rows={rows}
            onRowClick={handleRowClick}
            selectedRowKey={selectedRowKey}
            getRowKey={(row) => reportRowKey(reportKey, row)}
            emptyMessage="No report data available."
          />
        )}
      </section>

      {selectedRow && selectedRowKey ? (
        <ReportRowDetail reportKey={reportKey} row={selectedRow} onClose={() => { setSelectedRow(null); setSelectedRowKey(null); }} />
      ) : null}
    </div>
  );
}
