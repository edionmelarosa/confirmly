import { prisma, type Patient } from "@confirmly/db";
import type { Env } from "../env";
import type { SmsService } from "./sms";
import { createAccessToken } from "./tokens";
import { checkWaitlistFill, slotFromAppointment } from "./waitlist";

export interface InboundSmsParams {
  phone: string;
  body: string;
  patient: Patient;
}

type ReplyKeyword = "confirm" | "reschedule" | "cancel" | "unrecognized";

function parseKeyword(body: string): ReplyKeyword {
  const normalized = body.trim().toUpperCase();
  if (normalized === "C") return "confirm";
  if (normalized === "R") return "reschedule";
  if (normalized === "X") return "cancel";
  return "unrecognized";
}

async function findPendingAppointment(patientId: string, clinicId: string) {
  return prisma.appointment.findFirst({
    where: {
      patientId,
      clinicId,
      status: { in: ["scheduled", "confirmed"] },
      startsAt: { gte: new Date() },
    },
    orderBy: { startsAt: "asc" },
  });
}

export function createInboundSmsHandler(env: Env, smsService: SmsService) {
  async function handleInboundSms(params: InboundSmsParams): Promise<void> {
    const { phone, body, patient } = params;
    const keyword = parseKeyword(body);

    const appointment = await findPendingAppointment(patient.id, patient.clinicId);
    if (!appointment) {
      await smsService.send({
        clinicId: patient.clinicId,
        to: phone,
        body: "We couldn't find an upcoming appointment for this number. Please contact the clinic directly.",
      });
      return;
    }

    switch (keyword) {
      case "confirm": {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: "confirmed" },
        });
        await smsService.send({
          clinicId: patient.clinicId,
          to: phone,
          body: "Thanks! Your appointment is confirmed.",
          appointmentId: appointment.id,
        });
        return;
      }
      case "cancel": {
        const cancelled = await prisma.appointment.update({
          where: { id: appointment.id },
          data: { status: "cancelled" },
        });
        await smsService.send({
          clinicId: patient.clinicId,
          to: phone,
          body: "Your appointment has been cancelled.",
          appointmentId: appointment.id,
        });
        await checkWaitlistFill(slotFromAppointment(cancelled));
        return;
      }
      case "reschedule": {
        const { token } = await createAccessToken({
          purpose: "reschedule",
          appointmentId: appointment.id,
        });
        const link = `${env.WEB_ORIGIN}/c/${token}`;
        await smsService.send({
          clinicId: patient.clinicId,
          to: phone,
          body: `To reschedule your appointment, tap this link: ${link} (expires in 48 hours)`,
          appointmentId: appointment.id,
        });
        return;
      }
      case "unrecognized": {
        await smsService.send({
          clinicId: patient.clinicId,
          to: phone,
          body: "Sorry, we didn't understand that. Reply C to confirm, R to reschedule, or X to cancel.",
          appointmentId: appointment.id,
        });
        return;
      }
    }
  }

  return { handleInboundSms };
}

export type InboundSmsHandler = ReturnType<typeof createInboundSmsHandler>;
