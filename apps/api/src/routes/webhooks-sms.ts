import type { FastifyInstance } from "fastify";
import { prisma } from "@confirmly/db";
import type { InboundSmsHandler } from "../services/inbound-sms";

interface RawInboundPayload {
  from?: string;
  sender?: string;
  to?: string;
  recipient?: string;
  message?: string;
  body?: string;
  message_id?: string | number;
  id?: string | number;
}

function extractPhone(payload: RawInboundPayload): string | null {
  return payload.from ?? payload.sender ?? null;
}

function extractBody(payload: RawInboundPayload): string | null {
  return payload.message ?? payload.body ?? null;
}

function extractMessageId(payload: RawInboundPayload): string | null {
  const raw = payload.message_id ?? payload.id;
  return raw === undefined || raw === null ? null : String(raw);
}

export function registerSmsWebhookRoutes(app: FastifyInstance, inboundSmsHandler: InboundSmsHandler): void {
  app.post("/webhooks/sms/inbound", async (request, reply) => {
    const payload = (request.body ?? {}) as RawInboundPayload;
    const phone = extractPhone(payload);
    const body = extractBody(payload);

    if (!phone || !body) {
      app.log.warn({ payload }, "inbound SMS webhook received unparseable payload");
      return reply.code(400).send({ error: "invalid_payload", message: "Missing sender or message body" });
    }

    const patient = await prisma.patient.findFirst({ where: { phone } });

    if (!patient) {
      app.log.warn({ phone }, "inbound SMS from unrecognized phone number, not logged");
      return reply.code(200).send({ status: "ignored" });
    }

    await prisma.smsLog.create({
      data: {
        clinicId: patient.clinicId,
        direction: "in",
        appointmentId: null,
        phone,
        body,
        providerStatus: "received",
        providerMessageId: extractMessageId(payload),
      },
    });

    await inboundSmsHandler.handleInboundSms({ phone, body, patient });

    return reply.code(200).send({ status: "ok" });
  });
}
