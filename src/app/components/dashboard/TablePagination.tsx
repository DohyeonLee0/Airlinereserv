"use client";

import Button from "@/app/components/ui/Button";
import { cn } from "@/lib/cn";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function TablePagination({
  page,
  totalPages,
  rangeStart,
  rangeEnd,
  totalItems,
  onPageChange,
  className
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-sm",
        totalPages <= 1 && "justify-center",
        className
      )}
    >
      <p className="text-zinc-600">
        {rangeStart}–{rangeEnd} of {totalItems}
      </p>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="tabular-nums text-zinc-600">
            Page {page} of {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    rangeStart: rows.length === 0 ? 0 : startIndex + 1,
    rangeEnd: Math.min(startIndex + pageSize, rows.length),
    visibleRows: rows.slice(startIndex, startIndex + pageSize)
  };
}
