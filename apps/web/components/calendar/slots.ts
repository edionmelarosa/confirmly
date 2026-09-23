import type { AppointmentDto } from "@confirmly/shared-types";
import { DAY_END_HOUR, DAY_START_HOUR, SLOT_MINUTES, type Slot } from "./types";

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function buildSlotsForDay(day: Date, appointments: AppointmentDto[]): Slot[] {
  const slots: Slot[] = [];
  const dayStart = new Date(day);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);

  const dayEnd = new Date(day);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  const appointmentsForDay = appointments.filter((appt) => {
    if (appt.status === "cancelled") return false;
    const apptStart = new Date(appt.startsAt);
    return isSameDay(apptStart, day);
  });

  const slotCount = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;

  for (let i = 0; i < slotCount; i++) {
    const startsAt = new Date(dayStart.getTime() + i * SLOT_MINUTES * 60_000);
    const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60_000);

    const appointment =
      appointmentsForDay.find((appt) => {
        const apptStart = new Date(appt.startsAt);
        return apptStart >= startsAt && apptStart < endsAt;
      }) ?? null;

    slots.push({ startsAt, endsAt, appointment });
  }

  return slots;
}

export function formatSlotTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
