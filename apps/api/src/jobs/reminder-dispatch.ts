import cron from "node-cron";
import { prisma } from "@confirmly/db";
import type { Env } from "../env";
import type { SmsService } from "../services/sms";
import { renderReminderSms } from "../templates/sms";

export async function dispatchDueReminders(env: Env, smsService: SmsService) {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + env.REMINDER_LEAD_HOURS * 60 * 60 * 1000);

  const dueAppointments = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: now, lte: windowEnd },
      reminderSentAt: null,
      status: { not: "cancelled" },
    },
    include: { clinic: true, patient: true },
  });

  for (const appointment of dueAppointments) {
    const body = renderReminderSms({
      clinicName: appointment.clinic.name,
      clinicTimezone: appointment.clinic.timezone,
      startsAt: appointment.startsAt,
    });

    await smsService.send({
      clinicId: appointment.clinicId,
      to: appointment.patient.phone,
      body,
      appointmentId: appointment.id,
    });

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return { dispatched: dueAppointments.length };
}

export function startReminderDispatchJob(env: Env, smsService: SmsService) {
  return cron.schedule("0 * * * *", () => {
    dispatchDueReminders(env, smsService).catch((err) => {
      console.error("reminder-dispatch job failed", err);
    });
  });
}
