"use client";

import { FormEvent, useCallback, useState } from "react";
import { StaffAlertModal, type StaffAlertState, type StaffAlertVariant } from "./StaffAlertModal";

type PostJsonOptions = {
  silentSuccess?: boolean;
};

export function useStaffAction(onSuccess?: () => void | Promise<void>) {
  const [alert, setAlert] = useState<StaffAlertState | null>(null);

  const clearAlert = useCallback(() => setAlert(null), []);

  const showAlert = useCallback(
    (message: string, options?: { title?: string; variant?: StaffAlertVariant }) => {
      setAlert({
        message,
        title: options?.title,
        variant: options?.variant ?? "error"
      });
    },
    []
  );

  async function postJson(
    endpoint: string,
    body: Record<string, unknown>,
    method = "POST",
    options?: PostJsonOptions
  ) {
    const response = await fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const json = await response.json();
    const message = json.message ?? (response.ok ? "Completed successfully." : "Request failed");

    if (!response.ok) {
      showAlert(message, { title: "Request failed" });
    } else if (!options?.silentSuccess) {
      showAlert(message, { title: "Success", variant: "success" });
    }

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
    const message = json.message ?? (response.ok ? "Deleted successfully." : "Delete failed");

    if (!response.ok) {
      showAlert(message, { title: "Delete failed" });
    } else {
      showAlert(message, { title: "Deleted", variant: "success" });
    }

    if (response.ok && onSuccess) await onSuccess();
  }

  return { alert, showAlert, clearAlert, postJson, postForm, deleteJson };
}

export { StaffAlertModal };
