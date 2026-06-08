"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AircraftSeatEditor } from "@/app/components/dashboard/master/AircraftSeatEditor";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { StaffAlertModal, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import { StaffConfirmModal, type StaffConfirmState } from "@/app/components/dashboard/StaffConfirmModal";
import {
  defaultSeatsForModel,
  normalizeAircraftSeats,
  summarizeSeatLayout,
  type AircraftSeatInput,
  type SeatTemplateListItem
} from "@/lib/aircraftSeatLayouts";
import { AIRCRAFT_MODELS, nextNumericId } from "@/lib/masterDataOptions";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";

type TemplateRow = SeatTemplateListItem & {
  description?: string | null;
};

export function AircraftSeatTemplatePanel() {
  const { alert, showAlert, clearAlert, postJson, deleteJson } = useStaffAction(async () => {
    await loadTemplates();
  });
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    template_id: "",
    template_name: "",
    model_label: AIRCRAFT_MODELS[0] as string,
    description: ""
  });
  const [seats, setSeats] = useState<AircraftSeatInput[]>(() => defaultSeatsForModel(AIRCRAFT_MODELS[0]));
  const [deleteConfirm, setDeleteConfirm] = useState<(StaffConfirmState & { templateId: number }) | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function loadTemplates() {
    setLoading(true);
    const response = await fetch("/api/staff/master/seat-templates");
    const json = await response.json();
    if (response.ok) {
      setTemplates((json.data?.rows ?? []) as TemplateRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadTemplates();
  }, []);

  useEffect(() => {
    if (!selectedKey && templates.length && !form.template_id) {
      setForm((prev) => ({
        ...prev,
        template_id: String(nextNumericId(templates as Record<string, unknown>[], "template_id", 1))
      }));
    }
  }, [templates, form.template_id, selectedKey]);

  function startNew() {
    setSelectedKey(null);
    const model = AIRCRAFT_MODELS[0];
    setForm({
      template_id: String(nextNumericId(templates as Record<string, unknown>[], "template_id", 1)),
      template_name: "",
      model_label: model,
      description: ""
    });
    setSeats(defaultSeatsForModel(model));
  }

  async function loadTemplateDetail(templateId: number) {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/staff/master/seat-templates/${templateId}`);
      const json = await response.json();
      if (!response.ok) {
        showAlert(json.message ?? "Failed to load template.", { title: "Load failed" });
        return;
      }

      const detail = json.data as {
        template: {
          template_id: number;
          template_name: string;
          model_label: string | null;
          description: string | null;
        };
        seats: AircraftSeatInput[];
      };

      setForm({
        template_id: String(detail.template.template_id),
        template_name: detail.template.template_name,
        model_label: detail.template.model_label ?? AIRCRAFT_MODELS[0],
        description: detail.template.description ?? ""
      });
      setSeats(normalizeAircraftSeats(detail.seats));
    } finally {
      setLoadingDetail(false);
    }
  }

  async function editRow(row: TemplateRow) {
    setSelectedKey(String(row.template_id));
    await loadTemplateDetail(row.template_id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedSeats = normalizeAircraftSeats(seats);
    if (!form.template_name.trim()) {
      showAlert("Template name is required.", { title: "Missing name", variant: "warning" });
      return;
    }
    if (!normalizedSeats.length) {
      showAlert("Add at least one seat to the template.", { title: "Seat layout required", variant: "warning" });
      return;
    }

    const result = await postJson(
      "/api/staff/master/seat-templates",
      {
        template_id: Number(form.template_id),
        template_name: form.template_name.trim(),
        model_label: form.model_label || null,
        description: form.description.trim() || null,
        seats: normalizedSeats
      },
      "POST",
      { silentSuccess: true }
    );
    if (!result.ok) return;

    showAlert(`Template "${form.template_name}" saved with ${normalizedSeats.length} seats.`, {
      title: "Template saved",
      variant: "success"
    });
    await loadTemplates();
    startNew();
  }

  function handleDelete(row: TemplateRow) {
    setDeleteConfirm({
      templateId: row.template_id,
      title: "Delete seat template?",
      message: `Delete template "${row.template_name}"? This cannot be undone.`,
      confirmLabel: "Delete template",
      tone: "danger"
    });
  }

  async function confirmDeleteTemplate() {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteJson("/api/staff/master/seat-templates", { template_id: deleteConfirm.templateId });
      if (selectedKey === String(deleteConfirm.templateId)) startNew();
      setDeleteConfirm(null);
    } finally {
      setIsDeleting(false);
    }
  }

  const summary = summarizeSeatLayout(seats);

  return (
    <section className={formCardClass}>
      <StaffAlertModal alert={alert} onClose={clearAlert} />
      <StaffConfirmModal
        confirm={deleteConfirm}
        isPending={isDeleting}
        onCancel={() => {
          if (!isDeleting) setDeleteConfirm(null);
        }}
        onConfirm={() => void confirmDeleteTemplate()}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,360px)_1fr]">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-zinc-900">{selectedKey ? "Edit template" : "New template"}</h3>
            {selectedKey ? (
              <button type="button" onClick={startNew} className="text-xs font-medium text-brand hover:underline">
                New instead
              </button>
            ) : null}
          </div>

          <MasterFormField label="Template ID" required>
            <input
              type="number"
              min={1}
              value={form.template_id}
              onChange={(e) => setForm((prev) => ({ ...prev, template_id: e.target.value }))}
              className={masterInputClass}
              required
            />
          </MasterFormField>

          <MasterFormField label="Template name" required>
            <input
              value={form.template_name}
              onChange={(e) => setForm((prev) => ({ ...prev, template_name: e.target.value }))}
              className={masterInputClass}
              placeholder="Boeing 777 premium"
              required
            />
          </MasterFormField>

          <MasterFormField label="Suggested model" hint="Used to auto-match when aircraft model changes">
            <select
              value={form.model_label}
              onChange={(e) => {
                const model = e.target.value;
                setForm((prev) => ({ ...prev, model_label: model }));
                if (!selectedKey) setSeats(defaultSeatsForModel(model));
              }}
              className={masterInputClass}
            >
              {AIRCRAFT_MODELS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </MasterFormField>

          <MasterFormField label="Description">
            <input
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className={masterInputClass}
              placeholder="First 1-2-1 · Business 2-2-2 · Economy 3-4-3"
            />
          </MasterFormField>

          <MasterFormField label="Seats in template">
            <input value={summary.total} readOnly className={masterInputClass} />
          </MasterFormField>

          <div className="flex flex-wrap gap-2">
            <button type="submit" className="rounded-xl bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy/90">
              {selectedKey ? "Update template" : "Save template"}
            </button>
            <Link
              href="/dashboard/master/aircraft"
              className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Go to Aircraft
            </Link>
          </div>
        </form>

        <div>
          {loadingDetail ? (
            <div className="h-80 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <AircraftSeatEditor
              seats={seats}
              onChange={setSeats}
              templates={templates}
              selectedTemplateId=""
              onSelectedTemplateIdChange={() => undefined}
              onApplyTemplate={() => setSeats(defaultSeatsForModel(form.model_label))}
              applyLabel="Reset from model defaults"
              hideTemplatePicker
            />
          )}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">Saved templates</h3>
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
        ) : (
          <MasterRecordTable
            rows={templates}
            rowKey={(row) => String(row.template_id)}
            selectedKey={selectedKey}
            onSelect={editRow}
            onDelete={handleDelete}
            columns={[
              { key: "template_id", label: "ID" },
              { key: "template_name", label: "Name" },
              { key: "model_label", label: "Model", render: (row) => row.model_label ?? "—" },
              { key: "seat_count", label: "Seats", render: (row) => String(row.seat_count ?? 0) },
              { key: "description", label: "Description", render: (row) => row.description ?? "—" }
            ]}
            emptyMessage="No templates yet. Save one above."
          />
        )}
      </div>
    </section>
  );
}
