"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { formatDateTime } from "@/lib/formatDate";

type StaffRequest = {
  request_id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  display_name: string;
  email: string;
  requested_role: string;
  status: string;
  requested_at: string;
};

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [message, setMessage] = useState("");
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});

  async function loadRequests() {
    const response = await fetch("/api/admin/staff-requests");
    const json = await response.json();
    if (!response.ok) {
      setMessage(json.message ?? "Failed to load requests");
      return;
    }
    setRequests(json.data?.requests ?? []);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function approve(requestId: number) {
    const response = await fetch(`/api/admin/staff-requests/${requestId}/approve`, { method: "POST" });
    const json = await response.json();
    setMessage(response.ok ? `Request #${requestId} approved.` : json.message ?? "Approval failed");
    await loadRequests();
  }

  async function reject(requestId: number) {
    const reason = rejectReason[requestId]?.trim();
    if (!reason) {
      setMessage("A reject reason is required.");
      return;
    }
    const response = await fetch(`/api/admin/staff-requests/${requestId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reject_reason: reason })
    });
    const json = await response.json();
    setMessage(response.ok ? `Request #${requestId} rejected.` : json.message ?? "Rejection failed");
    await loadRequests();
  }

  return (
    <div className="space-y-8">
      <PageTitle
        icon={ShieldCheck}
        title="Staff Approvals"
        description="SuperAdmin approves Admin requests. Admin and SuperAdmin approve Staff requests."
        accent="emerald"
      />

      {message && <p className="rounded-xl bg-zinc-100 px-4 py-3 text-sm text-zinc-700">{message}</p>}

      {requests.length === 0 ? (
        <p className="text-zinc-600">No pending staff registration requests.</p>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <article key={request.request_id} className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900">{request.display_name}</h2>
                  <p className="text-sm text-zinc-600">{request.email}</p>
                  <p className="mt-2 text-sm">
                    Requested role: <span className="font-semibold">{request.requested_role}</span>
                  </p>
                  <p className="text-xs text-zinc-500">Submitted {formatDateTime(request.requested_at)}</p>
                </div>
                <div className="flex min-w-[240px] flex-col gap-2">
                  <button type="button" onClick={() => approve(request.request_id)} className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white">
                    Approve
                  </button>
                  <input
                    placeholder="Reject reason"
                    value={rejectReason[request.request_id] ?? ""}
                    onChange={(e) => setRejectReason((prev) => ({ ...prev, [request.request_id]: e.target.value }))}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => reject(request.request_id)} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
                    Reject
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
