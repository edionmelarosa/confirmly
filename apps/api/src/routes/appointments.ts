import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/guard";
import { appointmentsService, DoubleBookingError } from "../services/appointments";
import { slotFromAppointment, type WaitlistService } from "../services/waitlist";

const createSchema = z.object({
  patientId: z.string().min(1),
  resourceId: z.string().min(1).nullable().optional(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

const updateSchema = z.object({
  patientId: z.string().min(1).optional(),
  resourceId: z.string().min(1).nullable().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  status: z.enum(["scheduled", "confirmed", "cancelled", "no_show", "completed"]).optional(),
});

export function registerAppointmentRoutes(app: FastifyInstance, waitlistService: WaitlistService): void {
  app.addHook("preHandler", requireAuth);

  app.post("/appointments", async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const clinicId = request.staffUser!.clinicId;

    try {
      const appointment = await appointmentsService.createAppointment({
        clinicId,
        ...body.data,
      });
      return reply.code(201).send(appointment);
    } catch (err) {
      if (err instanceof DoubleBookingError) {
        return reply.code(409).send({ error: "double_booking", message: err.message });
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
      const updated = await appointmentsService.updateAppointment(
        clinicId,
        request.params.id,
        body.data,
      );
      if (!updated) {
        return reply.code(404).send({ error: "not_found", message: "Appointment not found" });
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
}
