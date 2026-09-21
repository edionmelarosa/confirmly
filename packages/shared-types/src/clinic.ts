export type SchedulingMode = "fixed_time" | "session_capacity";
export type SessionOfDay = "am" | "pm";

export interface ClinicSettingsDto {
  name: string;
  timezone: string;
  smsSenderName: string;
  reminderLeadHours: number;
  schedulingMode: SchedulingMode;
  sessionCapacityAm: number | null;
  sessionCapacityPm: number | null;
  sessionAmStartHour: number;
  sessionAmEndHour: number;
  sessionPmStartHour: number;
  sessionPmEndHour: number;
}

export interface UpdateClinicSettingsInput {
  smsSenderName?: string;
  reminderLeadHours?: number;
  schedulingMode?: SchedulingMode;
  sessionCapacityAm?: number | null;
  sessionCapacityPm?: number | null;
  sessionAmStartHour?: number;
  sessionAmEndHour?: number;
  sessionPmStartHour?: number;
  sessionPmEndHour?: number;
}
