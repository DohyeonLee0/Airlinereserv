"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Plane } from "lucide-react";
import Button from "@/app/components/ui/Button";
import { isStaffRole } from "@/lib/roles";
import { cn } from "@/lib/cn";

type SessionUser = {
  display_name: string;
  role: string;
};

export default function SiteHeader() {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setUser(json.data.user);
      })
      .catch(() => undefined);
  }, []);

  if (pathname?.startsWith("/dashboard")) {
    return null;
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  const isCustomer = user?.role === "Customer";

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-100/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-[1120px] items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-deep-space-blue text-white">
            <Plane className="size-4" strokeWidth={1.75} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900">CSE305 Air</span>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className={cn(
              "hidden rounded-lg px-3 py-2 text-sm font-medium transition md:inline",
              pathname === "/" ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            )}
          >
            Flights
          </Link>
          {isCustomer && (
            <>
              <Link href="/bookings">
                <Button
                  variant={pathname?.startsWith("/bookings") ? "primary" : "ghost"}
                  size="sm"
                  className={pathname?.startsWith("/bookings") ? undefined : "text-zinc-600"}
                >
                  My Bookings
                </Button>
              </Link>
              <Link
                href="/account"
                className={cn(
                  "hidden rounded-lg px-3 py-2 text-sm font-medium transition sm:inline",
                  pathname === "/account"
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                )}
              >
                Account
              </Link>
            </>
          )}
          {user && isStaffRole(user.role as never) && (
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                Dashboard
              </Button>
            </Link>
          )}
          {!user && (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Create account</Button>
              </Link>
            </>
          )}
          {user && (
            <>
              <span className="hidden text-sm text-zinc-500 md:inline">{user.display_name}</span>
              <Button variant="outline" size="sm" onClick={logout}>
                Sign out
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
