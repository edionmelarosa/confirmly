import { prisma } from "@confirmly/db";
import { createSmsSender, type SmsSender } from "@confirmly/sms";
import type { Env } from "../env";

export interface SendClinicSmsParams {
  clinicId: string;
  to: string;
  body: string;
  appointmentId?: string | null;
}

export function createSmsService(env: Env, sender: SmsSender = createSmsSender("semaphore", {
  apiKey: env.SEMAPHORE_API_KEY ?? "",
  senderName: env.SEMAPHORE_SENDER_NAME,
})) {
  async function send(params: SendClinicSmsParams) {
    let result: Awaited<ReturnType<SmsSender["sendSms"]>>;

    if (env.SMS_MODE === "log") {
      console.log(`[sms:log] to=${params.to} body=${params.body}`);
      result = {
        success: true,
        providerStatus: "logged",
        providerMessageId: null,
        errorMessage: null,
      };
    } else {
      result = await sender.sendSms(params.to, params.body);
    }

    await prisma.smsLog.create({
      data: {
        clinicId: params.clinicId,
        direction: "out",
        appointmentId: params.appointmentId ?? null,
        phone: params.to,
        body: params.body,
        providerStatus: result.providerStatus,
        providerMessageId: result.providerMessageId,
      },
    });

    return result;
  }

  return { send };
}

export type SmsService = ReturnType<typeof createSmsService>;
