import { prisma, type RecurrenceRule, type RecurrenceRuleType, type SessionOfDay } from "@confirmly/db";
import { appointmentsService } from "./appointments";
import { sessionsService } from "./sessions";

export class ActiveRecurrenceExistsError extends Error {
  constructor() {
    super("Patient already has an active recurrence rule");
    this.name = "ActiveRecurrenceExistsError";
  }
}

export function computeNextOccurrence(
  rule: { ruleType: RecurrenceRuleType; intervalWeeks: number | null; dayOfMonth: number | null },
  fromDate: Date,
): Date {
  if (rule.ruleType === "every_n_weeks") {
    const weeks = rule.intervalWeeks ?? 1;
    return new Date(fromDate.getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
  }

  // day_of_month: next month's dayOfMonth, clamped to month length
  const day = rule.dayOfMonth ?? 1;
  const y = fromDate.getUTCFullYear();
  const m = fromDate.getUTCMonth();
  const nextMonth = m + 1;
  const targetYear = nextMonth > 11 ? y + 1 : y;
  const targetMonth = nextMonth % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clamped = Math.min(day, lastDay);
  const next = new Date(fromDate);
  next.setUTCFullYear(targetYear, targetMonth, clamped);
  return next;
}

export interface CreateRecurrenceRuleParams {
  clinicId: string;
  patientId: string;
  ruleType: RecurrenceRuleType;
  intervalWeeks?: number | null;
  dayOfMonth?: number | null;
  durationMinutes?: number;
  sessionOfDay?: SessionOfDay | null;
  resourceId?: string | null;
  notes?: string | null;
  firstStartsAt?: Date;
  firstDate?: string;
}

async function createRecurrenceRule(params: CreateRecurrenceRuleParams) {
  if (params.ruleType === "every_n_weeks" && (!params.intervalWeeks || params.intervalWeeks < 1)) {
    throw new Error("intervalWeeks is required for every_n_weeks rules");
  }
  if (params.ruleType === "day_of_month" && (!params.dayOfMonth || params.dayOfMonth < 1 || params.dayOfMonth > 31)) {
    throw new Error("dayOfMonth (1-31) is required for day_of_month rules");
  }

  const existingActive = await prisma.recurrenceRule.findFirst({
    where: { clinicId: params.clinicId, patientId: params.patientId, status: "active" },
  });
  if (existingActive) {
    throw new ActiveRecurrenceExistsError();
  }

  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: params.clinicId } });

  const rule = await prisma.recurrenceRule.create({
    data: {
      clinicId: params.clinicId,
      patientId: params.patientId,
      resourceId: params.resourceId ?? null,
      ruleType: params.ruleType,
      intervalWeeks: params.ruleType === "every_n_weeks" ? params.intervalWeeks! : null,
      dayOfMonth: params.ruleType === "day_of_month" ? params.dayOfMonth! : null,
      durationMinutes: params.durationMinutes ?? 30,
      sessionOfDay:
        clinic.schedulingMode === "session_capacity"
          ? (params.sessionOfDay ?? "am")
          : null,
      notes: params.notes ?? null,
      status: "active",
    },
  });

  // Generate the first appointment immediately
  if (clinic.schedulingMode === "session_capacity") {
    if (!params.firstDate) {
      throw new Error("firstDate is required when clinic uses session_capacity mode");
    }
    await sessionsService.bookSessionCapacitySlot({
      clinicId: params.clinicId,
      patientId: params.patientId,
      date: params.firstDate,
      sessionOfDay: rule.sessionOfDay ?? "am",
      resourceId: rule.resourceId,
      recurrenceRuleId: rule.id,
    });
  } else {
    if (!params.firstStartsAt) {
      throw new Error("firstStartsAt is required when clinic uses fixed_time mode");
    }
    const endsAt = new Date(params.firstStartsAt.getTime() + rule.durationMinutes * 60_000);
    await appointmentsService.createAppointment({
      clinicId: params.clinicId,
      patientId: params.patientId,
      resourceId: rule.resourceId,
      startsAt: params.firstStartsAt,
      endsAt,
      recurrenceRuleId: rule.id,
      isSessionCapacity: false,
    });
  }

  return rule;
}

