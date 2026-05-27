"use client";

import Link from "next/link";
import { useLocale } from "@/lib/useLocale";

const copy = {
  ko: {
    search: "항공권 검색",
    seats: "좌석 선택",
    staff: "직원 모드",
    lang: "English"
  },
  en: {
    search: "Flight Search",
    seats: "Seats",
    staff: "Staff Mode",
    lang: "한국어"
  }
};

export default function SiteHeader() {
  const { locale, setLocale } = useLocale();
  const t = copy[locale];

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold text-navy">
          CSE305 Air
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700">
          <Link className="hover:text-navy" href="/">
            {t.search}
          </Link>
          <Link className="hover:text-navy" href="/seats">
            {t.seats}
          </Link>
          <Link className="rounded border border-navy px-3 py-1.5 text-navy hover:bg-navy hover:text-white" href="/dashboard">
            {t.staff}
          </Link>
          <button
            type="button"
            onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
            className="rounded border border-slate-300 px-3 py-1.5 text-slate-700 hover:border-navy hover:text-navy"
          >
            {t.lang}
          </button>
        </nav>
      </div>
    </header>
  );
}
