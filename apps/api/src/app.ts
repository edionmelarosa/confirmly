import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { prisma } from "@confirmly/db";
import type { Env } from "./env";
import { registerAuthRoutes } from "./auth/routes";

export function buildApp(env: Env): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cookie);

  app.get("/health", async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    return reply.send({ status: "ok", env: env.NODE_ENV });
  });

  registerAuthRoutes(app);

  return app;
}
