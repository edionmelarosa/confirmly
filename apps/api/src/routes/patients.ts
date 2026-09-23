import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import { requireAuth } from "../auth/guard";
import { activeInviteWhere, patientsService, PatientPhoneTakenError } from "../services/patients";
import { createAccessToken } from "../services/tokens";
import { findUpcomingAppointment, PatientAlreadyBookedError } from "../services/patient-schedule";
import { renderInviteToBookSms } from "../templates/sms";
import type { SmsService } from "../services/sms";
import type { Env } from "../env";

const patientBodySchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  mode: z.enum(["find_or_create", "create"]).optional().default("find_or_create"),
  scheduleType: z.string().optional(),
  scheduleDetails: z.string().optional(),
  nextSchedule: z.coerce.date().optional(),
  service: z.string().optional(),
});

const patientUpdateSchema = z.object({
  name: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).optional(),
  service: z.string().trim().nullable().optional(),
  scheduleType: z.string().nullable().optional(),
  scheduleDetails: z.string().nullable().optional(),
  nextSchedule: z.coerce.date().nullable().optional(),
});

export function registerPatientRoutes(app: FastifyInstance, smsService: SmsService, env: Env): void {
  app.addHook("preHandler", requireAuth);

  app.post("/patients", async (request, reply) => {
    const body = patientBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const { mode, name, phone, scheduleType, scheduleDetails, nextSchedule, service } = body.data;

    try {
      if (mode === "create") {
        const patient = await patientsService.createPatientStrict({
          clinicId,
          name,
          phone,
          scheduleType,
          scheduleDetails,
          nextSchedule,
          service,
        });
        return reply.code(201).send(patient);
      }
      const patient = await patientsService.findOrCreatePatient({
        clinicId,
        name,
        phone,
        scheduleType,
        scheduleDetails,
        nextSchedule,
        service,
      });
      return reply.code(200).send(patient);
    } catch (err) {
      if (err instanceof PatientPhoneTakenError) {
        return reply.code(409).send({ error: "phone_taken", message: err.message });
      }
      throw err;
    }
  });

  app.get("/patients", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const patients = await patientsService.listPatients(clinicId);
    return reply.send(patients);
  });

  app.get<{ Params: { id: string } }>("/patients/:id", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const patient = await patientsService.getPatient(clinicId, request.params.id);
    if (!patient) {
      return reply.code(404).send({ error: "not_found", message: "Patient not found" });
    }
    return reply.send(patient);
  });

  app.patch<{ Params: { id: string } }>("/patients/:id", async (request, reply) => {
    const body = patientUpdateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const { service, ...rest } = body.data;
    try {
      const patient = await patientsService.updatePatient(clinicId, request.params.id, {
        ...rest,
        ...(service !== undefined ? { service: service || null } : {}),
      });
      if (!patient) {
        return reply.code(404).send({ error: "not_found", message: "Patient not found" });
      }
      return reply.send(patient);
    } catch (err) {
      if (err instanceof PatientPhoneTakenError) {
        return reply.code(409).send({ error: "phone_taken", message: err.message });
      }
      throw err;
    }
  });

  app.post<{ Params: { id: string } }>("/patients/:id/invite-to-book", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const patient = await patientsService.getPatient(clinicId, request.params.id);
    if (!patient) {
      return reply.code(404).send({ error: "not_found", message: "Patient not found" });
    }
    if (await findUpcomingAppointment(prisma, clinicId, patient.id)) {
      throw new PatientAlreadyBookedError();
    }
    const pendingInvite = await prisma.accessToken.findFirst({
      where: { patientId: patient.id, clinicId, ...activeInviteWhere() },
    });
    if (pendingInvite) {
      return reply.code(409).send({
        error: "invite_already_sent",
        message: "A booking link was already sent and is still valid",
      });
    }

    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });

    const { token } = await createAccessToken({
      purpose: "invite_to_book",
      patientId: patient.id,
      clinicId,
    });

    const bookingLink = `${env.WEB_ORIGIN}/c/${token}`;

    const body = renderInviteToBookSms({
      clinicName: clinic.name,
      patientName: patient.name,
      bookingLink,
    });

    const result = await smsService.send({
      clinicId,
      to: patient.phone,
      body,
    });

    return reply.send({ sent: result.success, providerStatus: result.providerStatus });
  });
}
