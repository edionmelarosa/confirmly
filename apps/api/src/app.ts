import Fastify, { FastifyInstance, FastifyError } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import * as Sentry from "@sentry/node";
import { prisma } from "@confirmly/db";
import type { Env } from "./env";
import { registerAuthRoutes } from "./auth/routes";
import { registerAppointmentRoutes } from "./routes/appointments";
import { registerPatientRoutes } from "./routes/patients";
import { registerSmsWebhookRoutes } from "./routes/webhooks-sms";
import { registerPatientSessionRoutes } from "./routes/patient-session";
import { registerWaitlistRoutes } from "./routes/waitlist";
import { registerClinicSettingsRoutes } from "./routes/clinic-settings";
import { registerRecurrenceRoutes } from "./routes/recurrence";
import { registerSmsLogRoutes } from "./routes/sms-logs";
import { createInboundSmsHandler } from "./services/inbound-sms";
import { createWaitlistService } from "./services/waitlist";
import type { SmsService } from "./services/sms";

export function buildApp(env: Env, smsService: SmsService): FastifyInstance {
  const app = Fastify({
    logger: true,
  });

  app.register(cors, {
    origin: env.WEB_ORIGIN,
    credentials: true,
  });
  app.register(cookie);

  app.setErrorHandler((error: FastifyError, request, reply) => {
    Sentry.captureException(error);
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    return reply.code(statusCode).send({
      error: "internal_error",
      message: statusCode === 500 ? "Something went wrong" : error.message,
    });
  });

  app.get("/health", async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;
    return reply.send({ status: "ok", env: env.NODE_ENV });
  });

  const waitlistService = createWaitlistService(env, smsService);
  const inboundSmsHandler = createInboundSmsHandler(env, smsService, waitlistService);

  registerAuthRoutes(app);
  app.register(async (instance) => registerAppointmentRoutes(instance, waitlistService, smsService, env));
  app.register(async (instance) => registerPatientRoutes(instance, smsService, env));
  app.register(async (instance) => registerSmsWebhookRoutes(instance, inboundSmsHandler));
  app.register(async (instance) => registerPatientSessionRoutes(instance, smsService, env));
  app.register(async (instance) => registerWaitlistRoutes(instance, waitlistService));
  app.register(async (instance) => registerClinicSettingsRoutes(instance));
  app.register(async (instance) => registerRecurrenceRoutes(instance));
  app.register(async (instance) => registerSmsLogRoutes(instance));

  return app;
}
