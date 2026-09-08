import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import type { AvailableSlotDto, PatientSessionResponse } from "@confirmly/shared-types";
import type { SmsService } from "../services/sms";
import { resolveAccessToken, markAccessTokenUsed } from "../services/tokens";
import { appointmentsService, DoubleBookingError } from "../services/appointments";

const SLOT_MINUTES = 30;
const DAY_START_HOUR = 8;
const DAY_END_HOUR = 18;
const SLOT_SEARCH_DAYS = 14;

const rescheduleSchema = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

async function buildAvailableSlots(clinicId: string, resourceId: string | null): Promise<AvailableSlotDto[]> {
  const now = new Date();
  const searchEnd = new Date(now.getTime() + SLOT_SEARCH_DAYS * 24 * 60 * 60 * 1000);

  const existing = await prisma.appointment.findMany({
    where: {
      clinicId,
      resourceId,
      status: { not: "cancelled" },
      startsAt: { gte: now, lte: searchEnd },
    },
    select: { startsAt: true },
  });
  const taken = new Set(existing.map((a) => a.startsAt.getTime()));

  const slots: AvailableSlotDto[] = [];
  const cursor = new Date(now);
  cursor.setMinutes(0, 0, 0);

  for (let day = 0; day < SLOT_SEARCH_DAYS; day++) {
    const dayStart = new Date(cursor.getTime() + day * 24 * 60 * 60 * 1000);
    dayStart.setHours(DAY_START_HOUR, 0, 0, 0);

    const slotCount = ((DAY_END_HOUR - DAY_START_HOUR) * 60) / SLOT_MINUTES;
    for (let i = 0; i < slotCount; i++) {
      const startsAt = new Date(dayStart.getTime() + i * SLOT_MINUTES * 60_000);
      if (startsAt.getTime() < now.getTime()) continue;
      if (taken.has(startsAt.getTime())) continue;

      const endsAt = new Date(startsAt.getTime() + SLOT_MINUTES * 60_000);
      slots.push({ startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    }
  }

  return slots;
}

export function registerPatientSessionRoutes(app: FastifyInstance, smsService: SmsService): void {
  app.get<{ Params: { token: string } }>("/api/patient/session/:token", async (request, reply) => {
    const resolved = await resolveAccessToken(request.params.token);

    if (resolved.state === "not_found") {
      return reply.code(410).send({ error: "gone", message: "Invalid link" });
    }
    if (resolved.state === "expired" || resolved.state === "used") {
      return reply.code(410).send({ error: "gone", message: "This link has expired or was already used" });
    }

    const record = resolved.record!;
    if (!record.appointmentId) {
      return reply.code(410).send({ error: "gone", message: "This link is no longer valid" });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: record.appointmentId },
      include: { clinic: true },
    });
    if (!appointment) {
      return reply.code(410).send({ error: "gone", message: "Appointment no longer exists" });
    }

    const response: PatientSessionResponse = {
      appointment: {
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
      },
      clinic: {
        name: appointment.clinic.name,
        timezone: appointment.clinic.timezone,
      },
      purpose: record.purpose,
    };

    return reply.send(response);
  });

  app.get<{ Params: { token: string } }>("/api/patient/session/:token/slots", async (request, reply) => {
    const resolved = await resolveAccessToken(request.params.token);
    if (resolved.state !== "valid" || !resolved.record?.appointmentId) {
      return reply.code(410).send({ error: "gone", message: "This link has expired or was already used" });
    }

    const appointment = await prisma.appointment.findUnique({ where: { id: resolved.record.appointmentId } });
    if (!appointment) {
      return reply.code(410).send({ error: "gone", message: "Appointment no longer exists" });
    }

    const slots = await buildAvailableSlots(appointment.clinicId, appointment.resourceId);
    return reply.send({ slots });
  });

  app.post<{ Params: { token: string } }>("/api/patient/session/:token/reschedule", async (request, reply) => {
    const body = rescheduleSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const resolved = await resolveAccessToken(request.params.token);
    if (resolved.state !== "valid" || !resolved.record?.appointmentId) {
      return reply.code(410).send({ error: "gone", message: "This link has expired or was already used" });
    }

    const record = resolved.record;
    const appointment = await prisma.appointment.findUnique({
      where: { id: record.appointmentId! },
      include: { clinic: true, patient: true },
    });
    if (!appointment) {
      return reply.code(410).send({ error: "gone", message: "Appointment no longer exists" });
    }

    try {
      const updated = await appointmentsService.updateAppointment(appointment.clinicId, appointment.id, {
        startsAt: body.data.startsAt,
        endsAt: body.data.endsAt,
      });
      if (!updated) {
        return reply.code(410).send({ error: "gone", message: "Appointment no longer exists" });
      }

      await markAccessTokenUsed(record.id);

      await smsService.send({
        clinicId: appointment.clinicId,
        to: appointment.patient.phone,
        body: `Your appointment has been rescheduled to ${updated.startsAt.toLocaleString("en-PH", {
          timeZone: appointment.clinic.timezone,
        })}. Reply C to confirm.`,
        appointmentId: appointment.id,
      });

      return reply.send({
        id: updated.id,
        startsAt: updated.startsAt.toISOString(),
        endsAt: updated.endsAt.toISOString(),
        status: updated.status,
      });
    } catch (err) {
      if (err instanceof DoubleBookingError) {
        return reply.code(409).send({ error: "double_booking", message: err.message });
      }
      throw err;
    }
  });
}
