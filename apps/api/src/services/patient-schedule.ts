import { prisma, type Prisma } from "@confirmly/db";
import { startOfDayInTimeZone } from "./timezone";

type Db = Pick<Prisma.TransactionClient, "appointment" | "clinic">;

export class PatientAlreadyBookedError extends Error {
  // Picked up by the global Fastify error handler so every booking path returns 409.
  statusCode = 409;
  code = "already_booked";

  constructor() {
    super("This patient already has an upcoming appointment. Cancel or reschedule it first.");
    this.name = "PatientAlreadyBookedError";
  }
}

/**
 * An appointment counts as the patient's current booking while it is scheduled/confirmed
 * and hasn't ended before today (clinic time). Today's visits still count after their start
 * time so staff can mark them completed / no-show without the patient looking unbooked.
 */
export function upcomingAppointmentWhere(clinicTimezone: string, now = new Date()) {
  return {
    status: { in: ["scheduled", "confirmed"] },
    endsAt: { gte: startOfDayInTimeZone(now, clinicTimezone) },
  } satisfies Prisma.AppointmentWhereInput;
}

export async function findUpcomingAppointment(
  db: Db,
  clinicId: string,
  patientId: string,
  excludeAppointmentId?: string,
) {
  const clinic = await db.clinic.findUniqueOrThrow({ where: { id: clinicId } });
  return db.appointment.findFirst({
    where: {
      clinicId,
      patientId,
      ...upcomingAppointmentWhere(clinic.timezone),
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    orderBy: { startsAt: "asc" },
  });
}

export async function assertNoUpcomingAppointment(
  db: Db,
  clinicId: string,
  patientId: string,
  excludeAppointmentId?: string,
): Promise<void> {
  const existing = await findUpcomingAppointment(db, clinicId, patientId, excludeAppointmentId);
  if (existing) {
    throw new PatientAlreadyBookedError();
  }
}

type Cadence = { kind: "weeks"; n: number } | { kind: "months"; n: number } | { kind: "day_of_month"; day: number };

function addMonthsClamped(from: Date, months: number, day?: number): Date {
  const next = new Date(from);
  const target = from.getUTCMonth() + months;
  const targetYear = from.getUTCFullYear() + Math.floor(target / 12);
  const targetMonth = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  next.setUTCFullYear(targetYear, targetMonth, Math.min(day ?? from.getUTCDate(), lastDay));
  return next;
}

export function applyCadence(cadence: Cadence, from: Date): Date {
  if (cadence.kind === "weeks") {
    return new Date(from.getTime() + cadence.n * 7 * 24 * 60 * 60 * 1000);
  }
  if (cadence.kind === "months") {
    return addMonthsClamped(from, cadence.n);
  }
  return addMonthsClamped(from, 1, cadence.day);
}

/** Parses the free-text cadence saved from the Add/Edit client form ("3 weeks", "1 month", "Day 15"). */
export function parseScheduleDetails(details: string | null | undefined): Cadence | null {
  if (!details) return null;
  const weeks = /^(\d+)\s*weeks?$/i.exec(details.trim());
  if (weeks) return { kind: "weeks", n: Number(weeks[1]) };
  const months = /^(\d+)\s*months?$/i.exec(details.trim());
  if (months) return { kind: "months", n: Number(months[1]) };
  const day = /^day\s*(\d+)$/i.exec(details.trim());
  if (day) return { kind: "day_of_month", day: Number(day[1]) };
  return null;
}

async function resolveCadence(clinicId: string, patientId: string, scheduleDetails: string | null) {
  const rule = await prisma.recurrenceRule.findFirst({
    where: { clinicId, patientId, status: "active" },
    orderBy: { createdAt: "desc" },
  });
  if (rule?.ruleType === "every_n_weeks" && rule.intervalWeeks) {
    return { kind: "weeks", n: rule.intervalWeeks } as Cadence;
  }
  if (rule?.ruleType === "day_of_month" && rule.dayOfMonth) {
    return { kind: "day_of_month", day: rule.dayOfMonth } as Cadence;
  }
  return parseScheduleDetails(scheduleDetails);
}

/**
 * Keeps Patient.nextSchedule in step with the appointment lifecycle for patients that have a cadence:
 * - booked (scheduled/confirmed) or completed → the visit date + cadence
 * - cancelled → the missed visit date, i.e. the patient is due and needs rebooking
 * - no-show → cleared (any patient); staff decide when to follow up
 * Patients without a cadence otherwise keep whatever staff set manually.
 */
export async function syncNextSchedule(appointmentId: string): Promise<void> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { patient: true },
  });
  if (!appointment) return;

  if (appointment.status === "no_show") {
    await prisma.patient.update({ where: { id: appointment.patientId }, data: { nextSchedule: null } });
    return;
  }

  const cadence = await resolveCadence(
    appointment.clinicId,
    appointment.patientId,
    appointment.patient.scheduleDetails,
  );
  if (!cadence) return;

  const nextSchedule =
    appointment.status === "cancelled"
      ? appointment.startsAt
      : applyCadence(cadence, appointment.startsAt);

  await prisma.patient.update({
    where: { id: appointment.patientId },
    data: { nextSchedule },
  });
}
