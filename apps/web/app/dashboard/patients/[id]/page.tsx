"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiClient, ApiError } from "@/lib/api-client";
import type { ClinicSettingsDto, RecurrenceRuleDto } from "@confirmly/shared-types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/ToastProvider";

interface PatientDetail {
  id: string;
  name: string;
  phone: string;
  appointments: {
    id: string;
    startsAt: string;
    endsAt: string;
    status: string;
    followUpOfAppointmentId: string | null;
    recurrenceRuleId: string | null;
    isSessionCapacity: boolean;
    sessionOfDay: string | null;
  }[];
  recurrenceRules: RecurrenceRuleDto[];
}

export default function PatientDetailPage() {
  const params = useParams<{ id: string }>();
  const toast = useToast();
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [settings, setSettings] = useState<ClinicSettingsDto | null>(null);
  const [ruleType, setRuleType] = useState<"every_n_weeks" | "day_of_month">("every_n_weeks");
  const [intervalWeeks, setIntervalWeeks] = useState("2");
  const [dayOfMonth, setDayOfMonth] = useState("15");
  const [sessionOfDay, setSessionOfDay] = useState<"am" | "pm">("am");
  const [firstStartsAt, setFirstStartsAt] = useState("");
  const [firstDate, setFirstDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const [p, s] = await Promise.all([
        apiClient.get<PatientDetail>(`/patients/${params.id}`),
        apiClient.get<ClinicSettingsDto>("/clinic-settings"),
      ]);
      setPatient(p);
      setSettings(s);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load patient");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleCreateRule(event: FormEvent) {
    event.preventDefault();
    if (!patient || !settings) return;
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        ruleType,
        intervalWeeks: ruleType === "every_n_weeks" ? Number(intervalWeeks) : null,
        dayOfMonth: ruleType === "day_of_month" ? Number(dayOfMonth) : null,
      };
      if (settings.schedulingMode === "session_capacity") {
        body.sessionOfDay = sessionOfDay;
        body.firstDate = firstDate;
      } else {
        body.firstStartsAt = new Date(firstStartsAt).toISOString();
      }
      await apiClient.post(`/patients/${patient.id}/recurrence-rules`, body);
      toast.success("Recurrence rule created.");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchRule(id: string, status: "active" | "paused" | "cancelled") {
    try {
      await apiClient.patch(`/recurrence-rules/${id}`, { status });
      toast.success(`Rule ${status}.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (!patient || !settings) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const activeRule = patient.recurrenceRules.find((r) => r.status === "active" || r.status === "paused");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/patients" className="text-sm text-brand-700 hover:underline">
          ← Patients
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-neutral-900">{patient.name}</h1>
        <p className="text-sm text-neutral-600">{patient.phone}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recurrence</CardTitle>
          <CardDescription>
            One active rule per patient. Completing a visit generates the next; no-show pauses the rule.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeRule ? (
            <div className="space-y-3 rounded-md border border-neutral-200 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge status={activeRule.status === "active" ? "confirmed" : "scheduled"}>
                  {activeRule.status}
                </Badge>
                <span>
                  {activeRule.ruleType === "every_n_weeks"
                    ? `Every ${activeRule.intervalWeeks} week(s)`
                    : `Day ${activeRule.dayOfMonth} of each month`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeRule.status === "active" ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => patchRule(activeRule.id, "paused")}>
                    Pause
                  </Button>
                ) : (
                  <Button type="button" variant="secondary" size="sm" onClick={() => patchRule(activeRule.id, "active")}>
                    Resume
                  </Button>
                )}
                <Button type="button" variant="destructive" size="sm" onClick={() => patchRule(activeRule.id, "cancelled")}>
                  Cancel rule
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateRule} className="flex max-w-md flex-col gap-3">
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="font-medium text-neutral-700">Cadence</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ruleType"
                    checked={ruleType === "every_n_weeks"}
                    onChange={() => setRuleType("every_n_weeks")}
                  />
                  Every N weeks
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="ruleType"
                    checked={ruleType === "day_of_month"}
                    onChange={() => setRuleType("day_of_month")}
                  />
                  Day of month
                </label>
              </fieldset>
              {ruleType === "every_n_weeks" ? (
                <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                  Interval (weeks)
                  <Input type="number" min={1} value={intervalWeeks} onChange={(e) => setIntervalWeeks(e.target.value)} required />
                </label>
              ) : (
                <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                  Day of month (1–31)
                  <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} required />
                </label>
              )}
              {settings.schedulingMode === "session_capacity" ? (
                <>
                  <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                    First session date
                    <Input type="date" value={firstDate} onChange={(e) => setFirstDate(e.target.value)} required />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                    Session
                    <select
                      className="rounded-md border border-neutral-300 px-3 py-2"
                      value={sessionOfDay}
                      onChange={(e) => setSessionOfDay(e.target.value as "am" | "pm")}
                    >
                      <option value="am">Morning</option>
                      <option value="pm">Afternoon</option>
                    </select>
                  </label>
                </>
              ) : (
                <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                  First appointment
                  <Input type="datetime-local" value={firstStartsAt} onChange={(e) => setFirstStartsAt(e.target.value)} required />
                </label>
              )}
              <Button type="submit" disabled={submitting} className="self-start">
                {submitting ? "Creating..." : "Create recurrence rule"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointment history</CardTitle>
        </CardHeader>
        <CardContent>
          {patient.appointments.length === 0 ? (
            <p className="text-sm text-neutral-500">No appointments yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 text-sm">
              {patient.appointments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {a.isSessionCapacity
                      ? `${new Date(a.startsAt).toLocaleDateString()} · ${a.sessionOfDay === "am" ? "Morning" : "Afternoon"}`
                      : new Date(a.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                    {a.followUpOfAppointmentId ? (
                      <span className="ml-2 text-neutral-500">· Followup</span>
                    ) : null}
                    {a.recurrenceRuleId ? (
                      <span className="ml-2 text-neutral-500">· Recurring</span>
                    ) : null}
                  </span>
                  <Badge status={a.status as "scheduled" | "confirmed" | "cancelled" | "no_show" | "completed"}>{a.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
