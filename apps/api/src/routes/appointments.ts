import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import { requireAuth } from "../auth/guard";
import { appointmentsService, DoubleBookingError } from "../services/appointments";
import { sessionsService, SessionFullError } from "../services/sessions";
import { slotFromAppointment, type WaitlistService } from "../services/waitlist";
import type { SmsService } from "../services/sms";
import { renderReminderSms } from "../templates/sms";
import { recurrenceService } from "../services/recurrence";

const fixedCreateSchema = z.object({
  mode: z.literal("fixed_time").optional(),
  patientId: z.string().min(1),
  resourceId: z.string().min(1).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  followUpOfAppointmentId: z.string().min(1).nullable().optional(),
});

const sessionCreateSchema = z.object({
  mode: z.literal("session_capacity"),
  patientId: z.string().min(1),
  resourceId: z.string().min(1).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sessionOfDay: z.enum(["am", "pm"]),
  followUpOfAppointmentId: z.string().min(1).nullable().optional(),
});

const createSchema = z.union([sessionCreateSchema, fixedCreateSchema]);

const updateSchema = z.object({
  patientId: z.string().min(1).optional(),
  resourceId: z.string().min(1).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  status: z.enum(["scheduled", "confirmed", "cancelled", "no_show", "completed"]).optional(),
  followUpOfAppointmentId: z.string().min(1).nullable().optional(),
});

export function registerAppointmentRoutes(
  app: FastifyInstance,
  waitlistService: WaitlistService,
  smsService: SmsService,
): void {
  app.addHook("preHandler", requireAuth);

  app.post("/appointments", async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });

    try {
      if (
        ("mode" in body.data && body.data.mode === "session_capacity") ||
        (clinic.schedulingMode === "session_capacity" && "date" in body.data && "sessionOfDay" in body.data)
      ) {
        const data = body.data as z.infer<typeof sessionCreateSchema>;
        if (!("date" in data) || !data.date) {
          return reply.code(400).send({
            error: "invalid_request",
            message: "date and sessionOfDay are required for session_capacity booking",
          });
        }
        const appointment = await sessionsService.bookSessionCapacitySlot({
          clinicId,
          patientId: data.patientId,
          date: data.date,
          sessionOfDay: data.sessionOfDay,
          resourceId: data.resourceId,
          followUpOfAppointmentId: data.followUpOfAppointmentId,
        });
        return reply.code(201).send(appointment);
      }

      const data = body.data as z.infer<typeof fixedCreateSchema>;
      if (clinic.schedulingMode === "session_capacity") {
        return reply.code(400).send({
          error: "invalid_request",
          message: "Clinic is in session_capacity mode — send mode=session_capacity with date + sessionOfDay",
        });
      }

      const appointment = await appointmentsService.createAppointment({
        clinicId,
        patientId: data.patientId,
        resourceId: data.resourceId,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        followUpOfAppointmentId: data.followUpOfAppointmentId,
        isSessionCapacity: false,
      });
      return reply.code(201).send(appointment);
    } catch (err) {
      if (err instanceof DoubleBookingError) {
        return reply.code(409).send({ error: "double_booking", message: err.message });
      }
      if (err instanceof SessionFullError) {
        return reply.code(409).send({ error: "session_full", message: err.message });
      }
      throw err;
    }
  });

  app.get("/appointments", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const appointments = await appointmentsService.listAppointments(clinicId);
    return reply.send(appointments);
  });

  app.get<{ Params: { id: string } }>("/appointments/:id", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const appointment = await appointmentsService.getAppointment(clinicId, request.params.id);
    if (!appointment) {
      return reply.code(404).send({ error: "not_found", message: "Appointment not found" });
    }
    return reply.send(appointment);
  });

  app.patch<{ Params: { id: string } }>("/appointments/:id", async (request, reply) => {
    const body = updateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;

    try {
      const existing = await appointmentsService.getAppointment(clinicId, request.params.id);
      const updated = await appointmentsService.updateAppointment(
        clinicId,
        request.params.id,
        body.data,
      );
      if (!updated) {
        return reply.code(404).send({ error: "not_found", message: "Appointment not found" });
      }

      if (
        body.data.status &&
        existing?.recurrenceRuleId &&
        body.data.status !== existing.status
      ) {
        if (body.data.status === "completed") {
          await recurrenceService.generateNextAppointmentForRule(existing.recurrenceRuleId);
        }
        if (body.data.status === "no_show") {
          await recurrenceService.pauseRecurrenceRule(clinicId, existing.recurrenceRuleId);
        }
      }

      return reply.send(updated);
    } catch (err) {
      if (err instanceof DoubleBookingError) {
        return reply.code(409).send({ error: "double_booking", message: err.message });
      }
      throw err;
    }
  });

  app.post<{ Params: { id: string } }>("/appointments/:id/cancel", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const cancelled = await appointmentsService.cancelAppointment(clinicId, request.params.id);
    if (!cancelled) {
      return reply.code(404).send({ error: "not_found", message: "Appointment not found" });
    }
    await waitlistService.checkWaitlistFill(slotFromAppointment(cancelled));
    return reply.send(cancelled);
  });

  app.post<{ Params: { id: string } }>("/appointments/:id/resend-reminder", async (request, reply) => {
    const clinicId = request.staffUser!.clinicId;
    const appointment = await appointmentsService.getAppointment(clinicId, request.params.id);
    if (!appointment) {
      return reply.code(404).send({ error: "not_found", message: "Appointment not found" });
    }

    const [clinic, patient] = await Promise.all([
      prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } }),
      prisma.patient.findUniqueOrThrow({ where: { id: appointment.patientId } }),
    ]);

    const body = renderReminderSms({
      clinicName: clinic.name,
      clinicTimezone: clinic.timezone,
      startsAt: appointment.startsAt,
    });

    const result = await smsService.send({
      clinicId,
      to: patient.phone,
      body,
      appointmentId: appointment.id,
    });

    return reply.send({ sent: result.success, providerStatus: result.providerStatus });
  });
}
