import type { SmsSender } from "./types";
import { createSemaphoreSmsSender, type SemaphoreConfig } from "./adapters/semaphore";

export type { SmsSendResult, SmsSender, InboundSmsMessage, ParsedInboundSms } from "./types";
export { createSemaphoreSmsSender, type SemaphoreConfig } from "./adapters/semaphore";

export type SmsProvider = "semaphore";

export function createSmsSender(provider: SmsProvider, config: SemaphoreConfig): SmsSender {
  switch (provider) {
    case "semaphore":
      return createSemaphoreSmsSender(config);
    default:
      throw new Error(`Unknown SMS provider: ${provider as string}`);
  }
}
