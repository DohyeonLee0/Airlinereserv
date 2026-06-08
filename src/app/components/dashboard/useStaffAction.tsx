"use client";

import { FormEvent, useState } from "react";
import { cn } from "@/lib/cn";

export function useStaffAction(onSuccess?: () => void | Promise<void>) {
  const [message, setMessage] = useState("");

  async function postJson(endpoint: string, body: Record<string, unknown>, method = "POST") {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    const message = response.ok ? "Completed successfully." : json.message ?? "Request failed";
    setMessage(message);
    if (response.ok && onSuccess) await onSuccess();
    return { ok: response.ok, data: response.ok ? json.data : undefined, message };
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
  const isError =
    message !== "Completed successfully." &&
    message !== "Deleted successfully." &&
    !message.endsWith(" successfully.");
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm shadow-sm",
        isError ? "border-red-200 bg-red-50 text-red-800" : "border-zinc-200/80 bg-white text-zinc-700"
      )}
    >
      {message}
    </div>
  );
}
