import type { SessionOfDay } from "./clinic";

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
  followUpOfAppointmentId: string | null;
  recurrenceRuleId: string | null;
  sessionOfDay: SessionOfDay | null;
  isSessionCapacity: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFixedTimeAppointmentInput {
  mode?: "fixed_time";
  patientId: string;
  resourceId?: string | null;
  startsAt: string;
  endsAt: string;
  followUpOfAppointmentId?: string | null;
}

export interface CreateSessionCapacityAppointmentInput {
  mode: "session_capacity";
  patientId: string;
  resourceId?: string | null;
  date: string; // YYYY-MM-DD in clinic local interpretation (server uses clinic hours)
  sessionOfDay: SessionOfDay;
  followUpOfAppointmentId?: string | null;
}

export type CreateAppointmentInput =
  | CreateFixedTimeAppointmentInput
  | CreateSessionCapacityAppointmentInput;

export interface UpdateAppointmentInput {
  patientId?: string;
  resourceId?: string | null;
  startsAt?: string;
  endsAt?: string;
  status?: AppointmentStatus;
  followUpOfAppointmentId?: string | null;
}
