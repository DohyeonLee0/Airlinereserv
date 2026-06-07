"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail, User } from "lucide-react";
import Button from "@/app/components/ui/Button";

type UserProfile = {
  user_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  display_name: string;
  email: string;
  role: string;
};

export default function AccountPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (!json.success) {
          setError(json.message ?? "Unable to load account");
          return;
        }
        setUser(json.data.user);
      })
      .catch(() => setError("Unable to load account"));
  }, []);

  if (error) {
    return <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>;
  }
  if (!user) {
    return <p className="text-zinc-500">Loading account…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-100 bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-deep-space-blue text-white">
            <User className="size-6" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900">{user.display_name}</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-zinc-500">
              <Mail className="size-3.5" strokeWidth={1.75} />
              {user.email}
            </p>
            <p className="mt-2 text-xs text-zinc-400">User ID: {user.user_id}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white p-6 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Profile</h3>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">First name</dt>
            <dd className="mt-1 text-zinc-900">{user.first_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Middle name</dt>
            <dd className="mt-1 text-zinc-900">{user.middle_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Last name</dt>
            <dd className="mt-1 text-zinc-900">{user.last_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400">Role</dt>
            <dd className="mt-1 text-zinc-900">{user.role}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-zinc-100 bg-white p-6 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-cerulean-700">Quick actions</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/bookings">
            <Button>View my bookings</Button>
          </Link>
          <Link href="/">
            <Button variant="outline">Search new flights</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
