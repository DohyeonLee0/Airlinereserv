"use client";

import { useEffect, useState } from "react";
import { CalendarRange } from "lucide-react";
import ReportDataTable from "@/app/components/dashboard/ReportDataTable";
import ScheduleTrackerDetail, { trackerRowKey, type TrackerView } from "@/app/components/dashboard/ScheduleTrackerDetail";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import EnglishDateInput from "@/app/components/ui/EnglishDateInput";

const VIEW_LABELS: Record<TrackerView, string> = {
  legs: "Schedule Legs",
  itineraries: "Itineraries",
  flights: "Dated Flights"
};

const VIEW_DESCRIPTIONS: Record<TrackerView, string> = {
  legs: "Recurring legs whose validity overlaps the date range, or with generated flights in that range.",
  itineraries: "Itineraries with flights in the date range, or linked legs valid during that period.",
  flights: "Dated flights whose flight_date falls within the selected range."
};

type DateFilter = {
  startDate: string;
  endDate: string;
};

const EMPTY_DATE_FILTER: DateFilter = { startDate: "", endDate: "" };

function buildTrackerUrl(view: TrackerView, dateFilter: DateFilter) {
  const params = new URLSearchParams({ view });
  if (dateFilter.startDate) params.set("start_date", dateFilter.startDate);
  if (dateFilter.endDate) params.set("end_date", dateFilter.endDate);
  return `/api/staff/schedules/tracker?${params.toString()}`;
}

export default function ScheduleTrackerPage() {
  const [view, setView] = useState<TrackerView>("legs");
  const [dateDraft, setDateDraft] = useState<DateFilter>({ ...EMPTY_DATE_FILTER });
  const [dateFilter, setDateFilter] = useState<DateFilter>({ ...EMPTY_DATE_FILTER });
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);

  async function loadTracker(nextView = view, nextDateFilter = dateFilter) {
    setLoading(true);
    const response = await fetch(buildTrackerUrl(nextView, nextDateFilter));
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.message ?? "Failed to load schedule tracker data.");
      setRows([]);
    } else {
      setMessage("");
      setRows((json.data?.rows ?? []) as Record<string, unknown>[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    setSelectedRow(null);
    setSelectedRowKey(null);
    void loadTracker(view, dateFilter);
  }, [view, dateFilter]);

  function handleRowClick(row: Record<string, unknown>) {
    const key = trackerRowKey(view, row);
    if (selectedRowKey === key) {
      setSelectedRow(null);
      setSelectedRowKey(null);
      return;
    }
    setSelectedRow(row);
    setSelectedRowKey(key);
  }

  function applyDateFilter() {
    if (dateDraft.startDate && dateDraft.endDate && dateDraft.startDate > dateDraft.endDate) {
      setMessage("Start date must be on or before end date.");
      return;
    }
    setMessage("");
    setDateFilter({ ...dateDraft });
  }

  function clearDateFilter() {
    setDateDraft({ ...EMPTY_DATE_FILTER });
    setDateFilter({ ...EMPTY_DATE_FILTER });
  }

  const dateFilterActive = Boolean(dateFilter.startDate || dateFilter.endDate);

  return (
    <div className="space-y-8">
      <PageTitle
        icon={CalendarRange}
        title="Schedule Tracker"
        description="Read-only view of schedule legs, itineraries, and dated flights. Filter by date range to see what is active or operating."
        accent="sky"
      />

      {message ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>
      ) : null}

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
        <div className="mb-4 rounded-xl border border-sky-100 bg-sky-50/40 p-4" lang="en">
          <p className="text-sm font-semibold text-navy">Date range</p>
          <p className="mt-1 text-xs text-zinc-600">
            Leave blank to show all records. Use one or both dates — e.g. start date only shows everything from that day onward.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">Start date</span>
              <EnglishDateInput
                value={dateDraft.startDate}
                onChange={(value) => setDateDraft((prev) => ({ ...prev, startDate: value }))}
                className="w-44"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-zinc-600">End date</span>
              <EnglishDateInput
                value={dateDraft.endDate}
                onChange={(value) => setDateDraft((prev) => ({ ...prev, endDate: value }))}
                min={dateDraft.startDate || undefined}
                className="w-44"
              />
            </label>
            <button
              type="button"
              onClick={applyDateFilter}
              className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90"
            >
              Apply dates
            </button>
            {dateFilterActive ? (
              <button
                type="button"
                onClick={clearDateFilter}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Clear dates
              </button>
            ) : null}
          </div>
          {dateFilterActive ? (
            <p className="mt-3 text-xs text-zinc-600">
              Active filter:{" "}
              <span className="font-medium text-zinc-800">
                {dateFilter.startDate || "any start"} — {dateFilter.endDate || "any end"}
              </span>
            </p>
          ) : null}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.entries(VIEW_LABELS) as [TrackerView, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                view === key
                  ? "border-navy bg-navy text-white"
                  : "border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mb-4 text-sm text-zinc-500">{VIEW_DESCRIPTIONS[view]}</p>
        <p className="mb-4 text-sm text-zinc-500">Click any row to open the detail panel below.</p>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-10 w-full max-w-sm rounded-xl bg-zinc-200" />
            <div className="h-64 rounded-xl bg-zinc-100" />
          </div>
        ) : (
          <ReportDataTable
            key={`${view}-${dateFilter.startDate}-${dateFilter.endDate}`}
            rows={rows}
            onRowClick={handleRowClick}
            selectedRowKey={selectedRowKey}
            getRowKey={(row) => trackerRowKey(view, row)}
            emptyMessage={dateFilterActive ? "No records match the selected date range." : "No schedule data found."}
          />
        )}
      </section>

      {selectedRow && selectedRowKey ? (
        <ScheduleTrackerDetail
          view={view}
          row={selectedRow}
          rowKey={selectedRowKey}
          onClose={() => {
            setSelectedRow(null);
            setSelectedRowKey(null);
          }}
        />
      ) : null}
    </div>
  );
}
