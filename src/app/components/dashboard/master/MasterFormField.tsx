import type { ReactNode } from "react";

export const masterInputClass =
  "mt-1.5 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

export function MasterFormField({
  label,
  hint,
  required,
  children
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-zinc-700">
      <span>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </span>
      {hint ? <span className="mt-0.5 block text-xs font-normal text-zinc-500">{hint}</span> : null}
      {children}
    </label>
  );
}
