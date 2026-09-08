import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guard";
import { patientsService } from "../services/patients";

const findOrCreateSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
});

export function registerPatientRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAuth);

  app.post("/patients", async (request, reply) => {
    const body = findOrCreateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const patient = await patientsService.findOrCreatePatient({
      clinicId,
      ...body.data,
    });
    return reply.code(200).send(patient);
  });

  app.get("/patients", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const patients = await patientsService.listPatients(clinicId);
    return reply.send(patients);
  });
}
