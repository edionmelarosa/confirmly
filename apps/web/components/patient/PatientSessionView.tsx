"use client";

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type { AvailableSlotDto, PatientSessionResponse } from "@confirmly/shared-types";

interface PatientSessionViewProps {
  token: string;
}

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; session: PatientSessionResponse }
  | { status: "rescheduled" };

function formatInClinicTz(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PatientSessionView({ token }: PatientSessionViewProps) {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [slots, setSlots] = useState<AvailableSlotDto[]>([]);
  const [showSlots, setShowSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<PatientSessionResponse>(`/api/patient/session/${token}`)
      .then((session) => setState({ status: "ready", session }))
      .catch((err) => {
        const message =
          err instanceof ApiError && err.status === 410
            ? "This link has expired or was already used."
            : "Something went wrong loading your appointment.";
        setState({ status: "error", message });
      });
  }, [token]);

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
      await apiClient.post(`/api/patient/session/${token}/reschedule`, {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
      });
      setState({ status: "rescheduled" });
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

  if (state.status === "loading") {
    return <p className="text-center text-neutral-500">Loading your appointment…</p>;
  }

  if (state.status === "error") {
    return <p className="text-center text-red-600">{state.message}</p>;
  }

  if (state.status === "rescheduled") {
    return (
      <div className="text-center">
        <p className="text-lg font-medium text-green-700">Your appointment has been rescheduled.</p>
        <p className="mt-2 text-neutral-600">A confirmation SMS has been sent to your phone.</p>
      </div>
    );
  }

  const { appointment, clinic } = state.session;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{clinic.name}</h1>
        <p className="mt-1 text-neutral-700">
          Current appointment: {formatInClinicTz(appointment.startsAt, clinic.timezone)}
        </p>
        <p className="text-sm text-neutral-500">Status: {appointment.status}</p>
      </div>

      {!showSlots ? (
        <button
          onClick={loadSlots}
          className="rounded-lg bg-neutral-900 px-4 py-3 text-white active:bg-neutral-700"
        >
          Choose a new time
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {submitError && <p className="text-red-600">{submitError}</p>}
          {slots.length === 0 ? (
            <p className="text-neutral-500">Loading available times…</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {slots.map((slot) => (
                <li key={slot.startsAt}>
                  <button
                    onClick={() => handlePickSlot(slot)}
                    disabled={submitting}
                    className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-left active:bg-neutral-100"
                  >
                    {formatInClinicTz(slot.startsAt, clinic.timezone)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
