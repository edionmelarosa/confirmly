"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { RefreshCw } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AppointmentDto, ClinicSettingsDto } from "@confirmly/shared-types";
import { toDateInputValue } from "./slots";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/ToastProvider";

type SessionKey = "am" | "pm";

export function SessionCapacityView() {
  const toast = useToast();
  const [day, setDay] = useState(() => new Date());
  const [appointments, setAppointments] = useState<AppointmentDto[] | null>(null);
  const [settings, setSettings] = useState<ClinicSettingsDto | null>(null);
  const [patients, setPatients] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [booking, setBooking] = useState<SessionKey | null>(null);
  const [patientId, setPatientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<SessionKey | null>("am");
  const [refreshing, setRefreshing] = useState(false);

  const dateYmd = toDateInputValue(day);

  const fetchAll = useCallback(async () => {
    try {
      const [apts, clinic, pts] = await Promise.all([
        apiClient.get<AppointmentDto[]>("/appointments"),
        apiClient.get<ClinicSettingsDto>("/clinic-settings"),
        apiClient.get<{ id: string; name: string; phone: string }[]>("/patients"),
      ]);
      setAppointments(apts);
      setSettings(clinic);
      setPatients(pts);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load sessions");
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const bySession = useMemo(() => {
    const result: Record<SessionKey, AppointmentDto[]> = { am: [], pm: [] };
    if (!appointments) return result;
    for (const a of appointments) {
      if (!a.isSessionCapacity || a.status === "cancelled" || a.status === "no_show") continue;
      const local = new Date(a.startsAt);
      const ymd = toDateInputValue(local);
      if (ymd !== dateYmd) continue;
      const key = (a.sessionOfDay ?? "am") as SessionKey;
      result[key].push(a);
    }
    return result;
  }, [appointments, dateYmd]);

  async function handleBook(event: FormEvent) {
    event.preventDefault();
    if (!booking) return;
    setSubmitting(true);
    try {
      let pid = patientId;
      if (!pid) {
        const created = await apiClient.post<{ id: string }>("/patients", {
          name: newName,
          phone: newPhone,
        });
        pid = created.id;
      }
      await apiClient.post("/appointments", {
        mode: "session_capacity",
        patientId: pid,
        date: dateYmd,
        sessionOfDay: booking,
      });
      toast.success("Booked into session.");
      setBooking(null);
      setPatientId("");
      setNewName("");
      setNewPhone("");
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function markStatus(id: string, status: "completed" | "confirmed" | "no_show") {
    try {
      await apiClient.patch(`/appointments/${id}`, { status });
      toast.success(`Marked ${status.replace("_", " ")}.`);
      await fetchAll();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function resendReminder(id: string) {
    try {
      await apiClient.post(`/appointments/${id}/resend-reminder`);
      toast.success("Reminder resent.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (!appointments || !settings) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full max-w-md" />
      </div>
    );
  }

  const caps = {
    am: settings.sessionCapacityAm ?? 0,
    pm: settings.sessionCapacityPm ?? 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
          Date
          <Input type="date" value={dateYmd} onChange={(e) => setDay(new Date(`${e.target.value}T00:00:00`))} />
        </label>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setRefreshing(true);
            fetchAll();
          }}
          disabled={refreshing}
        >
          <RefreshCw className={refreshing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {(["am", "pm"] as const).map((key) => {
        const list = bySession[key];
        const cap = caps[key];
        const label = key === "am" ? "Morning" : "Afternoon";
        const full = cap > 0 && list.length >= cap;
        return (
          <div key={key} className="max-w-lg rounded-md border border-neutral-200">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-3 text-left text-sm"
              onClick={() => setExpanded(expanded === key ? null : key)}
            >
              <span className="font-medium text-neutral-900">
                {label}: {list.length}/{cap || "—"} booked
              </span>
              <Button
                type="button"
                size="sm"
                disabled={full || cap < 1}
                onClick={(e) => {
                  e.stopPropagation();
                  setBooking(key);
                }}
              >
                + Book
              </Button>
            </button>
            {expanded === key && (
              <ul className="border-t border-neutral-100 divide-y divide-neutral-100">
                {list.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-neutral-500">No patients in this session.</li>
                ) : (
                  list.map((a) => {
                    const patient = patients.find((p) => p.id === a.patientId);
                    return (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                        <div>
                          <div className="font-medium">{patient?.name ?? a.patientId}</div>
                          <div className="text-neutral-500">{patient?.phone}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge status={a.status}>{a.status.replace("_", " ")}</Badge>
                          <Button type="button" size="sm" variant="secondary" onClick={() => resendReminder(a.id)}>
                            Send reminder
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => markStatus(a.id, "completed")}>
                            Complete
                          </Button>
                          <Button type="button" size="sm" variant="secondary" onClick={() => markStatus(a.id, "no_show")}>
                            No-show
                          </Button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            )}
          </div>
        );
      })}

      {booking && (
        <Dialog open onClose={() => setBooking(null)}>
          <form onSubmit={handleBook}>
            <DialogHeader>
              <DialogTitle>
                Book {booking === "am" ? "Morning" : "Afternoon"} — {dateYmd}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Existing patient
                <select
                  className="rounded-md border border-neutral-300 px-3 py-2"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                >
                  <option value="">— New patient —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </label>
              {!patientId && (
                <>
                  <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                    Name
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </label>
                  <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                    Phone
                    <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} required />
                  </label>
                </>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setBooking(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Booking..." : "Book"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
