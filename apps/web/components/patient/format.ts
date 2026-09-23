import type { AvailableSlotDto, SessionHoursDto, SessionOfDay } from "@confirmly/shared-types";

export function formatInClinicTz(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** YYYY-MM-DD of an instant in the clinic's timezone. */
export function ymdInTz(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

export function slotYmd(slot: AvailableSlotDto, timeZone: string): string {
  return slot.kind === "session" ? slot.date : ymdInTz(slot.startsAt, timeZone);
}

/** Formats a clinic-local YYYY-MM-DD without shifting it through the viewer's timezone. */
export function formatYmd(ymd: string, options: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-PH", { ...options, timeZone: "UTC" });
}

export function formatHour(hour: number): string {
  const suffix = hour < 12 || hour === 24 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

export function sessionName(sessionOfDay: SessionOfDay): string {
  return sessionOfDay === "am" ? "Morning" : "Afternoon";
}

export function sessionHoursLabel(sessionOfDay: SessionOfDay, hours?: SessionHoursDto): string | null {
  const h = hours?.[sessionOfDay];
  return h ? `${formatHour(h.startHour)} – ${formatHour(h.endHour)}` : null;
}

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone });
}

/** Full human description of a slot: date on one line, time/session on the other. */
export function describeSlot(
  slot: AvailableSlotDto,
  timeZone: string,
  hours?: SessionHoursDto,
): { date: string; time: string } {
  const date = formatYmd(slotYmd(slot, timeZone), { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (slot.kind === "session") {
    const range = sessionHoursLabel(slot.sessionOfDay, hours);
    return { date, time: range ? `${sessionName(slot.sessionOfDay)} · ${range}` : sessionName(slot.sessionOfDay) };
  }
  return { date, time: formatTime(slot.startsAt, timeZone) };
}
