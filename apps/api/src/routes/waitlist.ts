import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guard";
import type { WaitlistService } from "../services/waitlist";

const createSchema = z.object({
  patientId: z.string().min(1),
  desiredStart: z.coerce.date(),
  desiredEnd: z.coerce.date(),
});

const sendOfferSchema = z.object({
  resourceId: z.string().min(1).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

export function registerWaitlistRoutes(app: FastifyInstance, waitlistService: WaitlistService): void {
  app.addHook("preHandler", requireAuth);

  app.post("/waitlist", async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const entry = await waitlistService.createWaitlistEntry({
      clinicId,
      ...body.data,
    });
    return reply.code(201).send(entry);
  });

  app.get("/waitlist", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const entries = await waitlistService.listWaitlistEntries(clinicId);
    return reply.send(entries);
  });

  app.post<{ Params: { id: string } }>("/waitlist/:id/send-offer", async (request, reply) => {
    const body = sendOfferSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const entry = await waitlistService.sendWaitlistOfferNow(request.params.id, {
      clinicId,
      resourceId: body.data.resourceId ?? null,
      startsAt: body.data.startsAt,
      endsAt: body.data.endsAt,
    });

    if (!entry) {
      return reply.code(404).send({ error: "not_found", message: "Waitlist entry not found or not waiting" });
    }

    return reply.send({ status: "offered" });
  });
}
