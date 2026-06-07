"use client";

import { FormEvent, useState } from "react";

export function useStaffAction(onSuccess?: () => void | Promise<void>) {
  const [message, setMessage] = useState("");

  async function postJson(endpoint: string, body: Record<string, unknown>, method = "POST") {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    setMessage(response.ok ? "Completed successfully." : json.message ?? "Request failed");
    if (response.ok && onSuccess) await onSuccess();
  }

  async function postForm(event: FormEvent, endpoint: string, body: Record<string, string>) {
    event.preventDefault();
    await postJson(endpoint, body);
  }

  async function deleteJson(endpoint: string, body: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    setMessage(response.ok ? "Deleted successfully." : json.message ?? "Delete failed");
    if (response.ok && onSuccess) await onSuccess();
  }

  return { message, setMessage, postJson, postForm, deleteJson };
}

export function StaffMessage({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-sm text-zinc-700 shadow-sm">{message}</div>;
}
