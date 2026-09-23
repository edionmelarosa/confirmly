import type { SessionOfDay } from "./clinic";

export interface PatientSessionAppointmentDto {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  sessionOfDay?: SessionOfDay | null;
  isSessionCapacity?: boolean;
}

export interface SessionHoursDto {
  am: { startHour: number; endHour: number };
  pm: { startHour: number; endHour: number };
}

export interface BusinessHoursDto {
  /** JS weekday numbers, 0 = Sunday … 6 = Saturday. */
  openDays: number[];
  openHour: number;
  closeHour: number;
}

export interface PatientSessionClinicDto {
  name: string;
  timezone: string;
  schedulingMode?: "fixed_time" | "session_capacity";
  sessionHours?: SessionHoursDto;
  businessHours?: BusinessHoursDto;
}

export interface RescheduleSessionResponse {
  purpose: "reschedule";
  appointment: PatientSessionAppointmentDto;
  clinic: PatientSessionClinicDto;
}

export interface ManageSessionResponse {
  purpose: "manage";
  appointment: PatientSessionAppointmentDto;
  clinic: PatientSessionClinicDto;
}

export interface InviteToBookSessionResponse {
  purpose: "invite_to_book";
  clinic: PatientSessionClinicDto;
  patientId: string;
  patientName: string;
}

export interface WaitlistClaimSessionResponse {
  purpose: "waitlist_claim";
  clinic: PatientSessionClinicDto;
  desiredStart: string;
  desiredEnd: string;
}

export type PatientSessionResponse = 
  | RescheduleSessionResponse 
  | ManageSessionResponse 
  | InviteToBookSessionResponse 
  | WaitlistClaimSessionResponse;

export interface TimedAvailableSlotDto {
  kind: "timed";
  startsAt: string;
  endsAt: string;
}

export interface SessionAvailableSlotDto {
  kind: "session";
  date: string;
  sessionOfDay: SessionOfDay;
  remaining: number;
  capacity: number;
}

export type AvailableSlotDto = TimedAvailableSlotDto | SessionAvailableSlotDto;

/** @deprecated prefer TimedAvailableSlotDto; kept for older clients that only send times */
export interface LegacyTimedSlot {
  startsAt: string;
  endsAt: string;
}

export interface RescheduleRequest {
  startsAt?: string;
  endsAt?: string;
  date?: string;
  sessionOfDay?: SessionOfDay;
}

export interface WaitlistClaimResponse {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
}
