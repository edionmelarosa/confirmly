import { prisma } from "@confirmly/db";

export interface FindOrCreatePatientParams {
  clinicId: string;
  name: string;
  phone: string;
}

async function findOrCreatePatient(params: FindOrCreatePatientParams) {
  const existing = await prisma.patient.findUnique({
    where: { clinicId_phone: { clinicId: params.clinicId, phone: params.phone } },
  });
  if (existing) {
    return existing;
  }

  return prisma.patient.create({
    data: params,
  });
}

async function listPatients(clinicId: string) {
  return prisma.patient.findMany({
    where: { clinicId },
    orderBy: { name: "asc" },
  });
}

export const patientsService = {
  findOrCreatePatient,
  listPatients,
};
