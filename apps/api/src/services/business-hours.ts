import { dateYmdInTimeZone, wallClockToUtc } from "./timezone";

export interface BusinessHours {
  timezone: string;
  openDays: number[];
  openHour: number;
  closeHour: number;
}

/** JS weekday (0 = Sunday) of a clinic-local YYYY-MM-DD. */
export function weekdayOfYmd(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isOpenOnDate(clinic: BusinessHours, ymd: string): boolean {
  return clinic.openDays.includes(weekdayOfYmd(ymd));
}

/** Business-hours window of a clinic-local date, as UTC instants. */
export function businessWindow(clinic: BusinessHours, ymd: string): { opensAt: Date; closesAt: Date } {
  const [y, m, d] = ymd.split("-").map(Number);
  return {
    opensAt: wallClockToUtc(clinic.timezone, y, m, d, clinic.openHour, 0),
    closesAt: wallClockToUtc(clinic.timezone, y, m, d, clinic.closeHour, 0),
  };
}

export function isWithinBusinessHours(clinic: BusinessHours, startsAt: Date, endsAt: Date): boolean {
  const ymd = dateYmdInTimeZone(startsAt, clinic.timezone);
  if (!isOpenOnDate(clinic, ymd)) return false;
  const { opensAt, closesAt } = businessWindow(clinic, ymd);
  return startsAt >= opensAt && endsAt <= closesAt;
}
