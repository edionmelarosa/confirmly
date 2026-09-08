import cron from "node-cron";
import { prisma } from "@confirmly/db";
import type { SmsService } from "../services/sms";
import { renderReminderSms } from "../templates/sms";

const MAX_LEAD_HOURS_CEILING = 24 * 14; // widest plausible clinic setting, bounds the initial DB query

export async function dispatchDueReminders(smsService: SmsService) {
  const now = new Date();
  const widestWindowEnd = new Date(now.getTime() + MAX_LEAD_HOURS_CEILING * 60 * 60 * 1000);

  const candidates = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: now, lte: widestWindowEnd },
      reminderSentAt: null,
      status: { not: "cancelled" },
    },
    include: { clinic: true, patient: true },
  });

  const dueAppointments = candidates.filter((appointment) => {
    const windowEnd = new Date(now.getTime() + appointment.clinic.reminderLeadHours * 60 * 60 * 1000);
    return appointment.startsAt <= windowEnd;
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

export function startReminderDispatchJob(smsService: SmsService) {
  return cron.schedule("0 * * * *", () => {
    dispatchDueReminders(smsService).catch((err) => {
      console.error("reminder-dispatch job failed", err);
    });
  });
}
