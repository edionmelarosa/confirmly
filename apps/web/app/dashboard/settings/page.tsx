"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ClinicSettingsDto, SchedulingMode } from "@confirmly/shared-types";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";

// Monday-first for display; values are JS weekdays (0 = Sunday).
const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`;
}

function HourSelect({
  label,
  value,
  onChange,
  min = 0,
  max = 24,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
      {label}
      <select
        className="h-10 rounded-md border border-neutral-300 bg-white px-3"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
          <option key={h} value={h}>
            {hourLabel(h)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<ClinicSettingsDto | null>(null);
  const [reminderLeadDays, setReminderLeadDays] = useState("1");
  const [schedulingMode, setSchedulingMode] = useState<SchedulingMode>("fixed_time");
  const [sessionCapacityAm, setSessionCapacityAm] = useState("15");
  const [sessionCapacityPm, setSessionCapacityPm] = useState("10");
  // Morning runs opening → morning cutoff, afternoon runs morning cutoff → afternoon cutoff.
  const [morningCutoffHour, setMorningCutoffHour] = useState("12");
  const [afternoonCutoffHour, setAfternoonCutoffHour] = useState("18");
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [openHour, setOpenHour] = useState("8");
  const [closeHour, setCloseHour] = useState("18");
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
        setOpenDays(data.openDays);
        setOpenHour(String(data.openHour));
        setCloseHour(String(data.closeHour));
      })
      .catch((err) => {
        toast.error(err instanceof ApiError ? err.message : "Failed to load settings");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (openDays.length === 0) {
      toast.error("Select at least one open day.");
      return;
    }
    if (Number(closeHour) <= Number(openHour)) {
      toast.error("Closing time must be after opening time.");
      return;
    }
    if (
      schedulingMode === "session_capacity" &&
      !(
        Number(openHour) < Number(morningCutoffHour) &&
        Number(morningCutoffHour) < Number(afternoonCutoffHour) &&
        Number(afternoonCutoffHour) <= Number(closeHour)
      )
    ) {
      toast.error("Cutoff times must be in order: opens < morning cutoff < afternoon cutoff ≤ closes.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        reminderLeadDays: Number(reminderLeadDays),
        schedulingMode,
        openDays,
        openHour: Number(openHour),
        closeHour: Number(closeHour),
      };
      if (schedulingMode === "session_capacity") {
        // Morning starts at opening time and afternoon ends at closing time (set server-side).
        payload.sessionCapacityAm = Number(sessionCapacityAm);
        payload.sessionCapacityPm = Number(sessionCapacityPm);
        payload.sessionAmEndHour = Number(morningCutoffHour);
        payload.sessionPmStartHour = Number(morningCutoffHour);
        payload.sessionPmEndHour = Number(afternoonCutoffHour);
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
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const isSession = schedulingMode === "session_capacity";

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Settings</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {settings.name} · {settings.timezone}
        </p>
      </div>

      <Section title="Reminders" description="When patients get their SMS reminder.">
        <label className="flex max-w-xs flex-col gap-1 text-sm font-medium text-neutral-700">
          Days before appointment
          <Input
            type="number"
            min={1}
            value={reminderLeadDays}
            onChange={(e) => setReminderLeadDays(e.target.value)}
            required
          />
        </label>
      </Section>

      <Section title="Business hours" description="Patients can only book on these days and times.">
        <div className="space-y-2">
          <p className="text-sm font-medium text-neutral-700">Open days</p>
          <div className="grid grid-cols-7 gap-1.5">
            {WEEKDAYS.map(({ value, label }) => {
              const on = openDays.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setOpenDays((days) => (on ? days.filter((d) => d !== value) : [...days, value]))}
                  className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                    on
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-neutral-300 bg-white text-neutral-500 hover:bg-neutral-50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <HourSelect label="Opens" value={openHour} onChange={setOpenHour} max={23} />
          <HourSelect label="Closes" value={closeHour} onChange={setCloseHour} min={1} />
        </div>
      </Section>

      <Section title="Scheduling mode" description="How patients pick a schedule when booking.">
        <div role="radiogroup" aria-label="Scheduling mode" className="grid gap-3 sm:grid-cols-2">
          <ModeOption
            checked={!isSession}
            onSelect={() => setSchedulingMode("fixed_time")}
            title="Fixed time slots"
            description="Patients pick an exact 30-minute time, e.g. 9:30 AM."
          />
          <ModeOption
            checked={isSession}
            onSelect={() => setSchedulingMode("session_capacity")}
            title="Morning / Afternoon sessions"
            description="Patients pick a session; each has a patient limit."
          />
        </div>

        {isSession && (
          <div className="space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <HourSelect
                label="Morning cutoff"
                value={morningCutoffHour}
                onChange={setMorningCutoffHour}
                min={Math.min(Number(openHour) + 1, 23)}
                max={Math.max(Number(closeHour) - 1, 1)}
              />
              <HourSelect
                label="Afternoon cutoff"
                value={afternoonCutoffHour}
                onChange={setAfternoonCutoffHour}
                min={Math.min(Number(morningCutoffHour) + 1, 24)}
                max={Number(closeHour)}
              />
            </div>
          </div>
        )}
      </Section>

      <div className="flex items-center justify-end border-t border-neutral-200 pt-4">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white">
      <header className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
      </header>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </section>
  );
}

function ModeOption({
  checked,
  onSelect,
  title,
  description,
}: {
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
        checked ? "border-brand-700 bg-brand-50 ring-1 ring-brand-700" : "border-neutral-200 hover:bg-neutral-50"
      }`}
    >
      <span
        aria-hidden
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-brand-700" : "border-neutral-400"
        }`}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-brand-700" />}
      </span>
      <span>
        <span className="block text-sm font-semibold text-neutral-900">{title}</span>
        <span className="mt-0.5 block text-sm text-neutral-500">{description}</span>
      </span>
    </button>
  );
}
