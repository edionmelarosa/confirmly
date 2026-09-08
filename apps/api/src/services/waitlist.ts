import type { Appointment } from "@confirmly/db";

export interface AppointmentSlot {
  clinicId: string;
  resourceId: string | null;
  startsAt: Date;
  endsAt: Date;
}

export async function checkWaitlistFill(slot: AppointmentSlot): Promise<void> {
  console.log("checkWaitlistFill stub invoked for slot", {
    clinicId: slot.clinicId,
    resourceId: slot.resourceId,
    startsAt: slot.startsAt.toISOString(),
    endsAt: slot.endsAt.toISOString(),
  });
}

export function slotFromAppointment(appointment: Appointment): AppointmentSlot {
  return {
    clinicId: appointment.clinicId,
    resourceId: appointment.resourceId,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
  };
}
