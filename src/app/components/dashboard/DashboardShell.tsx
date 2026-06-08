"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AdminShellProvider, ADMIN_SIDEBAR_WIDTH, useAdminShell } from "./AdminShellContext";
import { dashboardNav } from "@/lib/dashboardNav";
import { cn } from "@/lib/cn";
import { isAdminRole } from "@/lib/roles";
import type { UserRole } from "@/lib/roles";

type SessionUser = {
  display_name: string;
  role: UserRole;
};

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { sidebarOpen, toggleSidebar, sidebarWidth } = useAdminShell();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) {
          setUser({
            display_name: json.data.user.display_name,
            role: json.data.user.role
          });
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navItems = dashboardNav.filter((item) => !item.adminOnly || (user && isAdminRole(user.role)));

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function renderNavLink(item: (typeof navItems)[number], nested = false) {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors",
          nested ? "px-3 pl-9" : "px-3",
          active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
        )}
      >
        <Icon className="size-4 shrink-0" />
        {item.label}
      </Link>
    );
  }

  return (
    <div className="fixed inset-0 z-40 h-svh overflow-hidden bg-zinc-50">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col overflow-y-auto border-r border-white/5 bg-zinc-900 text-zinc-300 transition-transform duration-200 ease-out",
          !sidebarOpen && "-translate-x-full"
        )}
        style={{ width: ADMIN_SIDEBAR_WIDTH }}
        aria-hidden={!sidebarOpen}
      >
        <div className="border-b border-white/5 p-5">
          <Link href="/" className="block text-lg font-semibold text-white hover:text-zinc-200">
            CSE305 Air
          </Link>
          <p className="mt-2 text-xs text-zinc-500">Staff portal</p>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            if (item.children?.length) {
              const sectionActive = item.children.some((child) => isActive(child.href));
              return (
                <div key={item.label} className="space-y-1">
                  <p
                    className={cn(
                      "px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider",
                      sectionActive ? "text-zinc-300" : "text-zinc-500"
                    )}
                  >
                    {item.label}
                  </p>
                  {item.children.map((child) => renderNavLink(child, true))}
                </div>
              );
            }
            return renderNavLink(item);
          })}
        </nav>

        <div className="space-y-2 border-t border-white/5 p-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="size-4 shrink-0" />
            Log out
          </button>
        </div>
      </aside>

      <div
        className="flex h-full min-w-0 flex-col transition-[margin-left,width] duration-200 ease-out"
        style={{
          marginLeft: sidebarWidth,
          width: `calc(100% - ${sidebarWidth}px)`
        }}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200/80 bg-white px-4 sm:px-6">
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex size-9 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
          </button>
          {user && (
            <p className="min-w-0 text-sm text-zinc-500">
              <span className="font-medium text-zinc-900">{user.display_name}</span>
              <span className="ml-2 rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{user.role}</span>
            </p>
          )}
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className={cn("w-full pb-8", sidebarOpen && "mx-auto max-w-6xl")}>{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AdminShellProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AdminShellProvider>
  );
}