async function generateNextAppointmentForRule(ruleId: string) {
  const rule = await prisma.recurrenceRule.findUnique({ where: { id: ruleId } });
  if (!rule || rule.status !== "active") {
    return null;
  }

  const latest = await prisma.appointment.findFirst({
    where: { recurrenceRuleId: ruleId },
    orderBy: { startsAt: "desc" },
  });
  if (!latest) {
    return null;
  }

  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: rule.clinicId } });
  const nextInstant = computeNextOccurrence(rule, latest.startsAt);

  if (clinic.schedulingMode === "session_capacity" || latest.isSessionCapacity) {
    const dateYmd = sessionsService.dateYmdInTimeZone(nextInstant, clinic.timezone);
    return sessionsService.bookSessionCapacitySlot({
      clinicId: rule.clinicId,
      patientId: rule.patientId,
      date: dateYmd,
      sessionOfDay: rule.sessionOfDay ?? latest.sessionOfDay ?? "am",
      resourceId: rule.resourceId,
      recurrenceRuleId: rule.id,
    });
  }

  const endsAt = new Date(nextInstant.getTime() + rule.durationMinutes * 60_000);
  return appointmentsService.createAppointment({
    clinicId: rule.clinicId,
    patientId: rule.patientId,
    resourceId: rule.resourceId,
    startsAt: nextInstant,
    endsAt,
    recurrenceRuleId: rule.id,
    isSessionCapacity: false,
  });
}

async function pauseRecurrenceRule(clinicId: string, id: string) {
  const rule = await prisma.recurrenceRule.findFirst({ where: { id, clinicId } });
  if (!rule) return null;
  return prisma.recurrenceRule.update({ where: { id }, data: { status: "paused" } });
}

async function resumeRecurrenceRule(clinicId: string, id: string) {
  const rule = await prisma.recurrenceRule.findFirst({ where: { id, clinicId } });
  if (!rule) return null;

  const otherActive = await prisma.recurrenceRule.findFirst({
    where: { clinicId, patientId: rule.patientId, status: "active", id: { not: id } },
  });
  if (otherActive) {
    throw new ActiveRecurrenceExistsError();
  }

  const updated = await prisma.recurrenceRule.update({ where: { id }, data: { status: "active" } });
  // Generate next occurrence from the most recent appointment so staff see a booking after resume
  await generateNextAppointmentForRule(id);
  return updated;
}

async function cancelRecurrenceRule(clinicId: string, id: string) {
  const rule = await prisma.recurrenceRule.findFirst({ where: { id, clinicId } });
  if (!rule) return null;
  return prisma.recurrenceRule.update({ where: { id }, data: { status: "cancelled" } });
}

async function listRecurrenceRulesForPatient(clinicId: string, patientId: string) {
  return prisma.recurrenceRule.findMany({
    where: { clinicId, patientId },
    orderBy: { createdAt: "desc" },
  });
}

async function updateRecurrenceRule(
  clinicId: string,
  id: string,
  data: {
    status?: "active" | "paused" | "cancelled";
    intervalWeeks?: number | null;
    dayOfMonth?: number | null;
    durationMinutes?: number;
    sessionOfDay?: SessionOfDay | null;
    resourceId?: string | null;
    notes?: string | null;
  },
) {
  const rule = await prisma.recurrenceRule.findFirst({ where: { id, clinicId } });
  if (!rule) return null;

  if (data.status === "paused") {
    return pauseRecurrenceRule(clinicId, id);
  }
  if (data.status === "cancelled") {
    return cancelRecurrenceRule(clinicId, id);
  }
  if (data.status === "active" && rule.status !== "active") {
    return resumeRecurrenceRule(clinicId, id);
  }

  return prisma.recurrenceRule.update({
    where: { id },
    data: {
      intervalWeeks: data.intervalWeeks === undefined ? undefined : data.intervalWeeks,
      dayOfMonth: data.dayOfMonth === undefined ? undefined : data.dayOfMonth,
      durationMinutes: data.durationMinutes,
      sessionOfDay: data.sessionOfDay === undefined ? undefined : data.sessionOfDay,
      resourceId: data.resourceId === undefined ? undefined : data.resourceId,
      notes: data.notes === undefined ? undefined : data.notes,
    },
  });
}

export const recurrenceService = {
  createRecurrenceRule,
  computeNextOccurrence,
  generateNextAppointmentForRule,
  pauseRecurrenceRule,
  resumeRecurrenceRule,
  cancelRecurrenceRule,
  listRecurrenceRulesForPatient,
  updateRecurrenceRule,
};
