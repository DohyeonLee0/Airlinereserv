"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { buildDisplayName } from "@/lib/displayName";

type SignupForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupForm>({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const previewName = useMemo(
    () => buildDisplayName(form.first_name, form.middle_name, form.last_name) || "Your full name",
    [form.first_name, form.middle_name, form.last_name]
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/register/customer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const json = await response.json();
    setLoading(false);
    if (!json.success) {
      setError(json.message ?? "Registration failed");
      return;
    }
    router.push("/login?next=/");
  }

  return (
    <section className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-semibold text-navy">Customer Registration</h1>
      <p className="mt-2 text-sm text-slate-600">Create an account to search flights and make reservations.</p>
      <p className="mt-3 rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
        Full name preview: <span className="font-semibold text-navy">{previewName}</span>
      </p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
          First Name *
          <input
            required
            value={form.first_name}
            onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
          Middle Name
          <input
            placeholder="Optional"
            value={form.middle_name}
            onChange={(e) => setForm((prev) => ({ ...prev, middle_name: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Last Name *
          <input
            required
            value={form.last_name}
            onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
          Email *
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
          Password *
          <input
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
          Confirm Password *
          <input
            type="password"
            required
            value={form.confirm_password}
            onChange={(e) => setForm((prev) => ({ ...prev, confirm_password: e.target.value }))}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
          />
        </label>
        {error && (
          <p className="text-sm text-red-600 sm:col-span-2">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="sm:col-span-2 w-full rounded bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Creating account..." : "Create Account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-navy hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
