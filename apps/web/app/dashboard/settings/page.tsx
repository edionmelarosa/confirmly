"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ClinicSettingsDto, SchedulingMode } from "@confirmly/shared-types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<ClinicSettingsDto | null>(null);
  const [reminderLeadDays, setReminderLeadDays] = useState("1");
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>("fixed_time");
  const [sessionCapacityAm, setSessionCapacityAm] = useState("15");
  const [sessionCapacityPm, setSessionCapacityPm] = useState("10");
  const [morningCutoffHour, setMorningCutoffHour] = useState("12");
  const [afternoonCutoffHour, setAfternoonCutoffHour] = useState("18");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiClient
      .get<ClinicSettingsDto>("/clinic-settings")
      .then((data) => {
        setSettings(data);
        setReminderLeadDays(String(data.reminderLeadDays));
        setSchedulingMode(data.schedulingMode);
        setSessionCapacityAm(String(data.sessionCapacityAm ?? 15));
        setSessionCapacityPm(String(data.sessionCapacityPm ?? 10));
        setMorningCutoffHour(String(data.sessionAmEndHour));
        setAfternoonCutoffHour(String(data.sessionPmEndHour));
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to load settings");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        reminderLeadDays: Number(reminderLeadDays),
        schedulingMode,
        sessionAmEndHour: Number(morningCutoffHour),
        sessionPmEndHour: Number(afternoonCutoffHour),
      };
      if (schedulingMode === "session_capacity") {
        payload.sessionCapacityAm = Number(sessionCapacityAm);
        payload.sessionCapacityPm = Number(sessionCapacityPm);
      }
      const updated = await apiClient.patch<ClinicSettingsDto>("/clinic-settings", payload);
      setSettings(updated);
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!settings) {
    return (
      <div className="max-w-md space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            {settings.name} ({settings.timezone})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
              Reminder lead time (days before appointment)
              <Input
                type="number"
                min={1}
                value={reminderLeadDays}
                onChange={(e) => setReminderLeadDays(e.target.value)}
                required
              />
            </label>

            <fieldset className="flex flex-col gap-2 text-sm">
              <legend className="font-medium text-neutral-700">Scheduling mode</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="schedulingMode"
                  checked={schedulingMode === "fixed_time"}
                  onChange={() => setSchedulingMode("fixed_time")}
                />
                Fixed time slots
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="schedulingMode"
                  checked={schedulingMode === "session_capacity"}
                  onChange={() => setSchedulingMode("session_capacity")}
                />
                Morning / Afternoon sessions (capacity)
              </label>
            </fieldset>

            {schedulingMode === "session_capacity" && (
              <>
                <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                  Morning capacity
                  <Input
                    type="number"
                    min={1}
                    value={sessionCapacityAm}
                    onChange={(e) => setSessionCapacityAm(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                  Afternoon capacity
                  <Input
                    type="number"
                    min={1}
                    value={sessionCapacityPm}
                    onChange={(e) => setSessionCapacityPm(e.target.value)}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                  Morning cutoff time
                  <Input
                    type="time"
                    value={`${morningCutoffHour.padStart(2, "0")}:00`}
                    onChange={(e) => {
                      const hour = e.target.value.split(":")[0];
                      setMorningCutoffHour(hour);
                    }}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                  Afternoon cutoff time
                  <Input
                    type="time"
                    value={`${afternoonCutoffHour.padStart(2, "0")}:00`}
                    onChange={(e) => {
                      const hour = e.target.value.split(":")[0];
                      setAfternoonCutoffHour(hour);
                    }}
                    required
                  />
                </label>
              </>
            )}

            <Button type="submit" disabled={submitting} className="mt-1 self-start">
              {submitting ? "Saving..." : "Save settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
