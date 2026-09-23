"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AppointmentDto } from "@confirmly/shared-types";
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/Dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ui/ToastProvider";

interface AppointmentFormProps {
  startsAt: Date;
  endsAt: Date;
  existing: AppointmentDto | null;
  onClose: () => void;
  onSaved: () => void;
}

type PendingAction = "cancel" | "no_show" | null;

export function AppointmentForm({ startsAt, endsAt, existing, onClose, onSaved }: AppointmentFormProps) {
  const toast = useToast();
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [service, setService] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [priorVisits, setPriorVisits] = useState<AppointmentDto[]>([]);
  const [followUpOfAppointmentId, setFollowUpOfAppointmentId] = useState("");

  useEffect(() => {
    if (existing) return;
    apiClient
      .get<AppointmentDto[]>("/appointments")
      .then((rows) => {
        setPriorVisits(
          rows
            .filter((a) => a.status === "completed" || a.status === "confirmed" || a.status === "scheduled")
            .slice()
            .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
            .slice(0, 30),
        );
      })
      .catch(() => {
        /* optional field — ignore load errors */
      });
  }, [existing]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const patient = await apiClient.post<{ id: string }>("/patients", {
        name: patientName,
        phone: patientPhone,
        ...(service.trim() ? { service: service.trim() } : {}),
      });

      await apiClient.post("/appointments", {
        patientId: patient.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        followUpOfAppointmentId: followUpOfAppointmentId || null,
      });

      toast.success("Appointment booked.");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_booked") {
        toast.error(err.message);
      } else if (err instanceof ApiError && err.status === 409) {
        toast.error("This slot was just booked by someone else. Pick another slot.");
      } else {
        toast.error(err instanceof ApiError ? err.message : "Something went wrong");
      }
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!existing) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/appointments/${existing.id}/cancel`);
      toast.success("Appointment cancelled.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  async function handleStatusOverride(status: "confirmed" | "no_show" | "completed") {
    if (!existing) return;
    setSubmitting(true);
    try {
      await apiClient.patch(`/appointments/${existing.id}`, { status });
      toast.success(
        status === "no_show"
          ? "Marked as no-show."
          : status === "completed"
            ? "Marked completed."
            : "Appointment confirmed.",
      );
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  async function handleResendReminder() {
    if (!existing) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/appointments/${existing.id}/resend-reminder`);
      toast.success("Reminder sent.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open onClose={onClose}>
        <DialogHeader>
          <DialogTitle>
            {existing ? "Appointment" : "New appointment"} —{" "}
            {startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </DialogTitle>
        </DialogHeader>

        {existing ? (
          <>
            <DialogBody className="flex flex-col gap-4">
              <div className="flex items-center gap-2 text-sm text-neutral-600">
                Status: <Badge status={existing.status}>{existing.status.replace("_", " ")}</Badge>
              </div>
              {existing.followUpOfAppointmentId ? (
                <p className="text-sm text-neutral-600">Followup to a prior visit</p>
              ) : null}
              {existing.recurrenceRuleId ? (
                <p className="text-sm text-neutral-600">Part of a recurrence rule</p>
              ) : null}
              {existing.status === "scheduled" || existing.status === "confirmed" ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusOverride("confirmed")}
                    disabled={submitting || existing.status === "confirmed"}
                  >
                    Force confirm
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleStatusOverride("completed")}
                    disabled={submitting}
                  >
                    Mark completed
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingAction("no_show")}
                    disabled={submitting}
                  >
                    Mark no-show
                  </Button>
                  {!existing.reminderSentAt && (
                    <Button variant="secondary" size="sm" onClick={handleResendReminder} disabled={submitting}>
                      Send reminder now
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setPendingAction("cancel")}
                    disabled={submitting}
                  >
                    Cancel appointment
                  </Button>
                </div>
              ) : null}
              {existing.reminderSentAt ? (
                <p className="text-sm text-neutral-500">
                  Reminder sent{" "}
                  {new Date(existing.reminderSentAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleCreate}>
            <DialogBody className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Patient name
                <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Patient phone
                <Input
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                  placeholder="+639171234567"
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Service (optional)
                <Input
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="e.g. Cleaning, Extraction"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-neutral-700">
                Link to a prior visit (optional)
                <select
                  className="rounded-md border border-neutral-300 px-3 py-2"
                  value={followUpOfAppointmentId}
                  onChange={(e) => setFollowUpOfAppointmentId(e.target.value)}
                >
                  <option value="">None</option>
                  {priorVisits.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.startsAt).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}{" "}
                      ({a.status})
                    </option>
                  ))}
                </select>
              </label>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Book slot"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </Dialog>

      <ConfirmDialog
        open={pendingAction === "cancel"}
        title="Cancel this appointment?"
        message="The patient will need to be rebooked separately. This cannot be undone."
        confirmLabel="Cancel appointment"
        cancelLabel="Keep appointment"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          setPendingAction(null);
          handleCancel();
        }}
      />

      <ConfirmDialog
        open={pendingAction === "no_show"}
        title="Mark as no-show?"
        message="This records that the patient did not show up for this appointment."
        confirmLabel="Mark no-show"
        cancelLabel="Cancel"
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          setPendingAction(null);
          handleStatusOverride("no_show");
        }}
      />
    </>
  );
}
