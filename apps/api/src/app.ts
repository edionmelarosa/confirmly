import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { prisma } from "@confirmly/db";
import type { Env } from "./env";
import { registerAuthRoutes } from "./auth/routes";
import { registerAppointmentRoutes } from "./routes/appointments";
import { registerPatientRoutes } from "./routes/patients";

export function buildApp(env: Env): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  app.register(cookie);

  app.get("/health", async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    return reply.send({ status: "ok", env: env.NODE_ENV });
  });

  registerAuthRoutes(app);
  app.register(async (instance) => registerAppointmentRoutes(instance));
  app.register(async (instance) => registerPatientRoutes(instance));

  return app;
}
