export interface SmsSendResult {
  success: boolean;
  providerStatus: string;
  providerMessageId: string | null;
  errorMessage: string | null;
}

export interface SmsSender {
  sendSms(to: string, body: string): Promise<SmsSendResult>;
}

export interface InboundSmsMessage {
  from: string;
  to: string;
  body: string;
  providerMessageId: string | null;
  receivedAt: Date;
}

export interface ParsedInboundSms extends InboundSmsMessage {
  raw: unknown;
}
