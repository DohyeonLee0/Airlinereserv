"use client";

import { useEffect } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type StaffAlertVariant = "error" | "warning" | "success" | "info";

export type StaffAlertState = {
  title?: string;
  message: string;
  variant: StaffAlertVariant;
};

type StaffAlertModalProps = {
  alert: StaffAlertState | null;
  onClose: () => void;
};

const VARIANT_STYLES: Record<
  StaffAlertVariant,
  { header: string; icon: typeof AlertCircle; iconColor: string; defaultTitle: string }
> = {
  error: {
    header: "border-red-100 bg-red-50/80",
    icon: AlertCircle,
    iconColor: "text-red-600",
    defaultTitle: "Something went wrong"
  },
  warning: {
    header: "border-amber-100 bg-amber-50/80",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    defaultTitle: "Please check"
  },
  success: {
    header: "border-emerald-100 bg-emerald-50/80",
    icon: CheckCircle2,
    iconColor: "text-emerald-600",
    defaultTitle: "Completed"
  },
  info: {
    header: "border-sky-100 bg-sky-50/80",
    icon: Info,
    iconColor: "text-sky-600",
    defaultTitle: "Notice"
  }
};

export function StaffAlertModal({ alert, onClose }: StaffAlertModalProps) {
  useEffect(() => {
    if (!alert) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [alert, onClose]);

  if (!alert) return null;

  const styles = VARIANT_STYLES[alert.variant];
  const Icon = styles.icon;
  const title = alert.title ?? styles.defaultTitle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-zinc-900/45 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="staff-alert-title"
        aria-describedby="staff-alert-message"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-xl"
      >
        <div className={cn("border-b px-5 py-4", styles.header)}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Icon className={cn("mt-0.5 size-5 shrink-0", styles.iconColor)} />
              <div>
                <h2 id="staff-alert-title" className="text-lg font-semibold text-zinc-900">
                  {title}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-zinc-500 transition hover:bg-white hover:text-zinc-800"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4">
          <p id="staff-alert-message" className="text-sm leading-relaxed text-zinc-700">
            {alert.message}
          </p>
        </div>

        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
