export interface PatientSessionAppointmentDto {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
}

export interface PatientSessionClinicDto {
  name: string;
  timezone: string;
}

export interface RescheduleSessionResponse {
  purpose: "reschedule";
  appointment: PatientSessionAppointmentDto;
  clinic: PatientSessionClinicDto;
}

export interface WaitlistClaimSessionResponse {
  purpose: "waitlist_claim";
  clinic: PatientSessionClinicDto;
  desiredStart: string;
  desiredEnd: string;
}

export type PatientSessionResponse = RescheduleSessionResponse | WaitlistClaimSessionResponse;

export interface AvailableSlotDto {
  startsAt: string;
  endsAt: string;
}

export interface RescheduleRequest {
  startsAt: string;
  endsAt: string;
}

export interface WaitlistClaimResponse {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
}
