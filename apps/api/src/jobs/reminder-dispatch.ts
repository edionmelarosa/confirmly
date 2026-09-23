import cron from "node-cron";
import { prisma } from "@confirmly/db";
import type { SmsService } from "../services/sms";
import { renderReminderSms } from "../templates/sms";
import { createAccessToken } from "../services/tokens";
import type { Env } from "../env";

const MAX_LEAD_DAYS_CEILING = 14; // widest plausible clinic setting, bounds the initial DB query

export async function dispatchDueReminders(smsService: SmsService, env: Env) {
  const now = new Date();
  const widestWindowEnd = new Date(now.getTime() + MAX_LEAD_DAYS_CEILING * 24 * 60 * 60 * 1000);

  const candidates = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: now, lte: widestWindowEnd },
      reminderSentAt: null,
      status: { not: "cancelled" },
    },
    include: { clinic: true, patient: true },
  });

  const dueAppointments = candidates.filter((appointment) => {
    const windowEnd = new Date(now.getTime() + appointment.clinic.reminderLeadDays * 24 * 60 * 60 * 1000);
    return appointment.startsAt <= windowEnd;
  });

  for (const appointment of dueAppointments) {
    const { token } = await createAccessToken({
      purpose: "manage",
      appointmentId: appointment.id,
    });

    const manageLink = `${env.WEB_ORIGIN}/c/${token}`;

    const body = renderReminderSms({
      clinicName: appointment.clinic.name,
      clinicTimezone: appointment.clinic.timezone,
      startsAt: appointment.startsAt,
      schedulingMode: appointment.clinic.schedulingMode,
      sessionOfDay: appointment.sessionOfDay,
      sessionAmStartHour: appointment.clinic.sessionAmStartHour,
      sessionAmEndHour: appointment.clinic.sessionAmEndHour,
      sessionPmStartHour: appointment.clinic.sessionPmStartHour,
      sessionPmEndHour: appointment.clinic.sessionPmEndHour,
      manageLink,
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

export function startReminderDispatchJob(smsService: SmsService, env: Env) {
  return cron.schedule("0 * * * *", () => {
    dispatchDueReminders(smsService, env).catch((err) => {
      console.error("reminder-dispatch job failed", err);
    });
  });
}
