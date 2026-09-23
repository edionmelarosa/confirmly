import { randomBytes, createHash } from "node:crypto";
import { prisma, type AccessToken, type AccessTokenPurpose } from "@confirmly/db";

const RESCHEDULE_TOKEN_TTL_MS = 1000 * 60 * 60 * 48; // 48h
const WAITLIST_CLAIM_TOKEN_TTL_MS = 1000 * 60 * 15; // 15min
const MANAGE_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h
const INVITE_TO_BOOK_TOKEN_TTL_MS = 1000 * 60 * 60 * 24; // 24h

export const TOKEN_TTL_MS_BY_PURPOSE: Record<AccessTokenPurpose, number> = {
  reschedule: RESCHEDULE_TOKEN_TTL_MS,
  waitlist_claim: WAITLIST_CLAIM_TOKEN_TTL_MS,
  manage: MANAGE_TOKEN_TTL_MS,
  invite_to_book: INVITE_TO_BOOK_TOKEN_TTL_MS,
};

export interface CreateAccessTokenParams {
  purpose: AccessTokenPurpose;
  appointmentId?: string | null;
  waitlistEntryId?: string | null;
  patientId?: string | null;
  clinicId?: string | null;
}

export interface IssuedAccessToken {
  token: string;
  record: AccessToken;
}

function generateToken(): string {
  return randomBytes(24).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createAccessToken(params: CreateAccessTokenParams): Promise<IssuedAccessToken> {
  const token = generateToken();
  const ttlMs = TOKEN_TTL_MS_BY_PURPOSE[params.purpose];

  const record = await prisma.accessToken.create({
    data: {
      tokenHash: hashToken(token),
      purpose: params.purpose,
      appointmentId: params.appointmentId ?? null,
      waitlistEntryId: params.waitlistEntryId ?? null,
      patientId: params.patientId ?? null,
      clinicId: params.clinicId ?? null,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  });

  return { token, record };
}

export type AccessTokenState = "valid" | "expired" | "used" | "not_found";

export interface ResolvedAccessToken {
  state: AccessTokenState;
  record: AccessToken | null;
}

export async function resolveAccessToken(token: string): Promise<ResolvedAccessToken> {
  const record = await prisma.accessToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record) {
    return { state: "not_found", record: null };
  }
  if (record.usedAt) {
    return { state: "used", record };
  }
  if (Date.now() >= record.expiresAt.getTime()) {
    return { state: "expired", record };
  }

  return { state: "valid", record };
}

export async function markAccessTokenUsed(id: string): Promise<void> {
  await prisma.accessToken.update({
    where: { id },
    data: { usedAt: new Date() },
  });
}
