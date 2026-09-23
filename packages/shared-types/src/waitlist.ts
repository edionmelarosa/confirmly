export type WaitlistStatus = "waiting" | "offered" | "claimed" | "expired" | "cancelled";

export interface WaitlistEntryDto {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  desiredStart: string;
  desiredEnd: string;
  status: WaitlistStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWaitlistEntryInput {
  patientId: string;
  desiredStart: string;
  desiredEnd: string;
}
