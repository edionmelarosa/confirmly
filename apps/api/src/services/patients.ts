import { prisma, Prisma } from "@confirmly/db";
import { upcomingAppointmentWhere } from "./patient-schedule";

export interface FindOrCreatePatientParams {
  clinicId: string;
  name: string;
  phone: string;
  scheduleType?: string;
  scheduleDetails?: string;
  nextSchedule?: Date;
  service?: string;
}

export class PatientPhoneTakenError extends Error {
  constructor() {
    super("A patient with this phone number already exists for this clinic");
    this.name = "PatientPhoneTakenError";
  }
}

async function findOrCreatePatient(params: FindOrCreatePatientParams) {
  const existing = await prisma.patient.findUnique({
    where: { clinicId_phone: { clinicId: params.clinicId, phone: params.phone } },
  });
  if (existing) {
    return existing;
  }

  return prisma.patient.create({
    data: {
      clinicId: params.clinicId,
      name: params.name,
      phone: params.phone,
      scheduleType: params.scheduleType,
      scheduleDetails: params.scheduleDetails,
      nextSchedule: params.nextSchedule,
      service: params.service,
    },
  });
}

async function createPatientStrict(params: FindOrCreatePatientParams) {
  const existing = await prisma.patient.findUnique({
    where: { clinicId_phone: { clinicId: params.clinicId, phone: params.phone } },
  });
  if (existing) {
    throw new PatientPhoneTakenError();
  }
  return prisma.patient.create({
    data: {
      clinicId: params.clinicId,
      name: params.name,
      phone: params.phone,
      scheduleType: params.scheduleType,
      scheduleDetails: params.scheduleDetails,
      nextSchedule: params.nextSchedule,
      service: params.service,
    },
  });
}

async function listPatients(clinicId: string) {
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
  return prisma.patient.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
    include: {
      // The patient's current booking (at most one — see assertNoUpcomingAppointment).
      appointments: {
        where: upcomingAppointmentWhere(clinic.timezone),
        orderBy: { startsAt: "asc" },
        take: 1,
      },
      recurrenceRules: {
        where: { status: { in: ["active", "paused"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
}

async function getPatient(clinicId: string, id: string) {
  return prisma.patient.findFirst({
    where: { id, clinicId },
    include: {
      appointments: {
        orderBy: { startsAt: "desc" },
        take: 50,
      },
      recurrenceRules: {
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export interface UpdatePatientParams {
  name?: string;
  phone?: string;
  service?: string | null;
  scheduleType?: string | null;
  scheduleDetails?: string | null;
  nextSchedule?: Date | null;
}

async function updatePatient(clinicId: string, id: string, params: UpdatePatientParams) {
  const existing = await prisma.patient.findFirst({ where: { id, clinicId } });
  if (!existing) {
    return null;
  }
  try {
    return await prisma.patient.update({ where: { id }, data: params });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new PatientPhoneTakenError();
    }
    throw err;
  }
}

export const patientsService = {
  updatePatient,
  findOrCreatePatient,
  createPatientStrict,
  listPatients,
  getPatient,
};
