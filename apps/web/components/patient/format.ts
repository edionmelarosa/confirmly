import type { AvailableSlotDto, BusinessHoursDto, SessionHoursDto, SessionOfDay } from "@confirmly/shared-types";

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
  return `${h}:00 ${suffix}`;
}

export function sessionName(sessionOfDay: SessionOfDay): string {
  return sessionOfDay === "am" ? "Morning" : "Afternoon";
}

/** Clinic-notice style, e.g. "Cut-off 11:00 AM" — patients must arrive before the cut-off. */
export function sessionHoursLabel(sessionOfDay: SessionOfDay, hours?: SessionHoursDto): string | null {
  const h = hours?.[sessionOfDay];
  return h ? `Cut-off ${formatHour(h.endHour)}` : null;
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Mon–Sat", "Mon–Wed, Fri", "Daily" — Monday-first, consecutive days collapsed into ranges. */
export function formatOpenDays(openDays: number[]): string {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const open = order.filter((d) => openDays.includes(d));
  if (open.length === 7) return "Daily";
  const runs: number[][] = [];
  for (const d of open) {
    const last = runs[runs.length - 1];
    if (last && order.indexOf(d) === order.indexOf(last[last.length - 1]) + 1) last.push(d);
    else runs.push([d]);
  }
  return runs
    .map((r) => (r.length >= 3 ? `${DAY_ABBR[r[0]]}–${DAY_ABBR[r[r.length - 1]]}` : r.map((d) => DAY_ABBR[d]).join(", ")))
    .join(", ");
}

/** e.g. "Open Mon–Sat · 9:00 AM – 4:00 PM" */
export function formatBusinessHours(hours: BusinessHoursDto): string {
  return `Open ${formatOpenDays(hours.openDays)} · ${formatHour(hours.openHour)} – ${formatHour(hours.closeHour)}`;
}

export function formatTime(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", timeZone });
}

/** Full human description of a slot: date, time/session, and (sessions only) start + cut-off times. */
export function describeSlot(
  slot: AvailableSlotDto,
  timeZone: string,
  hours?: SessionHoursDto,
): { date: string; time: string; detail: string | null } {
  const date = formatYmd(slotYmd(slot, timeZone), { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (slot.kind === "session") {
    return { date, time: sessionName(slot.sessionOfDay), detail: sessionHoursLabel(slot.sessionOfDay, hours) };
  }
  return { date, time: formatTime(slot.startsAt, timeZone), detail: null };
}
