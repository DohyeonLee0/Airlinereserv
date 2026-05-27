"use client";

import { useEffect, useState } from "react";

export type Locale = "ko" | "en";

export function useLocale() {
  const [locale, setLocaleState] = useState<Locale>("ko");

  useEffect(() => {
    const saved = window.localStorage.getItem("ars_locale");
    if (saved === "ko" || saved === "en") setLocaleState(saved);
  }, []);

  function setLocale(next: Locale) {
    window.localStorage.setItem("ars_locale", next);
    setLocaleState(next);
    window.dispatchEvent(new CustomEvent("ars-locale-change", { detail: next }));
  }

  return { locale, setLocale };
}
