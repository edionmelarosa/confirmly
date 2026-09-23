export type SchedulingMode = "fixed_time" | "session_capacity";
export type SessionOfDay = "am" | "pm";

export interface ClinicSettingsDto {
  name: string;
  timezone: string;
  reminderLeadHours: number;
  reminderLeadDays: number;
  schedulingMode: SchedulingMode;
  sessionCapacityAm: number | null;
  sessionCapacityPm: number | null;
  sessionAmStartHour: number;
  sessionAmEndHour: number;
  sessionPmStartHour: number;
  sessionPmEndHour: number;
}

export interface UpdateClinicSettingsInput {
  reminderLeadHours?: number;
  reminderLeadDays?: number;
  schedulingMode?: SchedulingMode;
  sessionCapacityAm?: number | null;
  sessionCapacityPm?: number | null;
  sessionAmStartHour?: number;
  sessionAmEndHour?: number;
  sessionPmStartHour?: number;
  sessionPmEndHour?: number;
}
