"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { UserPlus, Search, Send, Pencil } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";
import { toDateInputValue } from "@/components/calendar/slots";

interface PatientRow {
  id: string;
  name: string;
  phone: string;
  service: string | null;
  scheduleType: string | null;
  scheduleDetails: string | null;
  nextSchedule: string | null;
  // The patient's current booking, if any (API returns at most one).
  appointments: {
    startsAt: string;
    status: "scheduled" | "confirmed";
    isSessionCapacity: boolean;
    sessionOfDay: "am" | "pm" | null;
  }[];
  recurrenceRules: { status: string; ruleType: string }[];
  // Pending (unused, unexpired) invite-to-book link, if any.
  accessTokens: { createdAt: string; expiresAt: string }[];
}

type CadenceOption = "none" | "every_3_weeks" | "every_month" | "every_day_of_month";

interface ClientFormValues {
  name: string;
  phone: string;
  cadence: CadenceOption;
  dayOfMonth: string;
  nextSchedule: string;
  service: string;
}

const EMPTY_FORM: ClientFormValues = {
  name: "",
  phone: "",
  cadence: "every_3_weeks",
  dayOfMonth: "1",
  nextSchedule: "",
  service: "",
};

function formValuesFromPatient(p: PatientRow): ClientFormValues {
  let cadence: CadenceOption = "none";
  let dayOfMonth = "1";
  const details = p.scheduleDetails?.trim() ?? "";
  const day = /^day\s*(\d+)$/i.exec(details);
  if (day) {
    cadence = "every_day_of_month";
    dayOfMonth = day[1];
  } else if (/^3\s*weeks?$/i.test(details)) {
    cadence = "every_3_weeks";
  } else if (/^1\s*months?$/i.test(details)) {
    cadence = "every_month";
  }
  return {
    name: p.name,
    phone: p.phone,
    cadence,
    dayOfMonth,
    nextSchedule: p.nextSchedule ? toDateInputValue(new Date(p.nextSchedule)) : "",
    service: p.service ?? "",
  };
}

