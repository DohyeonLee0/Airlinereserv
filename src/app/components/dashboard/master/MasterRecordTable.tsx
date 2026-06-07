"use client";

import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Column<T> = {
  key: keyof T | string;
  label: string;
  render?: (row: T) => string;
};

export default function MasterRecordTable<T extends Record<string, unknown>>({
  rows,
  columns,
  rowKey,
  selectedKey,
  onSelect,
  onDelete,
  emptyMessage = "No records yet."
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  selectedKey?: string | null;
  onSelect?: (row: T) => void;
  onDelete?: (row: T) => void;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-10 text-center text-sm text-zinc-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-xl border border-zinc-100">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="bg-zinc-50 text-left text-zinc-600">
            {columns.map((col) => (
              <th key={String(col.key)} className="border border-zinc-200 px-3 py-2 font-semibold">
                {col.label}
              </th>
            ))}
            {onSelect || onDelete ? (
              <th className="border border-zinc-200 px-3 py-2 font-semibold w-28">Actions</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = rowKey(row);
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                className={cn("hover:bg-zinc-50", selected && "bg-sky-50", onSelect && "cursor-pointer")}
                onClick={onSelect ? () => onSelect(row) : undefined}
              >
                {columns.map((col) => {
                  const raw = row[col.key as keyof T];
                  const text = col.render ? col.render(row) : String(raw ?? "—");
                  return (
                    <td key={String(col.key)} className="border border-zinc-200 px-3 py-2 text-zinc-800">
                      {text}
                    </td>
                  );
                })}
                {onSelect || onDelete ? (
                  <td className="border border-zinc-200 px-3 py-2">
                    <div className="flex items-center gap-1">
                      {onSelect ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(row);
                          }}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-navy"
                          aria-label="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                      {onDelete ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(row);
                          }}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
