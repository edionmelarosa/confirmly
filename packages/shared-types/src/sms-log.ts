export type SmsDirection = "in" | "out";

export interface SmsLogDto {
  id: string;
  clinicId: string;
  direction: SmsDirection;
  appointmentId: string | null;
  phone: string;
  body: string;
  providerStatus: string;
  providerMessageId: string | null;
  createdAt: string;
  appointment?: {
    id: string;
    patient: {
      id: string;
      name: string;
      phone: string;
    };
  } | null;
}

export interface SmsLogListResponse {
  logs: SmsLogDto[];
  total: number;
  limit: number;
  offset: number;
}
