import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guard";
import type { WaitlistService } from "../services/waitlist";

const createSchema = z.object({
  patientId: z.string().min(1),
  desiredStart: z.coerce.date(),
  desiredEnd: z.coerce.date(),
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
}
