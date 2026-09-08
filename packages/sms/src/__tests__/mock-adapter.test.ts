import { test } from "node:test";
import assert from "node:assert/strict";
import type { SmsSender, SmsSendResult } from "../types";

function createMockSmsSender(): SmsSender {
  return {
    async sendSms(to, body): Promise<SmsSendResult> {
      return {
        success: true,
        providerStatus: "queued",
        providerMessageId: `mock-${to}-${body.length}`,
        errorMessage: null,
      };
    },
  };
}

test("mock adapter satisfies the SmsSender interface", async () => {
  const sender: SmsSender = createMockSmsSender();
  const result = await sender.sendSms("+639171234567", "Hello from test");
  assert.equal(result.success, true);
  assert.equal(result.providerStatus, "queued");
  assert.ok(result.providerMessageId);
});
