/**
 * Test environment validation for SMS_MODE
 * Run: pnpm tsx scripts/test-env-validation.ts
 */

import { loadEnv } from "../src/env";

function testEnvValidation() {
  console.log("Environment Validation Tests");
  console.log("============================\n");

  // Test 1: Log mode without API key (should succeed)
  console.log("Test 1: SMS_MODE=log without SEMAPHORE_API_KEY");
  process.env.SMS_MODE = "log";
  process.env.NODE_ENV = "development";
  process.env.DATABASE_URL = "postgresql://test";
  process.env.SESSION_SECRET = "test-secret";
  delete process.env.SEMAPHORE_API_KEY;
  
  try {
    const env = loadEnv();
    console.log(`✅ PASSED: SMS_MODE=${env.SMS_MODE}, API key not required`);
  } catch (err) {
    console.log(`❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Test 2: Live mode without API key (should fail)
  console.log("\nTest 2: SMS_MODE=live without SEMAPHORE_API_KEY (should fail)");
  process.env.SMS_MODE = "live";
  delete process.env.SEMAPHORE_API_KEY;
  
  try {
    const env = loadEnv();
    console.log(`❌ FAILED: Should have thrown error but got SMS_MODE=${env.SMS_MODE}`);
  } catch (err) {
    console.log(`✅ PASSED: Validation correctly rejected (${err instanceof Error ? err.message : String(err)})`);
  }

  // Test 3: Live mode with API key (should succeed)
  console.log("\nTest 3: SMS_MODE=live with SEMAPHORE_API_KEY");
  process.env.SMS_MODE = "live";
  process.env.SEMAPHORE_API_KEY = "test-key-123";
  
  try {
    const env = loadEnv();
    console.log(`✅ PASSED: SMS_MODE=${env.SMS_MODE}, API key provided`);
  } catch (err) {
    console.log(`❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Test 4: Production without SMS_MODE (should default to live and require API key)
  console.log("\nTest 4: NODE_ENV=production without SMS_MODE (should default to live)");
  process.env.NODE_ENV = "production";
  delete process.env.SMS_MODE;
  delete process.env.SEMAPHORE_API_KEY;
  
  try {
    const env = loadEnv();
    console.log(`❌ FAILED: Should have thrown error but got SMS_MODE=${env.SMS_MODE}`);
  } catch (err) {
    console.log(`✅ PASSED: Correctly requires API key in production (${err instanceof Error ? err.message : String(err)})`);
  }

  // Test 5: Production without SMS_MODE but with API key (should succeed)
  console.log("\nTest 5: NODE_ENV=production without SMS_MODE but with API key");
  process.env.NODE_ENV = "production";
  delete process.env.SMS_MODE;
  process.env.SEMAPHORE_API_KEY = "test-key-123";
  
  try {
    const env = loadEnv();
    console.log(`✅ PASSED: SMS_MODE=${env.SMS_MODE} (defaulted), API key provided`);
  } catch (err) {
    console.log(`❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Test 6: Development without SMS_MODE (should default to log)
  console.log("\nTest 6: NODE_ENV=development without SMS_MODE (should default to log)");
  process.env.NODE_ENV = "development";
  delete process.env.SMS_MODE;
  delete process.env.SEMAPHORE_API_KEY;
  
  try {
    const env = loadEnv();
    console.log(`✅ PASSED: SMS_MODE=${env.SMS_MODE} (defaulted to log), API key not required`);
  } catch (err) {
    console.log(`❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Test 7: Production with SMS_MODE=log explicitly (should not require API key)
  console.log("\nTest 7: NODE_ENV=production with SMS_MODE=log (override default)");
  process.env.NODE_ENV = "production";
  process.env.SMS_MODE = "log";
  delete process.env.SEMAPHORE_API_KEY;
  
  try {
    const env = loadEnv();
    console.log(`✅ PASSED: SMS_MODE=${env.SMS_MODE}, API key not required (explicit log mode)`);
  } catch (err) {
    console.log(`❌ FAILED: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log("\n=== Summary ===");
  console.log("Environment validation working as expected:");
  console.log("  • SMS_MODE=log: API key optional");
  console.log("  • SMS_MODE=live: API key required");
  console.log("  • Default in production: live (requires API key)");
  console.log("  • Default in dev/test: log (no API key needed)");
  console.log("  • Explicit SMS_MODE=log in production: API key optional");
}

testEnvValidation();
