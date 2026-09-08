import type { AppointmentDto } from "@confirmly/shared-types";

export interface Slot {
  startsAt: Date;
  endsAt: Date;
  appointment: AppointmentDto | null;
}

export const SLOT_MINUTES = 30;
export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 18;
