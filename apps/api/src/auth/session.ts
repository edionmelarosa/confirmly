import { randomBytes, createHash } from "node:crypto";
import { prisma, type StaffUser, type Session } from "@confirmly/db";

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEWAL_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // renew if < 15 days left

export function generateSessionToken(): string {
  return randomBytes(20).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionValidationResult =
  | { session: Session; user: StaffUser }
  | { session: null; user: null };

export async function createSession(token: string, userId: string): Promise<Session> {
  const sessionId = hashToken(token);
  return prisma.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
}

export async function validateSessionToken(token: string): Promise<SessionValidationResult> {
  const sessionId = hashToken(token);
  const result = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!result) {
    return { session: null, user: null };
  }

  const { user, ...session } = result;

  if (Date.now() >= session.expiresAt.getTime()) {
    await prisma.session.delete({ where: { id: sessionId } });
    return { session: null, user: null };
  }

  if (Date.now() >= session.expiresAt.getTime() - SESSION_RENEWAL_THRESHOLD_MS) {
    session.expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: session.expiresAt },
    });
  }

  return { session, user };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
}
