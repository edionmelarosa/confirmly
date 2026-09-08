import type { FastifyReply, FastifyRequest } from "fastify";
import type { StaffUser } from "@confirmly/db";
import { validateSessionToken } from "./session";
import { getSessionToken, setSessionCookie, clearSessionCookie } from "./cookies";

declare module "fastify" {
  interface FastifyRequest {
    staffUser?: StaffUser;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = getSessionToken(request);
  if (!token) {
    return reply.code(401).send({ error: "unauthorized", message: "No session cookie" });
  }

  const { session, user } = await validateSessionToken(token);
  if (!session || !user) {
    clearSessionCookie(reply);
    return reply.code(401).send({ error: "unauthorized", message: "Invalid or expired session" });
  }

  setSessionCookie(reply, token, session.expiresAt);
  request.staffUser = user;
}
