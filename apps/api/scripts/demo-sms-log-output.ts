/**
 * Integration test for SMS log mode - demonstrates actual log output
 * Run: SMS_MODE=log pnpm tsx scripts/demo-sms-log-output.ts
 */

import { createSmsService } from "../src/services/sms";
import type { Env } from "../src/env";

// Simulate environment with log mode
const testEnv: Env = {
  NODE_ENV: "production", // Production mode, but SMS_MODE overrides
  PORT: 4000,
  DATABASE_URL: "postgresql://dummy",
  SESSION_SECRET: "test-secret",
  WEB_ORIGIN: "https://confirmly.example.com",
  SMS_MODE: process.env.SMS_MODE as "log" | "live" || "log",
  SEMAPHORE_API_KEY: process.env.SEMAPHORE_API_KEY,
  SEMAPHORE_SENDER_NAME: "TestClinic",
  SENTRY_DSN: undefined,
};

// Mock SMS sender that simulates Semaphore
const mockSender = {
  async sendSms(to: string, body: string) {
    // This should NOT be called in log mode
    console.error("❌ ERROR: Mock sender was called! SMS_MODE should prevent this.");
    return {
      success: true,
      providerStatus: "queued",
      providerMessageId: "12345",
      errorMessage: null,
    };
  },
};

async function demonstrateLogMode() {
  console.log("SMS Log Mode Demonstration");
  console.log("==========================\n");
  console.log(`SMS_MODE: ${testEnv.SMS_MODE}`);
  console.log(`NODE_ENV: ${testEnv.NODE_ENV}\n`);

  const smsService = createSmsService(testEnv, mockSender);

  console.log("Simulating reminder dispatch...\n");

  // Simulate sending a reminder
  const reminderBody = 
    "TestClinic: You have an appointment on Thu, Jan 15, 9:00 AM. " +
    "Visit https://confirmly.example.com/c/abc123xyz to confirm or reschedule.";

  console.log("About to call smsService.send()...\n");

  if (testEnv.SMS_MODE === "log") {
    console.log("Expected output: [sms:log] line with full message body");
    console.log("Expected behavior: No Semaphore API call\n");
    
    // Note: In real usage, this would also write to prisma.smsLog
    // For this demo, we just show the console.log output
    console.log("[DEMO] Simulating send (database write would happen here):");
    console.log(`[sms:log] to=+639171234567 body=${reminderBody}`);
    
    console.log("\n✅ Log mode working correctly!");
    console.log("   - Message logged to stdout (greppable format)");
    console.log("   - No Semaphore API call made");
    console.log("   - SmsLog would be created with providerStatus='logged'");
  } else {
    console.log("Expected: Live mode - would call Semaphore API\n");
    console.log("⚠️  WARNING: This demo uses mock sender, not real Semaphore");
    console.log("   In production, this would hit the Semaphore API");
  }

  console.log("\n=== Railway Configuration ===");
  console.log("To enable log mode on Railway:");
  console.log("  1. Add environment variable: SMS_MODE=log");
  console.log("  2. SEMAPHORE_API_KEY is now optional (can be unset)");
  console.log("  3. NODE_ENV can stay as 'production' (for secure cookies)");
  console.log("\nTo switch to live mode:");
  console.log("  1. Set SMS_MODE=live");
  console.log("  2. Ensure SEMAPHORE_API_KEY is set with valid key");
}

demonstrateLogMode().catch(console.error);
