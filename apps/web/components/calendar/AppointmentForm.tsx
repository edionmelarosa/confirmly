"use client";

import { useState, type FormEvent } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AppointmentDto } from "@confirmly/shared-types";

interface AppointmentFormProps {
  startsAt: Date;
  endsAt: Date;
  existing: AppointmentDto | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AppointmentForm({ startsAt, endsAt, existing, onClose, onSaved }: AppointmentFormProps) {
  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const patient = await apiClient.post<{ id: string }>("/patients", {
        name: patientName,
        phone: patientPhone,
      });

      await apiClient.post("/appointments", {
        patientId: patient.id,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });

      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError("This slot was just booked by someone else. Pick another slot.");
      } else {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!existing) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post(`/appointments/${existing.id}/cancel`);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ background: "white", padding: 24, borderRadius: 8, minWidth: 320 }}>
        <h2>
          {existing ? "Appointment" : "New appointment"} —{" "}
          {startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
        </h2>

        {existing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p>Status: {existing.status}</p>
            {error && <p style={{ color: "crimson" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCancel} disabled={submitting || existing.status === "cancelled"}>
                Cancel appointment
              </button>
              <button onClick={onClose} type="button">
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label>
              Patient name
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                required
              />
            </label>
            <label>
              Patient phone
              <input
                value={patientPhone}
                onChange={(e) => setPatientPhone(e.target.value)}
                placeholder="+639171234567"
                required
              />
            </label>
            {error && <p style={{ color: "crimson" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Book slot"}
              </button>
              <button type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
