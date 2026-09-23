"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import type {
  AvailableSlotDto,
  RescheduleSessionResponse,
  ManageSessionResponse,
  InviteToBookSessionResponse,
  SessionAvailableSlotDto,
  SessionOfDay,
} from "@confirmly/shared-types";
import {
  describeSlot,
  formatInClinicTz,
  formatTime,
  formatYmd,
  sessionHoursLabel,
  sessionName,
  slotYmd,
  ymdInTz,
} from "./format";
import { PatientButton } from "./PatientButton";

type SupportedSession = RescheduleSessionResponse | ManageSessionResponse | InviteToBookSessionResponse;

interface RescheduleViewProps {
  token: string;
  session: SupportedSession;
  onRescheduled: (newTime: string, slot?: AvailableSlotDto) => void;
}

// Invite links go straight to the picker; manage/reschedule links first show the current appointment.
type Step = "overview" | "pick" | "confirm";

function slotKey(slot: AvailableSlotDto): string {
  return slot.kind === "session" ? `${slot.date}-${slot.sessionOfDay}` : slot.startsAt;
}

export function RescheduleView({ token, session, onRescheduled }: RescheduleViewProps) {
  const isBooking = session.purpose === "invite_to_book";
  const appointment = isBooking ? undefined : session.appointment;
  const clinic = session.clinic;
  const timeZone = clinic.timezone;

  const [step, setStep] = useState<Step>(isBooking ? "pick" : "overview");
  const [slots, setSlots] = useState<AvailableSlotDto[] | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlotDto | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    try {
      const result = await apiClient.get<{ slots: AvailableSlotDto[] }>(`/api/patient/session/${token}/slots`);
      setSlots(result.slots);
    } catch {
      setError("Couldn't load available dates. Please try again.");
      setSlots([]);
    }
  }, [token]);

  useEffect(() => {
    if (step === "pick" && slots === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch; state is set after the request resolves
      loadSlots();
    }
  }, [step, slots, loadSlots]);

  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, AvailableSlotDto[]>();
    for (const slot of slots ?? []) {
      const ymd = slotYmd(slot, timeZone);
      grouped.set(ymd, [...(grouped.get(ymd) ?? []), slot]);
    }
    return grouped;
  }, [slots, timeZone]);

  const dates = Array.from(slotsByDate.keys());
  const activeDate = selectedDate && slotsByDate.has(selectedDate) ? selectedDate : (dates[0] ?? null);
  const daySlots = activeDate ? (slotsByDate.get(activeDate) ?? []) : [];

  function chooseSlot(slot: AvailableSlotDto) {
    setError(null);
    setSelectedSlot(slot);
    setStep("confirm");
  }

  async function submit() {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    const endpoint = isBooking ? `/api/patient/session/${token}/book` : `/api/patient/session/${token}/reschedule`;
    try {
      if (selectedSlot.kind === "session") {
        await apiClient.post(endpoint, { date: selectedSlot.date, sessionOfDay: selectedSlot.sessionOfDay });
        onRescheduled(new Date(`${selectedSlot.date}T12:00:00`).toISOString(), selectedSlot);
      } else {
        await apiClient.post(endpoint, { startsAt: selectedSlot.startsAt, endsAt: selectedSlot.endsAt });
        onRescheduled(selectedSlot.startsAt, selectedSlot);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === "already_booked") {
        setError("You already have an upcoming appointment. Please contact the clinic to change it.");
      } else if (err instanceof ApiError && err.status === 409) {
        // Taken while the patient was confirming — send them back to a fresh list.
        setError("Sorry, that schedule was just filled. Please choose another.");
        setSlots(null);
        setStep("pick");
      } else if (err instanceof ApiError && err.status === 410) {
        setError("This link has expired or was already used.");
      } else {
        setError("Something went wrong. Please try again or contact the clinic.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelAppointment() {
    if (!confirm("Cancel this appointment?")) return;
    setSubmitting(true);
    try {
      await apiClient.post(`/api/patient/session/${token}/cancel`);
      onRescheduled("");
    } catch {
      setError("Failed to cancel. Please contact the clinic.");
    } finally {
      setSubmitting(false);
    }
  }

  const currentLabel = appointment
    ? appointment.isSessionCapacity && appointment.sessionOfDay
      ? `${formatYmd(ymdInTz(appointment.startsAt, timeZone), { weekday: "short", month: "short", day: "numeric" })} · ${sessionName(appointment.sessionOfDay)}`
      : formatInClinicTz(appointment.startsAt, timeZone)
    : null;

  return (
    <div className="flex flex-col gap-5">
      <header className="border-b border-neutral-200 pb-4">
        <p className="text-3xl font-bold tracking-tight text-brand-700">{clinic.name}</p>
        <h1 className="mt-2 text-lg font-medium text-neutral-700">
          {step === "confirm"
            ? isBooking
              ? "Confirm your booking"
              : "Confirm new schedule"
            : isBooking
              ? "Book your appointment"
              : "Your appointment"}
        </h1>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-status-cancelled-bg px-4 py-3 text-sm text-status-cancelled">
          {error}
        </p>
      )}

      {step === "overview" && appointment && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-500">Current schedule</p>
            <p className="mt-1 text-lg font-medium text-neutral-900">{currentLabel}</p>
            <p className="mt-1 text-sm capitalize text-neutral-500">{appointment.status.replace("_", " ")}</p>
          </div>
          <PatientButton onClick={() => setStep("pick")} disabled={submitting}>
            Reschedule
          </PatientButton>
          {session.purpose === "manage" && (
            <PatientButton variant="secondary" onClick={cancelAppointment} disabled={submitting}>
              Cancel appointment
            </PatientButton>
          )}
        </div>
      )}

      {step === "pick" && (
        <div className="flex flex-col gap-5">
          {slots === null ? (
            <PickerSkeleton />
          ) : dates.length === 0 ? (
            <p className="rounded-xl border border-neutral-200 bg-white p-4 text-neutral-600">
              No schedules are available in the next two weeks. Please contact the clinic.
            </p>
          ) : (
            <>
              <section className="flex flex-col gap-2">
                <h2 className="text-sm font-semibold text-neutral-700">1. Select a date</h2>
                <div className="-mx-4 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1">
                  {dates.map((ymd) => {
                    const active = ymd === activeDate;
                    return (
                      <button
                        key={ymd}
                        type="button"
                        aria-pressed={active}
                        aria-label={formatYmd(ymd, { weekday: "long", month: "long", day: "numeric" })}
                        onClick={() => setSelectedDate(ymd)}
                        className={`flex min-w-[4.5rem] shrink-0 snap-start flex-col items-center rounded-xl border px-3 py-2 ${
                          active
                            ? "border-brand-700 bg-brand-700 text-white"
                            : "border-neutral-200 bg-white text-neutral-900 active:bg-neutral-100"
                        }`}
                      >
                        <span className={`text-xs ${active ? "text-white/80" : "text-neutral-500"}`}>
                          {formatYmd(ymd, { weekday: "short" })}
                        </span>
                        <span className="text-xl font-semibold leading-tight">{formatYmd(ymd, { day: "numeric" })}</span>
                        <span className={`text-xs ${active ? "text-white/80" : "text-neutral-500"}`}>
                          {formatYmd(ymd, { month: "short" })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              {activeDate && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold text-neutral-700">
                    2. Choose a time ·{" "}
                    <span className="font-normal text-neutral-500">
                      {formatYmd(activeDate, { weekday: "long", month: "long", day: "numeric" })}
                    </span>
                  </h2>
                  {daySlots[0]?.kind === "session" ? (
                    <SessionOptions
                      slots={daySlots as SessionAvailableSlotDto[]}
                      hours={clinic.sessionHours}
                      onChoose={chooseSlot}
                    />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {daySlots.map((slot) => (
                        <button
                          key={slotKey(slot)}
                          type="button"
                          onClick={() => chooseSlot(slot)}
                          className="rounded-xl border border-neutral-200 bg-white px-2 py-3 text-center font-medium text-neutral-900 active:bg-neutral-100"
                        >
                          {slot.kind === "timed" ? formatTime(slot.startsAt, timeZone) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          {!isBooking && (
            <PatientButton variant="secondary" onClick={() => setStep("overview")}>
              Back
            </PatientButton>
          )}
        </div>
      )}

      {step === "confirm" && selectedSlot && (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
            <p className="text-sm text-neutral-600">
              {isBooking ? "You're booking an appointment on" : "Your appointment will be moved to"}
            </p>
            <p className="mt-2 text-lg font-semibold text-neutral-900">
              {describeSlot(selectedSlot, timeZone, clinic.sessionHours).date}
            </p>
            <p className="text-neutral-800">{describeSlot(selectedSlot, timeZone, clinic.sessionHours).time}</p>
            {currentLabel && <p className="mt-3 text-sm text-neutral-500">Current schedule: {currentLabel}</p>}
          </div>
          <PatientButton onClick={submit} disabled={submitting}>
            {submitting ? "Please wait…" : isBooking ? "Confirm booking" : "Confirm new schedule"}
          </PatientButton>
          <PatientButton variant="secondary" onClick={() => setStep("pick")} disabled={submitting}>
            Change
          </PatientButton>
        </div>
      )}
    </div>
  );
}

function SessionOptions({
  slots,
  hours,
  onChoose,
}: {
  slots: SessionAvailableSlotDto[];
  hours: SupportedSession["clinic"]["sessionHours"];
  onChoose: (slot: AvailableSlotDto) => void;
}) {
  // Always show both sessions so a full one reads as "unavailable" rather than silently missing.
  return (
    <div className="flex flex-col gap-2">
      {(["am", "pm"] as SessionOfDay[]).map((sessionOfDay) => {
        const slot = slots.find((s) => s.sessionOfDay === sessionOfDay);
        const range = sessionHoursLabel(sessionOfDay, hours);
        return (
          <button
            key={sessionOfDay}
            type="button"
            disabled={!slot}
            onClick={() => slot && onChoose(slot)}
            className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-4 text-left active:bg-neutral-100 disabled:bg-neutral-50 disabled:opacity-60"
          >
            <span>
              <span className="block text-lg font-medium text-neutral-900">{sessionName(sessionOfDay)}</span>
              {range && <span className="block text-sm text-neutral-500">{range}</span>}
            </span>
            <span className="text-sm text-neutral-500">
              {slot ? `${slot.remaining} ${slot.remaining === 1 ? "spot" : "spots"} left` : "Unavailable"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PickerSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-label="Loading available dates">
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[4.5rem] w-[4.5rem] rounded-xl bg-neutral-200" />
        ))}
      </div>
      <div className="h-16 rounded-xl bg-neutral-200" />
      <div className="h-16 rounded-xl bg-neutral-200" />
    </div>
  );
}
