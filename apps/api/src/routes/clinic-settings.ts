import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import { requireAuth } from "../auth/guard";

const updateSchema = z.object({
  reminderLeadHours: z.coerce.number().int().positive().optional(),
  reminderLeadDays: z.coerce.number().int().positive().optional(),
  schedulingMode: z.enum(["fixed_time", "session_capacity"]).optional(),
  sessionCapacityAm: z.coerce.number().int().positive().nullable().optional(),
  sessionCapacityPm: z.coerce.number().int().positive().nullable().optional(),
  sessionAmStartHour: z.coerce.number().int().min(0).max(23).optional(),
  sessionAmEndHour: z.coerce.number().int().min(1).max(24).optional(),
  sessionPmStartHour: z.coerce.number().int().min(0).max(23).optional(),
  sessionPmEndHour: z.coerce.number().int().min(1).max(24).optional(),
});

function toDto(clinic: {
  name: string;
  timezone: string;
  smsSenderName: string;
  reminderLeadHours: number;
  reminderLeadDays: number;
  schedulingMode: string;
  sessionCapacityAm: number | null;
  sessionCapacityPm: number | null;
  sessionAmStartHour: number;
  sessionAmEndHour: number;
  sessionPmStartHour: number;
  sessionPmEndHour: number;
}) {
  return {
    name: clinic.name,
    timezone: clinic.timezone,
    reminderLeadHours: clinic.reminderLeadHours,
    reminderLeadDays: clinic.reminderLeadDays,
    schedulingMode: clinic.schedulingMode,
    sessionCapacityAm: clinic.sessionCapacityAm,
    sessionCapacityPm: clinic.sessionCapacityPm,
    sessionAmStartHour: clinic.sessionAmStartHour,
    sessionAmEndHour: clinic.sessionAmEndHour,
    sessionPmStartHour: clinic.sessionPmStartHour,
    sessionPmEndHour: clinic.sessionPmEndHour,
  };
}

export function registerClinicSettingsRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAuth);

  app.get("/clinic-settings", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
    return reply.send(toDto(clinic));
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

    return reply.send(toDto(clinic));
  });
}
