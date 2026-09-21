"use client";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AvailableSlotDto, RescheduleSessionResponse } from "@confirmly/shared-types";
import { formatInClinicTz } from "./format";
import { PatientButton } from "./PatientButton";

interface RescheduleViewProps {
  token: string;
  session: RescheduleSessionResponse;
  onRescheduled: () => void;
}

export function RescheduleView({ token, session, onRescheduled }: RescheduleViewProps) {
  const [slots, setSlots] = useState<AvailableSlotDto[]>([]);
  const [showSlots, setShowSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { appointment, clinic } = session;

  async function loadSlots() {
    setShowSlots(true);
    try {
      const result = await apiClient.get<{ slots: AvailableSlotDto[] }>(`/api/patient/session/${token}/slots`);
      setSlots(result.slots);
    } catch {
      setSubmitError("Couldn't load available times. Please try again.");
    }
  }

  async function handlePickSlot(slot: AvailableSlotDto) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (slot.kind === "session") {
        await apiClient.post(`/api/patient/session/${token}/reschedule`, {
          date: slot.date,
          sessionOfDay: slot.sessionOfDay,
        });
      } else {
        await apiClient.post(`/api/patient/session/${token}/reschedule`, {
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
        });
      }
      onRescheduled();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError("That time was just taken. Please pick another.");
      } else if (err instanceof ApiError && err.status === 410) {
        setSubmitError("This link has expired or was already used.");
      } else {
        setSubmitError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function slotKey(slot: AvailableSlotDto): string {
    return slot.kind === "session" ? `${slot.date}-${slot.sessionOfDay}` : slot.startsAt;
  }

  function slotLabel(slot: AvailableSlotDto): string {
    if (slot.kind === "session") {
      const label = slot.sessionOfDay === "am" ? "Morning" : "Afternoon";
      return `${slot.date} · ${label} (${slot.remaining} left)`;
    }
    return formatInClinicTz(slot.startsAt, clinic.timezone);
  }

  const currentLabel =
    appointment.isSessionCapacity && appointment.sessionOfDay
      ? `${new Date(appointment.startsAt).toLocaleDateString()} · ${
          appointment.sessionOfDay === "am" ? "Morning" : "Afternoon"
        }`
      : formatInClinicTz(appointment.startsAt, clinic.timezone);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{clinic.name}</h1>
        <p className="mt-1 text-neutral-700">Current appointment: {currentLabel}</p>
        <p className="text-sm text-neutral-500">Status: {appointment.status}</p>
      </div>

      {!showSlots ? (
        <PatientButton onClick={loadSlots}>Choose a new time</PatientButton>
      ) : (
        <div className="flex flex-col gap-2">
          {submitError && <p className="text-status-cancelled">{submitError}</p>}
          {slots.length === 0 ? (
            <p className="text-neutral-500">Loading available times…</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {slots.map((slot) => (
                <li key={slotKey(slot)}>
                  <PatientButton
                    variant="secondary"
                    onClick={() => handlePickSlot(slot)}
                    disabled={submitting}
                    className="w-full text-left"
                  >
                    {slotLabel(slot)}
                  </PatientButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
