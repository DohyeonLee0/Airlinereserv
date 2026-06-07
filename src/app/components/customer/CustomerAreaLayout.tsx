"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/bookings", label: "My Bookings" },
  { href: "/account", label: "Account" }
] as const;

export default function CustomerAreaLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-[calc(100vh-72px)] bg-zinc-50/50">
      <div className="border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Customer portal</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">Manage your trips</h1>
          </div>
          <Link
            href="/"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Search flights
          </Link>
        </div>
        <div className="mx-auto flex max-w-[1120px] gap-1 px-5 sm:px-8">
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "border-b-2 px-4 py-3 text-sm font-medium transition",
                pathname === href
                  ? "border-deep-space-blue text-deep-space-blue"
                  : "border-transparent text-zinc-500 hover:text-zinc-800"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto max-w-[1120px] px-5 py-8 sm:px-8">{children}</div>
    </div>
  );
}
