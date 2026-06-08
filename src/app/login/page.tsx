"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { notifyAuthChanged } from "@/lib/authEvents";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const json = await response.json();
    setLoading(false);
    if (!json.success) {
      setError(json.message ?? "Login failed");
      return;
    }
    notifyAuthChanged();
    const role = json.data?.user?.role;
    if (role === "Customer") router.push(next === "/" ? "/bookings" : next);
    else router.push("/dashboard");
  }

  return (
    <section className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-navy">Sign In</h1>
      <p className="mt-2 text-sm text-slate-600">Access your bookings or staff portal.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        New customer?{" "}
        <Link href="/signup" className="font-medium text-navy hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Staff applicant?{" "}
        <Link href="/signup/staff" className="font-medium text-navy hover:underline">
          Request staff access
        </Link>
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
      <Suspense fallback={<p className="text-zinc-500">Loading...</p>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
