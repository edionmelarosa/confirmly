import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "@confirmly/db";
import { hashPassword, verifyPassword } from "./password";
import { generateSessionToken, createSession, invalidateSession, validateSessionToken } from "./session";
import { setSessionCookie, clearSessionCookie, getSessionToken } from "./cookies";
import { requireAuth } from "./guard";

const signupSchema = z.object({
  clinicId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().min(1).default("staff"),
});

const loginSchema = z.object({
  clinicId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: FastifyInstance): void {
  app.post("/auth/signup", async (request, reply) => {
    const body = signupSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const { clinicId, email, password, role } = body.data;

    const existing = await prisma.staffUser.findUnique({
      where: { clinicId_email: { clinicId, email } },
    });
    if (existing) {
      return reply.code(409).send({ error: "conflict", message: "Email already in use" });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.staffUser.create({
      data: { clinicId, email, passwordHash, role },
    });

    const token = generateSessionToken();
    const session = await createSession(token, user.id);
    setSessionCookie(reply, token, session.expiresAt);

    return reply.code(201).send({ id: user.id, email: user.email, role: user.role });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "invalid_request", message: body.error.message });
    }

    const { clinicId, email, password } = body.data;

    const user = await prisma.staffUser.findUnique({
      where: { clinicId_email: { clinicId, email } },
    });
    if (!user) {
      return reply.code(401).send({ error: "invalid_credentials", message: "Invalid email or password" });
    }

    const validPassword = await verifyPassword(user.passwordHash, password);
    if (!validPassword) {
      return reply.code(401).send({ error: "invalid_credentials", message: "Invalid email or password" });
    }

    const token = generateSessionToken();
    const session = await createSession(token, user.id);
    setSessionCookie(reply, token, session.expiresAt);

    return reply.send({ id: user.id, email: user.email, role: user.role });
  });

  app.post("/auth/logout", { preHandler: requireAuth }, async (request, reply) => {
    const token = getSessionToken(request);
    if (token) {
      const { session } = await validateSessionToken(token);
      if (session) {
        await invalidateSession(session.id);
      }
    }
    clearSessionCookie(reply);
    return reply.send({ status: "ok" });
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.staffUser!;
    return reply.send({ id: user.id, email: user.email, role: user.role, clinicId: user.clinicId });
  });
}
