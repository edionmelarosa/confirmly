import Fastify, { FastifyInstance } from "fastify";
import { prisma } from "@confirmly/db";
import type { Env } from "./env";

export function buildApp(env: Env): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.get("/health", async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    return reply.send({ status: "ok", env: env.NODE_ENV });
  });

  return app;
}
