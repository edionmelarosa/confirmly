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

export interface PatientSessionResponse {
  appointment: PatientSessionAppointmentDto;
  clinic: PatientSessionClinicDto;
  purpose: "reschedule" | "waitlist_claim";
}

export interface AvailableSlotDto {
  startsAt: string;
  endsAt: string;
}

export interface RescheduleRequest {
  startsAt: string;
  endsAt: string;
}
