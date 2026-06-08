"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type StaffConfirmState = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "warning";
};

type StaffConfirmModalProps = {
  confirm: StaffConfirmState | null;
  isPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function StaffConfirmModal({ confirm, isPending = false, onConfirm, onCancel }: StaffConfirmModalProps) {
  useEffect(() => {
    if (!confirm) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirm, isPending, onCancel]);

  if (!confirm) return null;

  const tone = confirm.tone ?? "danger";
  const headerClass = tone === "danger" ? "border-red-100 bg-red-50/80" : "border-amber-100 bg-amber-50/80";
  const iconClass = tone === "danger" ? "text-red-600" : "text-amber-600";
  const confirmButtonClass =
    tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : "bg-navy text-white hover:bg-navy/90";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[1px]"
        onClick={() => {
          if (!isPending) onCancel();
        }}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="staff-confirm-title"
        aria-describedby="staff-confirm-message"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xl"
      >
        <div className={cn("border-b px-5 py-4", headerClass)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn("mt-0.5 size-5 shrink-0", iconClass)} />
              <h2 id="staff-confirm-title" className="text-lg font-semibold text-zinc-900">
                {confirm.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={isPending}
              className="rounded-lg p-1 text-zinc-500 transition hover:bg-white hover:text-zinc-800 disabled:opacity-50"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <p id="staff-confirm-message" className="text-sm leading-relaxed text-zinc-700">
            {confirm.message}
          </p>
        </div>

        <div className="flex gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            {confirm.cancelLabel ?? "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className={cn(
              "flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-50",
              confirmButtonClass
            )}
          >
            {isPending ? "Deleting…" : (confirm.confirmLabel ?? "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
