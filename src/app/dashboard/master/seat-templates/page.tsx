"use client";

import { Layers3 } from "lucide-react";
import { PageTitle } from "@/app/components/dashboard/PageTitle";
import { AircraftSeatTemplatePanel } from "@/app/components/dashboard/master/AircraftSeatTemplatePanel";

export default function SeatTemplatesMasterPage() {
  return (
    <div className="space-y-6">
      <PageTitle
        icon={Layers3}
        title="Seat Layout Templates"
        description="Manage reusable seat maps in aircraft_seat_templates. Apply them when registering aircraft on the Aircraft page."
        accent="amber"
      />
      <AircraftSeatTemplatePanel />
    </div>
  );
}
