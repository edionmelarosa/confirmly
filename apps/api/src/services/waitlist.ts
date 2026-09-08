import type { Appointment, WaitlistEntry } from "@confirmly/db";
import { prisma } from "@confirmly/db";
import type { Env } from "../env";
import type { SmsService } from "./sms";
import { createAccessToken } from "./tokens";

export interface AppointmentSlot {
  clinicId: string;
  resourceId: string | null;
  startsAt: Date;
  endsAt: Date;
}

export function slotFromAppointment(appointment: Appointment): AppointmentSlot {
  return {
    clinicId: appointment.clinicId,
    resourceId: appointment.resourceId,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
  };
}

export interface CreateWaitlistEntryParams {
  clinicId: string;
  patientId: string;
  desiredStart: Date;
  desiredEnd: Date;
}

async function createWaitlistEntry(params: CreateWaitlistEntryParams): Promise<WaitlistEntry> {
  return prisma.waitlistEntry.create({
    data: {
      clinicId: params.clinicId,
      patientId: params.patientId,
      desiredStart: params.desiredStart,
      desiredEnd: params.desiredEnd,
    },
  });
}

async function listWaitlistEntries(clinicId: string): Promise<WaitlistEntry[]> {
  return prisma.waitlistEntry.findMany({
    where: { clinicId },
    orderBy: { createdAt: "asc" },
  });
}

async function findNextMatchingEntry(slot: AppointmentSlot): Promise<WaitlistEntry | null> {
  return prisma.waitlistEntry.findFirst({
    where: {
      clinicId: slot.clinicId,
      status: "waiting",
      desiredStart: { lte: slot.endsAt },
      desiredEnd: { gte: slot.startsAt },
    },
    orderBy: { createdAt: "asc" },
  });
}

export function createWaitlistService(env: Env, smsService: SmsService) {
  async function sendOffer(entry: WaitlistEntry, slot: AppointmentSlot): Promise<void> {
    const patient = await prisma.patient.findUniqueOrThrow({ where: { id: entry.patientId } });

    await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: {
        status: "offered",
        offeredResourceId: slot.resourceId,
        offeredSlotStart: slot.startsAt,
        offeredSlotEnd: slot.endsAt,
      },
    });

    const { token } = await createAccessToken({
      purpose: "waitlist_claim",
      waitlistEntryId: entry.id,
    });
    const link = `${env.WEB_ORIGIN}/c/${token}`;

    await smsService.send({
      clinicId: slot.clinicId,
      to: patient.phone,
      body: `A slot just opened up matching your requested time. Tap to claim it (first come, first served): ${link} (expires in 15 minutes)`,
    });
  }

  async function checkWaitlistFill(slot: AppointmentSlot): Promise<void> {
    const entry = await findNextMatchingEntry(slot);
    if (!entry) {
      return;
    }
    await sendOffer(entry, slot);
  }

  async function sendWaitlistOfferNow(entryId: string, slot: AppointmentSlot): Promise<WaitlistEntry | null> {
    const entry = await prisma.waitlistEntry.findFirst({
      where: { id: entryId, status: "waiting" },
    });
    if (!entry) {
      return null;
    }
    await sendOffer(entry, slot);
    return entry;
  }

  return { createWaitlistEntry, listWaitlistEntries, checkWaitlistFill, sendWaitlistOfferNow };
}

export type WaitlistService = ReturnType<typeof createWaitlistService>;
