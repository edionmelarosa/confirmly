import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import type { AvailableSlotDto, PatientSessionResponse, WaitlistClaimResponse } from "@confirmly/shared-types";
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

    if (record.purpose === "waitlist_claim") {
      if (!record.waitlistEntryId) {
        return reply.code(410).send({ error: "gone", message: "This link is no longer valid" });
      }

      const entry = await prisma.waitlistEntry.findUnique({
        where: { id: record.waitlistEntryId },
        include: { clinic: true },
      });
      if (!entry || entry.status !== "offered") {
        return reply.code(410).send({ error: "gone", message: "This offer is no longer available" });
      }

      const response: PatientSessionResponse = {
        purpose: "waitlist_claim",
        clinic: { name: entry.clinic.name, timezone: entry.clinic.timezone },
        desiredStart: entry.desiredStart.toISOString(),
        desiredEnd: entry.desiredEnd.toISOString(),
      };
      return reply.send(response);
    }

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
      purpose: "reschedule",
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

  app.post<{ Params: { token: string } }>("/api/patient/session/:token/claim", async (request, reply) => {
    const resolved = await resolveAccessToken(request.params.token);
    const record = resolved.record;
    if (resolved.state !== "valid" || record?.purpose !== "waitlist_claim" || !record.waitlistEntryId) {
      return reply.code(410).send({ error: "gone", message: "This link has expired or was already used" });
    }

    const waitlistEntryId = record.waitlistEntryId;

    // Atomic first-to-confirm-wins: only one concurrent request can flip offered -> claimed.
    const claim = await prisma.waitlistEntry.updateMany({
      where: { id: waitlistEntryId, status: "offered" },
      data: { status: "claimed" },
    });

    if (claim.count === 0) {
      return reply.code(410).send({ error: "gone", message: "This slot is no longer available" });
    }

    const entry = await prisma.waitlistEntry.findUniqueOrThrow({
      where: { id: waitlistEntryId },
      include: { clinic: true, patient: true },
    });

    if (!entry.offeredSlotStart || !entry.offeredSlotEnd) {
      return reply.code(410).send({ error: "gone", message: "This slot is no longer available" });
    }

    try {
      const appointment = await appointmentsService.createAppointment({
        clinicId: entry.clinicId,
        patientId: entry.patientId,
        resourceId: entry.offeredResourceId,
        startsAt: entry.offeredSlotStart,
        endsAt: entry.offeredSlotEnd,
      });

      await markAccessTokenUsed(record.id);

      await smsService.send({
        clinicId: entry.clinicId,
        to: entry.patient.phone,
        body: `You're booked! Your appointment is confirmed for ${appointment.startsAt.toLocaleString("en-PH", {
          timeZone: entry.clinic.timezone,
        })}.`,
        appointmentId: appointment.id,
      });

      const response: WaitlistClaimResponse = {
        id: appointment.id,
        startsAt: appointment.startsAt.toISOString(),
        endsAt: appointment.endsAt.toISOString(),
        status: appointment.status,
      };
      return reply.send(response);
    } catch (err) {
      if (err instanceof DoubleBookingError) {
        // Slot got taken by a direct booking before we could claim it; revert the entry so it isn't stuck as claimed.
        await prisma.waitlistEntry.update({ where: { id: entry.id }, data: { status: "expired" } });
        return reply.code(409).send({ error: "double_booking", message: "This slot was just taken" });
      }
      throw err;
    }
  });
}
