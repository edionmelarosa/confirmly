import { prisma, Prisma } from "@confirmly/db";
import type { AppointmentStatus } from "@confirmly/db";

export interface CreateAppointmentParams {
  clinicId: string;
  patientId: string;
  resourceId?: string | null;
  startsAt: Date;
  endsAt: Date;
}

export interface UpdateAppointmentParams {
  patientId?: string;
  resourceId?: string | null;
  startsAt?: Date;
  endsAt?: Date;
  status?: AppointmentStatus;
}

export class DoubleBookingError extends Error {
  constructor() {
    super("Appointment overlaps with an existing booking for this clinic/resource");
    this.name = "DoubleBookingError";
  }
}

// Postgres SQLSTATE 23P01 = exclusion_violation, raised by the
// appointments_no_overlap EXCLUDE constraint (not a Prisma-known
// constraint type, so it surfaces as PrismaClientUnknownRequestError).
function isExclusionViolation(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.meta?.code === "23P01" || (err as unknown as { code?: string }).code === "23P01";
  }
  if (err instanceof Prisma.PrismaClientUnknownRequestError) {
    return err.message.includes("23P01") || err.message.includes("appointments_no_overlap");
  }
  return false;
}

async function createAppointment(params: CreateAppointmentParams) {
  try {
    return await prisma.appointment.create({
      data: {
        clinicId: params.clinicId,
        patientId: params.patientId,
        resourceId: params.resourceId ?? null,
        startsAt: params.startsAt,
        endsAt: params.endsAt,
      },
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new DoubleBookingError();
    }
    throw err;
  }
}

async function listAppointments(clinicId: string) {
  return prisma.appointment.findMany({
    where: { clinicId },
    orderBy: { startsAt: "asc" },
  });
}

async function getAppointment(clinicId: string, id: string) {
  return prisma.appointment.findFirst({
    where: { id, clinicId },
  });
}

async function updateAppointment(clinicId: string, id: string, params: UpdateAppointmentParams) {
  const existing = await getAppointment(clinicId, id);
  if (!existing) {
    return null;
  }

  try {
    return await prisma.appointment.update({
      where: { id },
      data: params,
    });
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new DoubleBookingError();
    }
    throw err;
  }
}

async function cancelAppointment(clinicId: string, id: string) {
  const existing = await getAppointment(clinicId, id);
  if (!existing) {
    return null;
  }

  return prisma.appointment.update({
    where: { id },
    data: { status: "cancelled" },
  });
}

export const appointmentsService = {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment,
};
