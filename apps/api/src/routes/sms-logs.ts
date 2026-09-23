import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import { requireAuth } from "../auth/guard";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
});

export function registerSmsLogRoutes(app: FastifyInstance): void {
  app.addHook("preHandler", requireAuth);

  app.get("/sms-logs", async (request, reply) => {
    const query = listQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "invalid_request", message: query.error.message });
    }

    const clinicId = request.staffUser!.clinicId;

    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where: { clinicId },
        include: {
          appointment: {
            include: {
              patient: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: query.data.limit,
        skip: query.data.offset,
      }),
      prisma.smsLog.count({ where: { clinicId } }),
    ]);

    return reply.send({
      logs,
      total,
      limit: query.data.limit,
      offset: query.data.offset,
    });
  });
}
