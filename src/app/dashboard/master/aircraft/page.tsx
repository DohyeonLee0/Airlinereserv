"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Plane } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { AircraftSeatEditor } from "@/app/components/dashboard/master/AircraftSeatEditor";
import { masterInputClass, MasterFormField } from "@/app/components/dashboard/master/MasterFormField";
import MasterRecordTable from "@/app/components/dashboard/master/MasterRecordTable";
import { useMasterLists, type AircraftRow } from "@/app/components/dashboard/master/useMasterLists";
import { StaffConfirmModal, type StaffConfirmState } from "@/app/components/dashboard/StaffConfirmModal";
import { StaffAlertModal, useStaffAction } from "@/app/components/dashboard/useStaffAction";
import {
  defaultSeatsForModel,
  findTemplateForModel,
  normalizeAircraftSeats,
  summarizeSeatLayout,
  type AircraftSeatInput,
  type SeatTemplateListItem
} from "@/lib/aircraftSeatLayouts";
import { AIRCRAFT_MODELS, nextNumericId } from "@/lib/masterDataOptions";

const formCardClass = "rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm";

type ExtendedAircraftRow = AircraftRow & {
  configured_seats?: number;
  first_seats?: number;
  business_seats?: number;
  economy_seats?: number;
};

export default function AircraftMasterPage() {
  const { airlines, aircraft, loading, error, reload } = useMasterLists({ airlines: true, aircraft: true });
  const { alert, showAlert, clearAlert, postJson, deleteJson } = useStaffAction(reload);
  const [templates, setTemplates] = useState<SeatTemplateListItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<(StaffConfirmState & { aircraftId: number }) | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [form, setForm] = useState({
    aircraft_id: "",
    airline_id: "",
    model: AIRCRAFT_MODELS[0] as string
  });
  const [seats, setSeats] = useState<AircraftSeatInput[]>([]);

  const seatSummary = summarizeSeatLayout(seats);

  const loadTemplates = useCallback(async () => {
    const response = await fetch("/api/staff/master/seat-templates");
    const json = await response.json();
    if (response.ok) {
      setTemplates((json.data?.rows ?? []) as SeatTemplateListItem[]);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    clearAlert();
  }, [selectedKey, clearAlert]);

  useEffect(() => {
    if (!selectedKey && aircraft.length && !form.aircraft_id) {
      setForm((prev) => ({
        ...prev,
        aircraft_id: String(nextNumericId(aircraft as Record<string, unknown>[], "aircraft_id", 1)),
        airline_id: prev.airline_id || airlines[0]?.airline_id || ""
      }));
    }
  }, [aircraft, airlines, form.aircraft_id, selectedKey]);

  useEffect(() => {
    if (selectedKey) return;
    void applyTemplateForModel(form.model, templates);
  }, [templates, form.model, selectedKey]);

  async function applyTemplateById(templateId: string) {
    if (!templateId) return;
    setApplyingTemplate(true);
    try {
      const response = await fetch(`/api/staff/master/seat-templates/${templateId}`);
      const json = await response.json();
      if (!response.ok) {
        showAlert(json.message ?? "Failed to load template from database.", { title: "Template load failed" });
        return;
      }
      const detail = json.data as { seats: AircraftSeatInput[] };
      setSeats(normalizeAircraftSeats(detail.seats));
    } finally {
      setApplyingTemplate(false);
    }
  }

  async function applyTemplateForModel(model: string, templateList = templates) {
    const matched = findTemplateForModel(templateList, model);
    if (matched) {
      setSelectedTemplateId(String(matched.template_id));
      await applyTemplateById(String(matched.template_id));
      return;
    }
    setSelectedTemplateId("");
    setSeats(defaultSeatsForModel(model));
  }

  function startNew() {
    setSelectedKey(null);
    const model = AIRCRAFT_MODELS[0];
    setForm({
      aircraft_id: String(nextNumericId(aircraft as Record<string, unknown>[], "aircraft_id", 1)),
      airline_id: airlines[0]?.airline_id ?? "",
      model
    });
    setSeats([]);
    void applyTemplateForModel(model);
  }

  async function loadAircraftDetail(aircraftId: number) {
    setLoadingSeats(true);
    try {
      const response = await fetch(`/api/staff/master/aircraft/${aircraftId}`);
      const json = await response.json();
      if (!response.ok) {
        showAlert(json.message ?? "Failed to load aircraft seats.", { title: "Load failed" });
        return;
      }

      const detail = json.data as {
        aircraft: { aircraft_id: number; airline_id: string; model: string };
        seats: AircraftSeatInput[];
      };

      setForm({
        aircraft_id: String(detail.aircraft.aircraft_id),
        airline_id: detail.aircraft.airline_id,
        model: detail.aircraft.model
      });

      const loadedSeats = normalizeAircraftSeats(detail.seats);
      if (loadedSeats.length) {
        setSeats(loadedSeats);
        const matched = findTemplateForModel(templates, detail.aircraft.model);
        setSelectedTemplateId(matched ? String(matched.template_id) : "");
      } else {
        await applyTemplateForModel(detail.aircraft.model);
      }
    } finally {
      setLoadingSeats(false);
    }
  }

  async function editRow(row: ExtendedAircraftRow) {
    setSelectedKey(String(row.aircraft_id));
    await loadAircraftDetail(row.aircraft_id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const normalizedSeats = normalizeAircraftSeats(seats);
    if (!normalizedSeats.length) {
      showAlert("Add at least one valid seat (example: 12A).", { title: "Seat layout required", variant: "warning" });
      return;
    }

    const result = await postJson(
      "/api/staff/master/aircraft",
      {
        aircraft_id: Number(form.aircraft_id),
        airline_id: form.airline_id,
        model: form.model,
        capacity: normalizedSeats.length,
        seats: normalizedSeats
      },
      "POST",
      { silentSuccess: true }
    );

    if (!result.ok) return;

    showAlert(`Aircraft #${form.aircraft_id} saved with ${normalizedSeats.length} configured seats.`, {
      title: "Aircraft saved",
      variant: "success"
    });
    startNew();
  }

  function requestDelete(row: ExtendedAircraftRow) {
    setDeleteConfirm({
      aircraftId: row.aircraft_id,
      title: "Delete aircraft?",
      message: `Delete aircraft #${row.aircraft_id} (${row.model})? This cannot be undone.`,
      confirmLabel: "Delete aircraft",
      cancelLabel: "Keep aircraft",
      pendingLabel: "Deleting…",
      tone: "danger"
    });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      await deleteJson("/api/staff/master/aircraft/delete", { aircraft_id: deleteConfirm.aircraftId });
      if (selectedKey === String(deleteConfirm.aircraftId)) startNew();
      setDeleteConfirm(null);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        icon={Plane}
        title="Aircraft"
        description="Register fleet types and apply seat layouts from Seat Templates into aircraft_seats."
        accent="amber"
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <StaffAlertModal alert={alert} onClose={clearAlert} />
      <StaffConfirmModal
        confirm={deleteConfirm}
        isPending={isDeleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!isDeleting) setDeleteConfirm(null);
        }}
      />

      <div className="grid gap-6">
        <form onSubmit={handleSubmit} className={formCardClass}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">{selectedKey ? "Edit aircraft" : "Add aircraft"}</h2>
            {selectedKey ? (
              <button type="button" onClick={startNew} className="text-xs font-medium text-brand hover:underline">
                New instead
              </button>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_1fr]">
            <div className="space-y-4">
              <MasterFormField label="Aircraft ID" hint="Internal numeric ID" required>
                <input
                  type="number"
                  min={1}
                  value={form.aircraft_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, aircraft_id: e.target.value }))}
                  className={masterInputClass}
                  required
                />
              </MasterFormField>

              <MasterFormField label="Airline" required>
                <select
                  value={form.airline_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, airline_id: e.target.value }))}
                  className={masterInputClass}
                  required
                >
                  <option value="">Select airline…</option>
                  {airlines.map((airline) => (
                    <option key={airline.airline_id} value={airline.airline_id}>
                      {airline.airline_id} · {airline.airline_name}
                    </option>
                  ))}
                </select>
              </MasterFormField>

              <MasterFormField
                label="Model"
                hint={
                  <>
                    Auto-applies a matching template from{" "}
                    <Link href="/dashboard/master/seat-templates" className="font-medium text-brand hover:underline">
                      Seat Templates
                    </Link>
                    .
                  </>
                }
                required
              >
                <select
                  value={form.model}
                  onChange={(e) => {
                    const model = e.target.value;
                    setForm((prev) => ({ ...prev, model }));
                    void applyTemplateForModel(model);
                  }}
                  className={masterInputClass}
                  required
                >
                  {AIRCRAFT_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </MasterFormField>

              <MasterFormField label="Configured capacity" hint="Auto-calculated from seat layout">
                <input type="number" value={seatSummary.total} className={masterInputClass} readOnly />
              </MasterFormField>
            </div>

            <div>
              {loadingSeats ? (
                <div className="h-80 animate-pulse rounded-xl bg-zinc-100" />
              ) : (
                <AircraftSeatEditor
                  seats={seats}
                  onChange={setSeats}
                  templates={templates}
                  selectedTemplateId={selectedTemplateId}
                  onSelectedTemplateIdChange={setSelectedTemplateId}
                  onApplyTemplate={() => applyTemplateById(selectedTemplateId)}
                  applyingTemplate={applyingTemplate}
                />
              )}
            </div>
          </div>

          <button type="submit" className="mt-5 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-navy/90">
            {selectedKey ? "Update aircraft + seats" : "Save aircraft + seats"}
          </button>
        </form>

        <section className={formCardClass}>
          <h2 className="mb-1 text-lg font-semibold text-zinc-900">Fleet list</h2>
          <p className="mb-4 text-sm text-zinc-500">Click a row to edit the seat layout stored in aircraft_seats.</p>
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-zinc-100" />
          ) : (
            <MasterRecordTable
              rows={aircraft as ExtendedAircraftRow[]}
              rowKey={(row) => String(row.aircraft_id)}
              selectedKey={selectedKey}
              onSelect={editRow}
              onDelete={requestDelete}
              columns={[
                { key: "aircraft_id", label: "ID" },
                { key: "airline_id", label: "Airline" },
                { key: "model", label: "Model" },
                {
                  key: "configured_seats",
                  label: "Configured",
                  render: (row) => String(row.configured_seats ?? row.capacity ?? 0)
                },
                {
                  key: "seat_mix",
                  label: "F / J / Y",
                  render: (row) =>
                    `${row.first_seats ?? 0} / ${row.business_seats ?? 0} / ${row.economy_seats ?? 0}`
                }
              ]}
            />
          )}
        </section>
      </div>
    </div>
  );
}
