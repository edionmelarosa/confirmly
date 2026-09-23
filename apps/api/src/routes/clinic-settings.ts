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
  openDays: z.array(z.number().int().min(0).max(6)).min(1, "Select at least one open day").optional(),
  openHour: z.coerce.number().int().min(0).max(23).optional(),
  closeHour: z.coerce.number().int().min(1).max(24).optional(),
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
  openDays: number[];
  openHour: number;
  closeHour: number;
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
    openDays: clinic.openDays,
    openHour: clinic.openHour,
    closeHour: clinic.closeHour,
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
    const current = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
    const data = { ...body.data };
    if (data.openDays) {
      data.openDays = [...new Set(data.openDays)].sort((a, b) => a - b);
    }

    const merged = { ...current, ...data };
    // Session clinics: the morning session always starts at opening time.
    if (merged.schedulingMode === "session_capacity") {
      data.sessionAmStartHour = merged.openHour;
      merged.sessionAmStartHour = merged.openHour;
    }

    const problem =
      merged.openHour >= merged.closeHour
        ? "Closing time must be after opening time"
        : merged.schedulingMode === "session_capacity" &&
            !(
              merged.sessionAmStartHour < merged.sessionAmEndHour &&
              merged.sessionAmEndHour <= merged.sessionPmStartHour &&
              merged.sessionPmStartHour < merged.sessionPmEndHour &&
              merged.sessionPmEndHour <= merged.closeHour
            )
          ? "Cutoff times must be in order: opens < morning cutoff < afternoon cutoff ≤ closes"
          : null;
    if (problem) {
      return reply.code(400).send({ error: "invalid_request", message: problem });
    }

    const clinic = await prisma.clinic.update({
      where: { id: clinicId },
      data,
    });

    return reply.send(toDto(clinic));
  });
}
