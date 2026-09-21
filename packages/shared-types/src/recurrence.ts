import type { SessionOfDay } from "./clinic";

export type RecurrenceRuleType = "every_n_weeks" | "day_of_month";
export type RecurrenceRuleStatus = "active" | "paused" | "cancelled";
export interface RecurrenceRuleDto {
  id: string;
  clinicId: string;
  patientId: string;
  resourceId: string | null;
  ruleType: RecurrenceRuleType;
  intervalWeeks: number | null;
  dayOfMonth: number | null;
  durationMinutes: number;
  sessionOfDay: SessionOfDay | null;
  status: RecurrenceRuleStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecurrenceRuleInput {
  ruleType: RecurrenceRuleType;
  intervalWeeks?: number | null;
  dayOfMonth?: number | null;
  durationMinutes?: number;
  sessionOfDay?: SessionOfDay | null;
  resourceId?: string | null;
  notes?: string | null;
  /** ISO datetime used as the first occurrence anchor (fixed-time) */
  firstStartsAt?: string;
  /** Date YYYY-MM-DD for first session-capacity occurrence */
  firstDate?: string;
}

export interface UpdateRecurrenceRuleInput {
  status?: RecurrenceRuleStatus;
  intervalWeeks?: number | null;
  dayOfMonth?: number | null;
  durationMinutes?: number;
  sessionOfDay?: SessionOfDay | null;
  resourceId?: string | null;
  notes?: string | null;
}
