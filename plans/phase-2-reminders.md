# Phase 2 — Reminders

Automated SMS reminders N days before appointment, provider-agnostic, fully logged.

Full context, confirmed decisions, and cross-phase assumptions: see [`implementation-plan.md`](./implementation-plan.md).

## Step 1 — Design `packages/sms` abstraction

**Depends on:** Phase 1 complete.

**Build:** provider-agnostic interface — e.g. `sendSms(to, body): Promise<SmsSendResult>` — plus inbound-parsing helper types, with no Semaphore-specific shapes leaking into the interface itself.

**Files:** `packages/sms/src/types.ts`, `packages/sms/src/index.ts` (exports interface + factory), `packages/sms/package.json`.

**Done:** interface compiles and is importable; a fake/mock adapter satisfying it can be written and used in a test.

## Step 2 — Semaphore adapter

**Depends on:** Step 1. **Requires:** a real Semaphore account/API key and test phone number to fully verify.

**Build:** concrete adapter calling Semaphore's send-SMS HTTP API, mapping its response/status codes into `SmsSendResult`, API key via env var.

**Files:** `packages/sms/src/adapters/semaphore.ts`.

**Done:** a manual test script sends a real SMS via Semaphore to a test phone and gets a successful `SmsSendResult`; a deliberately bad request (e.g. malformed number) returns a handled failure, not an exception.

## Step 3 — Wire `SmsLog` writes into the SMS abstraction call path

**Depends on:** Step 2.

**Build:** a thin service in `apps/api` that calls `packages/sms`, then writes an `SmsLog` row (direction=`out`, appointment_id, phone, body, provider_status) regardless of success/failure.

**Files:** `apps/api/src/services/sms.ts`.

**Done:** sending a test SMS through this service produces exactly one accurate `SmsLog` row, visible in Prisma Studio, including on failure.

## Step 4 — node-cron reminder dispatch job

**Depends on:** Step 3.

*Assumption in effect: reminder lead time N defaults to 24 hours before the appointment — confirm/adjust here.*

**Build:** an in-process cron job (hourly) that finds appointments with `starts_at` in the reminder window and `reminder_sent_at IS NULL` (not cancelled), sends via Step 3's service, sets `reminder_sent_at`. Wired to start on server boot.

**Files:** `apps/api/src/jobs/reminder-dispatch.ts`, wiring into `apps/api/src/server.ts`.

**Done:** a seeded appointment (starts_at = now + N hours, reminder_sent_at = null) gets exactly one reminder sent and `reminder_sent_at` populated within one tick; no re-send on later ticks.

## Step 5 — Reminder message content + clinic-level sender identity

**Depends on:** Step 4.

*Assumption in effect: times stored UTC, rendered using `Clinic.timezone` (pilot assumed Asia/Manila, single timezone, no per-appointment override).*

**Build:** message template with clinic name, date/time formatted in local clinic time, clear confirm instructions (referencing the reply keywords used in Phase 3); uses `Clinic.sms_sender_name` for sender identity where the provider supports it.

**Files:** `apps/api/src/templates/sms.ts`.

**Done:** a real reminder SMS received on a test phone reads correctly formatted in local clinic time with clear confirm instructions.
