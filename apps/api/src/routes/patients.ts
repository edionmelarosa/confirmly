import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guard";
import { patientsService, PatientPhoneTakenError } from "../services/patients";

const patientBodySchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  mode: z.enum(["find_or_create", "create"]).optional().default("find_or_create"),
});

export function registerPatientRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAuth);

  app.post("/patients", async (request, reply) => {
    const body = patientBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const { mode, name, phone } = body.data;

    try {
      if (mode === "create") {
        const patient = await patientsService.createPatientStrict({ clinicId, name, phone });
        return reply.code(201).send(patient);
      }
      const patient = await patientsService.findOrCreatePatient({ clinicId, name, phone });
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
}
