import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import { requireAuth } from "../auth/guard";

const updateSchema = z.object({
  reminderLeadHours: z.coerce.number().int().positive().optional(),
  smsSenderName: z.string().min(1).optional(),
});

export function registerClinicSettingsRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAuth);

  app.get("/clinic-settings", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
    return reply.send({
      name: clinic.name,
      timezone: clinic.timezone,
      smsSenderName: clinic.smsSenderName,
      reminderLeadHours: clinic.reminderLeadHours,
    });
  });

  app.patch("/clinic-settings", async (request, reply) => {
    const body = updateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data: body.data,
    });

    return reply.send({
      name: clinic.name,
      timezone: clinic.timezone,
      smsSenderName: clinic.smsSenderName,
      reminderLeadHours: clinic.reminderLeadHours,
    });
  });
}
