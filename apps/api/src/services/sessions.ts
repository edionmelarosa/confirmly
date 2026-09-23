import { prisma, Prisma, type SessionOfDay } from "@confirmly/db";
import { dateYmdInTimeZone, wallClockToUtc } from "./timezone";
import { assertNoUpcomingAppointment, PatientAlreadyBookedError, syncNextSchedule } from "./patient-schedule";

export { dateYmdInTimeZone };

export class SessionFullError extends Error {
  constructor() {
    super("This session is already at capacity");
    this.name = "SessionFullError";
  }
}

function isSerializationFailure(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === "P2034" || String(err.meta?.code) === "40001";
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return err.message.includes("40001") || err.message.includes("could not serialize");
  }
  return false;
}

export function sessionBoundsForDate(
  clinic: {
    timezone: string;
    sessionAmStartHour: number;
    sessionAmEndHour: number;
    sessionPmStartHour: number;
    sessionPmEndHour: number;
  },
  dateYmd: string,
  sessionOfDay: SessionOfDay,
): { startsAt: Date; endsAt: Date } {
  // Interpret date + clinic hours in the clinic timezone by building an ISO-like local string.
  // Node/Postgres store timestamptz; we format as offset from Asia/Manila-style wall clock via Intl.
  const [y, m, d] = dateYmd.split("-").map(Number);
  const startHour = sessionOfDay === "am" ? clinic.sessionAmStartHour : clinic.sessionPmStartHour;
  const endHour = sessionOfDay === "am" ? clinic.sessionAmEndHour : clinic.sessionPmEndHour;

  // Build Date from wall-clock components in clinic timezone using a formatter offset trick.
  const wallStart = wallClockToUtc(clinic.timezone, y, m, d, startHour, 0);
  const wallEnd = wallClockToUtc(clinic.timezone, y, m, d, endHour, 0);
  return { startsAt: wallStart, endsAt: wallEnd };
}

export interface BookSessionCapacityParams {
  clinicId: string;
  patientId: string;
  date: string;
  sessionOfDay: SessionOfDay;
  resourceId?: string | null;
  followUpOfAppointmentId?: string | null;
  recurrenceRuleId?: string | null;
}

async function bookSessionCapacitySlot(params: BookSessionCapacityParams) {
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: params.clinicId } });
  const capacity =
    params.sessionOfDay === "am" ? clinic.sessionCapacityAm : clinic.sessionCapacityPm;
  if (capacity == null || capacity < 1) {
    throw new Error("Clinic session capacity is not configured for this session");
  }

  const { startsAt, endsAt } = sessionBoundsForDate(clinic, params.date, params.sessionOfDay);

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const appointment = await prisma.$transaction(
        async (tx) => {
          await assertNoUpcomingAppointment(tx, params.clinicId, params.patientId);

          const activeCount = await tx.appointment.count({
            where: {
              clinicId: params.clinicId,
              isSessionCapacity: true,
              sessionOfDay: params.sessionOfDay,
              startsAt,
              status: { notIn: ["cancelled", "no_show"] },
            },
          });
          if (activeCount >= capacity) {
            throw new SessionFullError();
          }

          return tx.appointment.create({
            data: {
              clinicId: params.clinicId,
              patientId: params.patientId,
              resourceId: params.resourceId ?? null,
              startsAt,
              endsAt,
              sessionOfDay: params.sessionOfDay,
              isSessionCapacity: true,
              followUpOfAppointmentId: params.followUpOfAppointmentId ?? null,
              recurrenceRuleId: params.recurrenceRuleId ?? null,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await syncNextSchedule(appointment.id);
      return appointment;
    } catch (err) {
      if (err instanceof SessionFullError || err instanceof PatientAlreadyBookedError) throw err;
      if (isSerializationFailure(err) && attempt < maxAttempts - 1) continue;
      throw err;
    }
  }

  throw new Error("Failed to book session slot after retries");
}

export async function remainingSessionCapacity(
  clinicId: string,
  dateYmd: string,
  sessionOfDay: SessionOfDay,
): Promise<{ remaining: number; capacity: number; startsAt: Date; endsAt: Date }> {
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
  const capacity =
    (sessionOfDay === "am" ? clinic.sessionCapacityAm : clinic.sessionCapacityPm) ?? 0;
  const { startsAt, endsAt } = sessionBoundsForDate(clinic, dateYmd, sessionOfDay);
  const activeCount = await prisma.appointment.count({
    where: {
      clinicId,
      isSessionCapacity: true,
      sessionOfDay,
      startsAt,
      status: { notIn: ["cancelled", "no_show"] },
    },
  });
  return { remaining: Math.max(0, capacity - activeCount), capacity, startsAt, endsAt };
}

export const sessionsService = {
  bookSessionCapacitySlot,
  remainingSessionCapacity,
  sessionBoundsForDate,
  dateYmdInTimeZone,
};