function cadenceFields(values: ClientFormValues): { scheduleType: string | null; scheduleDetails: string | null } {
  switch (values.cadence) {
    case "every_3_weeks":
      return { scheduleType: "Every 3 weeks", scheduleDetails: "3 weeks" };
    case "every_month":
      return { scheduleType: "Every month", scheduleDetails: "1 month" };
    case "every_day_of_month":
      return { scheduleType: "Every day of month", scheduleDetails: `Day ${values.dayOfMonth}` };
    default:
      return { scheduleType: null, scheduleDetails: null };
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatBooking(a: PatientRow["appointments"][number]): string {
  if (a.isSessionCapacity && a.sessionOfDay) {
    return `${formatDate(a.startsAt)} · ${a.sessionOfDay === "am" ? "Morning" : "Afternoon"}`;
  }
  return new Date(a.startsAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function PatientsPage() {
  const toast = useToast();
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [query, setQuery] = useState("");
  // null = closed, "new" = add dialog, otherwise the patient being edited
  const [editing, setEditing] = useState<PatientRow | "new" | null>(null);
  const [form, setForm] = useState<ClientFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [invitingPatientId, setInvitingPatientId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiClient.get<PatientRow[]>("/patients");
      setPatients(data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load patients");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!patients) return [];
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q),
    );
  }, [patients, query]);

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditing("new");
  }

  function openEdit(p: PatientRow) {
    setForm(formValuesFromPatient(p));
    setEditing(p);
  }

  function updateForm(patch: Partial<ClientFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;

    const phone = form.phone.replace(/\s+/g, "");
    // Phone validation for PH numbers
    if (!/^(\+639|09)\d{9}$/.test(phone)) {
      toast.error("Invalid phone number. Use format +639XXXXXXXXX or 09XXXXXXXXX");
      return;
    }

    const { scheduleType, scheduleDetails } = cadenceFields(form);
    const nextSchedule = form.nextSchedule ? new Date(`${form.nextSchedule}T00:00:00`).toISOString() : null;
    const service = form.service.trim();

    setSubmitting(true);
    try {
      if (editing === "new") {
        const payload: Record<string, unknown> = { name: form.name, phone, mode: "create" };
        if (scheduleType) {
          payload.scheduleType = scheduleType;
          payload.scheduleDetails = scheduleDetails;
        }
        if (nextSchedule) payload.nextSchedule = nextSchedule;
        if (service) payload.service = service;
        await apiClient.post("/patients", payload);
        toast.success("Client added.");
      } else {
        await apiClient.patch(`/patients/${editing.id}`, {
          name: form.name,
          phone,
          service: service || null,
          scheduleType,
          scheduleDetails,
          nextSchedule,
        });
        toast.success("Client updated.");
      }
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInviteToBook(patientId: string) {
    setInvitingPatientId(patientId);
    try {
      await apiClient.post(`/patients/${patientId}/invite-to-book`, {});
      toast.success("Booking link sent via SMS.");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invite");
      if (err instanceof ApiError && (err.code === "already_booked" || err.code === "invite_already_sent")) {
        await load();
      }
    } finally {
      setInvitingPatientId(null);
    }
  }

  const today = toDateInputValue(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Patients</h1>
        <Button type="button" onClick={openAdd}>
          <UserPlus className="h-4 w-4" />
          Add client
        </Button>
      </div>

      <label className="flex max-w-sm items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm">
        <Search className="h-4 w-4 text-neutral-400" />
        <input
          className="w-full outline-none"
          placeholder="Search name or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>

      {patients === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No patients yet"
          description="Add a client to set up recurring visits, or book an appointment from the calendar."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Schedule</th>
                <th className="px-3 py-2">Next</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const booking = p.appointments[0];
                const pendingInvite = p.accessTokens[0];
                const rule = p.recurrenceRules[0];
                const nextDue = p.nextSchedule && toDateInputValue(new Date(p.nextSchedule)) <= today;
                return (
                  <tr key={p.id} className="border-b border-neutral-100 text-sm hover:bg-brand-50/40">
                    <td className="px-3 py-2 font-medium text-neutral-900">
                      <Link href={`/dashboard/patients/${p.id}`} className="text-brand-700 hover:underline">
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">{p.phone}</td>
                    <td className="px-3 py-2 text-neutral-600">
                      {p.service || <span className="text-neutral-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      <div className="flex flex-col gap-0.5">
                        {booking ? (
                          <span className="flex flex-wrap items-center gap-2">
                            {formatBooking(booking)}
                            <Badge status={booking.status}>{booking.status}</Badge>
                          </span>
                        ) : (
                          <span className="text-neutral-400">Not booked</span>
                        )}
                        {p.scheduleType ? (
                          <span className="text-xs text-neutral-500">{p.scheduleType}</span>
                        ) : rule ? (
                          <span className="text-xs text-neutral-500">Recurring ({rule.status})</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {p.nextSchedule ? (
                        <span className={nextDue && !booking ? "font-medium text-amber-700" : undefined}>
                          {formatDate(p.nextSchedule)}
                          {nextDue && !booking ? " · due" : ""}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {!booking && pendingInvite && (
                          <span
                            className="text-xs text-neutral-500"
                            title={`Sent ${new Date(pendingInvite.createdAt).toLocaleString()}`}
                          >
                            Invite sent · expires{" "}
                            {new Date(pendingInvite.expiresAt).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                        {!booking && !pendingInvite && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => handleInviteToBook(p.id)}
                            disabled={invitingPatientId === p.id}
                          >
                            <Send className="h-3 w-3" />
                            {invitingPatientId === p.id ? "Sending..." : "Invite to book"}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(p)}
                          aria-label={`Edit ${p.name}`}
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <Dialog open onClose={() => setEditing(null)}>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editing === "new" ? "Add client" : "Edit client"}</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Name
                <Input value={form.name} onChange={(e) => updateForm({ name: e.target.value })} required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Phone
                <Input
                  value={form.phone}
                  onChange={(e) => updateForm({ phone: e.target.value })}
                  placeholder="+639171234567 or 09171234567"
                  required
                />
                <span className="text-xs text-neutral-500">Format: +639XXXXXXXXX or 09XXXXXXXXX</span>
              </label>
              <fieldset className="flex flex-col gap-2 text-sm">
                <legend className="font-medium text-neutral-700">Schedule type</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={form.cadence === "none"}
                    onChange={() => updateForm({ cadence: "none" })}
                  />
                  No recurring schedule
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={form.cadence === "every_3_weeks"}
                    onChange={() => updateForm({ cadence: "every_3_weeks" })}
                  />
                  Every 3 weeks
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={form.cadence === "every_month"}
                    onChange={() => updateForm({ cadence: "every_month" })}
                  />
                  Every month
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={form.cadence === "every_day_of_month"}
                    onChange={() => updateForm({ cadence: "every_day_of_month" })}
                  />
                  Every day
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={form.dayOfMonth}
                    onChange={(e) => updateForm({ dayOfMonth: e.target.value })}
                    disabled={form.cadence !== "every_day_of_month"}
                    className="w-16 inline-block"
                  />
                  of the month
                </label>
              </fieldset>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Next schedule
                <Input
                  type="date"
                  value={form.nextSchedule}
                  onChange={(e) => updateForm({ nextSchedule: e.target.value })}
                />
                <span className="text-xs text-neutral-500">
                  Updated automatically from the schedule type when a visit is booked, completed, cancelled or
                  missed.
                </span>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Service
                <Input
                  value={form.service}
                  onChange={(e) => updateForm({ service: e.target.value })}
                  placeholder="e.g. Cleaning, Extraction"
                />
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editing === "new" ? "Add client" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
