"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/cn";

const PAGE_SIZE = 10;

type SortDirection = "asc" | "desc";

function compareValues(a: unknown, b: unknown): number {
  const sa = String(a ?? "");
  const sb = String(b ?? "");
  const na = Number(a);
  const nb = Number(b);
  if (sa !== "" && sb !== "" && !Number.isNaN(na) && !Number.isNaN(nb)) {
    return na - nb;
  }
  return sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
}

function rowMatchesQuery(row: Record<string, unknown>, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q));
}

type Props = {
  rows: Record<string, unknown>[];
  emptyMessage?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  selectedRowKey?: string | number | null;
  rowKeyColumn?: string;
  getRowKey?: (row: Record<string, unknown>) => string;
};

export default function ReportDataTable({
  rows,
  emptyMessage = "No rows match your search.",
  onRowClick,
  selectedRowKey = null,
  rowKeyColumn = "booking_id",
  getRowKey
}: Props) {
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);

  const columns = rows.length ? Object.keys(rows[0]) : [];

  const filteredRows = useMemo(() => {
    return rows.filter((row) => rowMatchesQuery(row, search));
  }, [rows, search]);

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const cmp = compareValues(a[sortColumn], b[sortColumn]);
      return sortDirection === "asc" ? cmp : -cmp;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sortedRows.slice(start, start + PAGE_SIZE);
  }, [sortedRows, safePage]);

  const rangeStart = sortedRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(safePage * PAGE_SIZE, sortedRows.length);

  function handleSort(column: string) {
    setPage(1);
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
      return;
    }
    setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    setPage(1);
  }

  function resolveRowKey(row: Record<string, unknown>) {
    if (getRowKey) return getRowKey(row);
    return String(row[rowKeyColumn] ?? "");
  }

  if (columns.length === 0) {
    return <p className="text-sm text-zinc-500">No report data available.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search all columns…"
            className="w-full rounded-xl border border-zinc-200 py-2 pl-10 pr-3 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <p className="text-sm text-zinc-500">
          {sortedRows.length === 0
            ? "0 results"
            : `Showing ${rangeStart}–${rangeEnd} of ${sortedRows.length}${search ? ` (filtered from ${rows.length})` : ""}`}
        </p>
      </div>

      <div className="overflow-auto rounded-xl border border-zinc-100">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50 text-left text-zinc-600">
              {columns.map((column) => {
                const isActive = sortColumn === column;
                return (
                  <th key={column} className="border border-zinc-200 px-3 py-2 font-semibold">
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className="inline-flex items-center gap-1.5 hover:text-zinc-900"
                    >
                      <span>{column}</span>
                      {isActive ? (
                        sortDirection === "asc" ? (
                          <ArrowUp className="size-3.5 shrink-0" />
                        ) : (
                          <ArrowDown className="size-3.5 shrink-0" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3.5 shrink-0 opacity-40" />
                      )}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border border-zinc-200 px-3 py-8 text-center text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIndex) => {
                const rowKey = resolveRowKey(row);
                const isSelected = selectedRowKey != null && String(selectedRowKey) === rowKey;
                return (
                <tr
                  key={`${safePage}-${rowIndex}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "hover:bg-zinc-50",
                    onRowClick && "cursor-pointer",
                    isSelected && "bg-sky-50 hover:bg-sky-50"
                  )}
                >
                  {columns.map((column) => (
                    <td key={column} className="border border-zinc-200 px-3 py-2 text-zinc-800">
                      {String(row[column] ?? "")}
                    </td>
                  ))}
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>

      {sortedRows.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-500">
            Page {safePage} of {totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium",
                safePage <= 1
                  ? "cursor-not-allowed border-zinc-100 text-zinc-300"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              )}
            >
              <ChevronLeft className="size-4" />
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .map((n, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev != null && n - prev > 1;
                return (
                  <span key={n} className="flex items-center gap-1">
                    {showEllipsis && <span className="px-1 text-zinc-400">…</span>}
                    <button
                      type="button"
                      onClick={() => setPage(n)}
                      className={cn(
                        "min-w-9 rounded-lg border px-2 py-1.5 text-sm font-medium",
                        n === safePage
                          ? "border-navy bg-navy text-white"
                          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                      )}
                    >
                      {n}
                    </button>
                  </span>
                );
              })}
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium",
                safePage >= totalPages
                  ? "cursor-not-allowed border-zinc-100 text-zinc-300"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50"
              )}
            >
              Next
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}