import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guard";
import {
  recurrenceService,
  ActiveRecurrenceExistsError,
} from "../services/recurrence";

const createSchema = z
  .object({
    ruleType: z.enum(["every_n_weeks", "day_of_month"]),
    intervalWeeks: z.coerce.number().int().positive().nullable().optional(),
    dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
    durationMinutes: z.coerce.number().int().positive().optional(),
    sessionOfDay: z.enum(["am", "pm"]).nullable().optional(),
    resourceId: z.string().min(1).nullable().optional(),
    notes: z.string().nullable().optional(),
    firstStartsAt: z.coerce.date().optional(),
    firstDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.ruleType === "every_n_weeks" && !val.intervalWeeks) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "intervalWeeks required" });
    }
    if (val.ruleType === "day_of_month" && !val.dayOfMonth) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "dayOfMonth required" });
    }
  });

const updateSchema = z.object({
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  intervalWeeks: z.coerce.number().int().positive().nullable().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  sessionOfDay: z.enum(["am", "pm"]).nullable().optional(),
  resourceId: z.string().min(1).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export function registerRecurrenceRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAuth);

  app.post<{ Params: { patientId: string } }>(
    "/patients/:patientId/recurrence-rules",
    async (request, reply) => {
      const body = createSchema.safeParse(request.body);
      if (!body.success) {
        return reply.code(400).send({ error: "invalid_request", message: body.error.message });
      }

      const clinicId = request.staffUser!.clinicId;
      try {
        const rule = await recurrenceService.createRecurrenceRule({
          clinicId,
          patientId: request.params.patientId,
          ...body.data,
        });
        return reply.code(201).send(rule);
      } catch (err) {
        if (err instanceof ActiveRecurrenceExistsError) {
          return reply.code(409).send({ error: "active_rule_exists", message: err.message });
        }
        if (err instanceof Error && /required/i.test(err.message)) {
          return reply.code(400).send({ error: "invalid_request", message: err.message });
        }
        throw err;
      }
    },
  );

  app.get<{ Params: { patientId: string } }>(
    "/patients/:patientId/recurrence-rules",
    async (request, reply) => {
      const clinicId = request.staffUser!.clinicId;
      const rules = await recurrenceService.listRecurrenceRulesForPatient(
        clinicId,
        request.params.patientId,
      );
      return reply.send(rules);
    },
  );

  app.patch<{ Params: { id: string } }>("/recurrence-rules/:id", async (request, reply) => {
    const body = updateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    try {
      const updated = await recurrenceService.updateRecurrenceRule(
        clinicId,
        request.params.id,
        body.data,
      );
      if (!updated) {
        return reply.code(404).send({ error: "not_found", message: "Recurrence rule not found" });
      }
      return reply.send(updated);
    } catch (err) {
      if (err instanceof ActiveRecurrenceExistsError) {
        return reply.code(409).send({ error: "active_rule_exists", message: err.message });
      }
      throw err;
    }
  });
}
