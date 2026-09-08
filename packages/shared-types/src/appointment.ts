export type AppointmentStatus = "scheduled" | "confirmed" | "cancelled" | "no_show" | "completed";

export interface AppointmentDto {
  id: string;
  clinicId: string;
  patientId: string;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  reminderSentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  patientId: string;
  resourceId?: string | null;
  startsAt: string;
  endsAt: string;
}

export interface UpdateAppointmentInput {
  patientId?: string;
  resourceId?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: AppointmentStatus;
}
