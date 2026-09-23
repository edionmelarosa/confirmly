"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { UserPlus, Search, Send } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

interface PatientRow {
  id: string;
  name: string;
  phone: string;
  service: string | null;
  scheduleType: string | null;
  scheduleDetails: string | null;
  nextSchedule: string | null;
  appointments: { startsAt: string }[];
  recurrenceRules: { status: string; ruleType: string }[];
}

export default function PatientsPage() {
  const toast = useToast();
  const [patients, setPatients] = useState<PatientRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [scheduleTypeOption, setScheduleTypeOption] = useState<"every_3_weeks" | "every_month" | "every_day_of_month">("every_3_weeks");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [nextSchedule, setNextSchedule] = useState("");
  const [service, setService] = useState("");
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

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    
    // Phone validation for PH numbers
    const phoneRegex = /^(\+639|09)\d{9}$/;
    if (!phoneRegex.test(phone.replace(/\s+/g, ""))) {
      toast.error("Invalid phone number. Use format +639XXXXXXXXX or 09XXXXXXXXX");
      return;
    }
    
    setSubmitting(true);
    try {
      // Build schedule type and details
      let scheduleType = "";
      let scheduleDetails = "";
      
      if (scheduleTypeOption === "every_3_weeks") {
        scheduleType = "Every 3 weeks";
        scheduleDetails = "3 weeks";
      } else if (scheduleTypeOption === "every_month") {
        scheduleType = "Every month";
        scheduleDetails = "1 month";
      } else if (scheduleTypeOption === "every_day_of_month") {
        scheduleType = "Every day of month";
        scheduleDetails = `Day ${dayOfMonth}`;
      }
      
      const payload: any = { name, phone: phone.replace(/\s+/g, ""), mode: "create" };
      if (scheduleType) {
        payload.scheduleType = scheduleType;
        payload.scheduleDetails = scheduleDetails;
      }
      if (nextSchedule) payload.nextSchedule = new Date(nextSchedule).toISOString();
      if (service) payload.service = service;
      
      await apiClient.post("/patients", payload);
      toast.success("Client added.");
      setAddOpen(false);
      setName("");
      setPhone("");
      setScheduleTypeOption("every_3_weeks");
      setDayOfMonth("1");
      setNextSchedule("");
      setService("");
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
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to send invite");
    } finally {
      setInvitingPatientId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-neutral-900">Patients</h1>
        <Button type="button" onClick={() => setAddOpen(true)}>
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
                const next = p.appointments[0];
                const rule = p.recurrenceRules[0];
                const hasNoAppointment = !next;
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
                      {p.scheduleType ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-medium">{p.scheduleType}</span>
                          {p.scheduleDetails && (
                            <span className="text-xs text-neutral-500">{p.scheduleDetails}</span>
                          )}
                        </div>
                      ) : rule ? (
                        <Badge status={rule.status === "active" ? "confirmed" : "scheduled"}>
                          {rule.status}
                        </Badge>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-neutral-600">
                      {next
                        ? new Date(next.startsAt).toLocaleString(undefined, {
                            dateStyle: "short",
                          })
                        : p.nextSchedule
                        ? new Date(p.nextSchedule).toLocaleString(undefined, {
                            dateStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {hasNoAppointment && (
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <Dialog open onClose={() => setAddOpen(false)}>
          <form onSubmit={handleAdd}>
            <DialogHeader>
              <DialogTitle>Add client</DialogTitle>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Name
                <Input value={name} onChange={(e) => setName(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Phone
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                    checked={scheduleTypeOption === "every_3_weeks"}
                    onChange={() => setScheduleTypeOption("every_3_weeks")}
                  />
                  Every 3 weeks
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={scheduleTypeOption === "every_month"}
                    onChange={() => setScheduleTypeOption("every_month")}
                  />
                  Every month
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={scheduleTypeOption === "every_day_of_month"}
                    onChange={() => setScheduleTypeOption("every_day_of_month")}
                  />
                  Every day
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    disabled={scheduleTypeOption !== "every_day_of_month"}
                    className="w-16 inline-block"
                  />
                  of the month
                </label>
              </fieldset>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Next schedule
                <Input
                  type="date"
                  value={nextSchedule}
                  onChange={(e) => setNextSchedule(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Service
                <Input
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="e.g. Cleaning, Extraction"
                />
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Add client"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      )}
    </div>
  );
}
