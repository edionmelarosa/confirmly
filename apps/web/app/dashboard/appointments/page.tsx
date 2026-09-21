"use client";

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ClinicSettingsDto } from "@confirmly/shared-types";
import { DayCalendar } from "@/components/calendar/DayCalendar";
import { SessionCapacityView } from "@/components/calendar/SessionCapacityView";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";

export default function AppointmentsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<ClinicSettingsDto | null>(null);

  useEffect(() => {
    apiClient
      .get<ClinicSettingsDto>("/clinic-settings")
      .then(setSettings)
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to load clinic settings");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-neutral-900">Appointments</h1>
      {!settings ? (
        <Skeleton className="h-40 w-full max-w-md" />
      ) : settings.schedulingMode === "session_capacity" ? (
        <SessionCapacityView />
      ) : (
        <DayCalendar />
      )}
    </div>
  );
}
