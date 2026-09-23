import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    SESSION_SECRET: z.string().min(1, "SESSION_SECRET is required"),
    WEB_ORIGIN: z.string().min(1).default("http://localhost:3000"),
    SMS_MODE: z.enum(["log", "live"]).optional(),
    SEMAPHORE_API_KEY: z.string().optional(),
    SEMAPHORE_SENDER_NAME: z.string().optional(),
    SENTRY_DSN: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const smsMode = data.SMS_MODE ?? (data.NODE_ENV === "production" ? "live" : "log");
    if (smsMode === "live" && !data.SEMAPHORE_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SEMAPHORE_API_KEY"],
        message: "SEMAPHORE_API_KEY is required when SMS_MODE is live (or defaults to live in production)",
      });
    }
  });

type EnvRaw = z.infer<typeof envSchema>;

export interface Env extends Omit<EnvRaw, "SMS_MODE"> {
  SMS_MODE: "log" | "live";
}

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
  }
  const data = result.data;
  const smsMode = data.SMS_MODE ?? (data.NODE_ENV === "production" ? "live" : "log");
  return {
    ...data,
    SMS_MODE: smsMode,
  };
}
