"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

export const ADMIN_SIDEBAR_WIDTH = 256;
const STORAGE_KEY = "ars-admin-sidebar-open";

type AdminShellContextValue = {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  sidebarWidth: number;
};

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

function readStoredSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => readStoredSidebarOpen());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(sidebarOpen));
  }, [sidebarOpen]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => !open);
  }, []);

  const value = useMemo<AdminShellContextValue>(
    () => ({
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      sidebarWidth: sidebarOpen ? ADMIN_SIDEBAR_WIDTH : 0
    }),
    [sidebarOpen, toggleSidebar]
  );

  return <AdminShellContext.Provider value={value}>{children}</AdminShellContext.Provider>;
}

export function useAdminShell(): AdminShellContextValue {
  const ctx = useContext(AdminShellContext);
  if (!ctx) {
    return {
      sidebarOpen: false,
      setSidebarOpen: () => undefined,
      toggleSidebar: () => undefined,
      sidebarWidth: 0
    };
  }
  return ctx;
}
