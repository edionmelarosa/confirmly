"use client";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AvailableSlotDto, RescheduleSessionResponse } from "@confirmly/shared-types";
import { formatInClinicTz } from "./format";
import { PatientButton } from "./PatientButton";

interface RescheduleViewProps {
  token: string;
  session: RescheduleSessionResponse;
  onRescheduled: (newTime: string) => void;
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
        const slotDate = new Date(slot.date + "T12:00:00");
        onRescheduled(slotDate.toISOString());
      } else {
        await apiClient.post(`/api/patient/session/${token}/reschedule`, {
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
        });
        onRescheduled(slot.startsAt);
      }
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
      return `${label} (${slot.remaining} left)`;
    }
    return formatInClinicTz(slot.startsAt, clinic.timezone);
  }

  function getSlotDate(slot: AvailableSlotDto): string {
    if (slot.kind === "session") {
      return slot.date;
    }
    return new Date(slot.startsAt).toISOString().split("T")[0];
  }

  function groupSlotsByDate(slots: AvailableSlotDto[]): Map<string, AvailableSlotDto[]> {
    const grouped = new Map<string, AvailableSlotDto[]>();
    for (const slot of slots) {
      const date = getSlotDate(slot);
      if (!grouped.has(date)) {
        grouped.set(date, []);
      }
      grouped.get(date)!.push(slot);
    }
    return grouped;
  }

  function formatDateHeader(dateStr: string): string {
    const date = new Date(dateStr + "T12:00:00");
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    ) {
      return "Today";
    }

    if (
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate()
    ) {
      return "Tomorrow";
    }

    return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
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
        <div className="flex flex-col gap-4">
          {submitError && <p className="text-status-cancelled">{submitError}</p>}
          {slots.length === 0 ? (
            <p className="text-neutral-500">Loading available times…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {Array.from(groupSlotsByDate(slots)).map(([date, dateSlots]) => (
                <div key={date} className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold text-neutral-700">{formatDateHeader(date)}</h3>
                  <ul className="flex flex-col gap-2">
                    {dateSlots.map((slot) => (
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
