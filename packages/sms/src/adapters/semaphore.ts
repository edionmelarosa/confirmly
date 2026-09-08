import type { SmsSendResult, SmsSender } from "../types";

export interface SemaphoreConfig {
  apiKey: string;
  senderName?: string;
  apiUrl?: string;
}

interface SemaphoreMessageResponse {
  message_id: number;
  status: string;
  recipient: string;
  message: string;
}

const DEFAULT_API_URL = "https://api.semaphore.co/api/v4/messages";

export function createSemaphoreSmsSender(config: SemaphoreConfig): SmsSender {
  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;

  async function sendSms(to: string, body: string): Promise<SmsSendResult> {
    const params = new URLSearchParams({
      apikey: config.apiKey,
      number: to,
      message: body,
    });
    if (config.senderName) {
      params.set("sendername", config.senderName);
    }

    let response: Response;
    try {
      response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
    } catch (err) {
      return {
        success: false,
        providerStatus: "network_error",
        providerMessageId: null,
        errorMessage: err instanceof Error ? err.message : "Unknown network error",
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        success: false,
        providerStatus: `http_${response.status}`,
        providerMessageId: null,
        errorMessage: `Non-JSON response from Semaphore (status ${response.status})`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        providerStatus: `http_${response.status}`,
        providerMessageId: null,
        errorMessage: extractErrorMessage(payload) ?? `Semaphore request failed with status ${response.status}`,
      };
    }

    const entry = Array.isArray(payload) ? (payload[0] as SemaphoreMessageResponse | undefined) : undefined;
    if (!entry || typeof entry.message_id === "undefined") {
      return {
        success: false,
        providerStatus: "unexpected_response",
        providerMessageId: null,
        errorMessage: extractErrorMessage(payload) ?? "Unexpected Semaphore response shape",
      };
    }

    return {
      success: true,
      providerStatus: entry.status,
      providerMessageId: String(entry.message_id),
      errorMessage: null,
    };
  }

  return { sendSms };
}

function extractErrorMessage(payload: unknown): string | null {
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    if (Array.isArray(obj.number) && typeof obj.number[0] === "string") return obj.number[0];
  }
  return null;
}
