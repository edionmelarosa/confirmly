# Confirmly — Implementation Plan

## Context

Confirmly is a pre-code, pre-PMF SaaS idea: SMS-first scheduling and no-show recovery for small Philippine clinics (dental first), validated so far only by the founder's own dentist relationship. `docs/business-plan.md` and `docs/technical-plan.md` define the product and architecture; no repository code exists yet. This plan turns the technical plan's build sequencing (§8: Foundation → Reminders → Patient self-service → Waitlist → Polish) into concrete, independently executable steps so the user can implement one step at a time in future sessions, rather than working from a business/technical narrative document.

Deployment is pulled forward into Phase 1 (rather than left to the end) so the pilot clinic has a real, usable environment as early as possible — this reflects the user's explicit choice to include Railway/Render + managed Postgres provisioning now, not later.

**Confirmed decisions baked into this plan:**
- SMS provider to build first: **Semaphore** (PH-local gateway).
- Package manager / monorepo tooling: **pnpm** + Turborepo (per technical-plan.md recommendation).
- Deployment: **included** — Railway/Render + managed Postgres provisioning is part of this plan, not deferred.

## Assumptions to Confirm During Execution

The source docs left these open; each step proceeds with a stated default — confirm/adjust when that step is actually executed, don't block planning on them now.

- **Reminder lead time N**: default 24 hours before appointment.
- **SMS reply keywords**: `C` (confirm), `R` (reschedule → reply gets a link, not free-text time parsing), `X` (cancel). Case-insensitive.
- **Tokenized link TTL**: 48h for reschedule links, 15min for waitlist claim links (urgency to avoid double-offering).
- **Token format**: opaque signed token stored server-side with expiry + purpose (not a self-contained JWT) — simpler to revoke/enforce single-use.
- **Timezone**: all times stored UTC, rendered in `Clinic.timezone`; pilot clinic assumed single timezone (Asia/Manila), no per-appointment override.
- **Slot granularity**: 30-minute increments; pilot clinic uses one resource (model supports multiple resources/chairs for later).
- **No-show detection**: manual only — staff marks `no_show` in dashboard; no automatic timeout logic in v1.
- **Waitlist matching**: date-range overlap only (no time-of-day preference) for v1.
- **Staff auth**: Lucia session-based (simpler cookie lifecycle for a small dashboard vs JWT).
- **Hosting**: Railway assumed (simpler managed Postgres + multi-service story); plan works equivalently on Render if preferred at execution time.

## Phase 1 — Foundation

Monorepo scaffold, schema, staff auth, manual appointment CRUD dashboard, deployed to real hosting. Everything later depends on this.

1. **Init pnpm + Turborepo skeleton** — root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `.gitignore`. Done: `pnpm install` and `pnpm turbo run build` succeed at root (no-op).
2. **Scaffold `packages/config`** — shared ESLint/tsconfig/Prettier config as an installable workspace package. Done: another package can extend it and lint/typecheck cleanly.
3. **Scaffold `packages/shared-types`** — DTOs shared between `apps/web`/`apps/api` (API contract shapes, not raw Prisma models). Done: importable by name from another workspace package.
4. **Scaffold `packages/db` + author Prisma schema** for `Clinic`, `StaffUser`, `Patient`, `Appointment`, `WaitlistEntry`, `SmsLog`.
   - `Clinic`: id, name, timezone, sms_sender_name, subscription_status, timestamps.
   - `StaffUser`: id, clinic_id, email, password_hash (+ Lucia session/key tables), role, timestamps.
   - `Patient`: id, clinic_id, name, phone (E.164), timestamps; unique (clinic_id, phone).
   - `Appointment`: id, clinic_id, patient_id, resource_id (nullable, v1 single-resource), starts_at, ends_at, status enum, reminder_sent_at, timestamps.
   - `WaitlistEntry`: id, clinic_id, patient_id, desired_start, desired_end, status enum, timestamps.
   - `SmsLog`: id, clinic_id, direction enum, appointment_id (nullable), phone, body, provider_status, provider_message_id, created_at.
   - **Critical**: no-overlap enforcement on `Appointment` per clinic+resource. Prisma can't express Postgres exclusion constraints directly — author schema via Prisma, then hand-edit the generated migration SQL (`prisma migrate dev --create-only`) to add `CREATE EXTENSION IF NOT EXISTS btree_gist;` and an `EXCLUDE USING gist` constraint on `(clinic_id, resource_id, tstzrange(starts_at, ends_at))` filtered to non-cancelled statuses.
   - Done: migrates cleanly locally; inserting two overlapping appointments for the same clinic+resource is rejected by the DB itself, not just app validation.
5. **Provision Railway (or Render) + managed Postgres** — capture `DATABASE_URL`. Done: `prisma migrate deploy` runs successfully against it from a local machine.
6. **Scaffold `apps/api` (Fastify)** — bootstrap, health check, env validation, DB wiring. Done: `pnpm --filter api dev` starts; `GET /health` returns 200 and confirms DB connectivity.
7. **Staff auth (Lucia)** — signup/login/logout, httpOnly session cookies, auth guard middleware, password hashing. Done: can create a StaffUser, log in, hit a protected route with the cookie (200) and without it (401).
8. **Appointment CRUD API** — create/list/get/update/cancel, scoped to the authenticated user's clinic, double-booking surfaced as a clean 409 (not a raw 500). Done: verified via curl/Postman including the 409 case.
9. **Patient CRUD (minimal)** — find-or-create by clinic+phone, list. Done: can create a patient and attach to an appointment via API.
10. **Scaffold `apps/web` (Next.js App Router)** — `/login`, `/dashboard` shells, API client with cookie credentials. Done: can log in through the UI and land on `/dashboard` with a valid session.
11. **Dashboard calendar/slot view + manual CRUD UI** — create/edit/cancel appointment forms, slot calendar (poll/refetch, no websockets needed at this scale). Done: staff creates an appointment via UI, it persists in Postgres; double-booking attempt surfaces the 409 as a clear UI error.
12. **Deploy `apps/api` and `apps/web` as two Railway services** — build/start commands per service, env vars (`DATABASE_URL`, session secret, `NEXT_PUBLIC_API_URL`), git-push-to-deploy on main. Done: pushing to main redeploys both; the live dashboard can create/view appointments against the live API and managed Postgres end-to-end.

## Phase 2 — Reminders

Automated SMS reminders N days before appointment, provider-agnostic, fully logged.

1. **Design `packages/sms` abstraction** — provider-agnostic interface (e.g. `sendSms(to, body): Promise<SmsSendResult>`), no Semaphore-specific shapes leaking into it. Done: compiles; a mock adapter can satisfy the interface.
2. **Semaphore adapter** — calls Semaphore's send-SMS API, maps responses into `SmsSendResult`, API key via env. Done: a real test SMS sends successfully; a malformed request returns a handled failure, not an exception.
3. **Wire `SmsLog` writes** into the send path (direction=out, appointment_id, phone, body, provider_status), regardless of success/failure. Done: one accurate `SmsLog` row per send attempt.
4. **node-cron reminder dispatch job** — hourly, finds appointments in the reminder window with `reminder_sent_at IS NULL` and not cancelled, sends via the SMS service, sets `reminder_sent_at`. Done: a seeded appointment gets exactly one reminder sent and `reminder_sent_at` populated; no re-send on later ticks.
5. **Reminder message content + sender identity** — template using `Clinic.sms_sender_name`/timezone. Done: a real received SMS is correctly formatted in local clinic time with clear confirm instructions.

## Phase 3 — Patient Self-Service

Confirm/cancel via SMS reply, reschedule via tokenized link — no login, no app.

1. **Inbound SMS webhook** (`POST /webhooks/sms/inbound`) — receives provider payload, logs raw inbound `SmsLog` row. *(Verify Semaphore's actual inbound-webhook support during execution — open question about the provider's API surface; polling may be a fallback.)* Done: a simulated inbound payload produces an `SmsLog` row with direction=in.
2. **Inbound keyword parsing + status update** — match phone to patient/pending appointment, parse C/R/X, apply status transition, send confirmation SMS back. Done: replying "C" flips the appointment to `confirmed` and logs the outbound confirmation; unrecognized keywords get a graceful fallback reply.
3. **Cancellation → waitlist-fill stub hook** — `X` triggers a stubbed `checkWaitlistFill(slot)` call site now, full logic in Phase 4. Done: stub call is verifiably invoked (e.g. log line) on cancellation.
4. **Tokenized link generation** — opaque signed token tied to (appointment_id or waitlist_entry_id, purpose, expiry), new `AccessToken` model. Done: a token can be created, looked up, and correctly reports valid/expired/used states.
5. **Token validation endpoint** (`GET /api/patient/session/:token`) — returns appointment+clinic context, or 410 Gone if expired/used. Done: valid token returns details; invalid/expired returns a clean error.
6. **`/c/[token]` patient page shell** — mobile-first Next.js dynamic route, fetches token session, shows current appointment, lists available slots. Done: a real token link opened on a phone browser (no login) renders correctly.
7. **Reschedule submission + double-booking reuse** (`POST /api/patient/session/:token/reschedule`) — reuses Phase 1's double-booking-safe update path, marks old token used, sends confirmation SMS. Done: successful reschedule updates Postgres and sends confirmation; reusing the token afterward is rejected (410); rescheduling into a taken slot is rejected cleanly.

## Phase 4 — Waitlist

Cancelled/unconfirmed slots auto-offer to the next matching waitlisted patient.

1. **Waitlist entry capture** — staff-side UI/endpoint to add a patient with a desired date range (patient self-serve signup out of scope for pilot). Done: staff creates a `WaitlistEntry` via dashboard, persisted as `waiting`.
2. **Auto-fill matching logic** — replace Phase 3's stub: find next matching waiting entry (date-range overlap, FIFO by creation time), transition to `offered`. Done: cancelling with a matching entry present flips it to `offered`; no match → no-op, no error.
3. **Waitlist offer SMS + short-TTL claim link** — reuse Phase 3 token infra (purpose=`waitlist_claim`), extend `/c/[token]` to branch on token purpose. Done: a waitlisted patient receives a working claim link within one request cycle of the cancellation.
4. **First-to-confirm-wins claim logic** — atomic claim endpoint (transaction/row lock) checks slot still open, books it, marks entry `claimed`, expires/notifies other simultaneously-offered entries. Done: two near-simultaneous claim attempts on the same slot yield exactly one success and one clean "no longer available" — verified with a manual concurrent-request test.

## Phase 5 — Polish for Pilot

Operational readiness for the actual dentist-clinic pilot.

1. **Wire Sentry into `apps/api` and `apps/web`** — SDK init, error boundaries, unhandled-error hooks, source maps. Done: a deliberate test error in each app appears in Sentry with a readable stack trace.
2. **Clinic-facing settings** — reminder lead time (N) and SMS sender name, persisted on `Clinic`. Done: changing lead time changes which appointments the Phase 2 cron picks up on the next tick.
3. **Manual fallback / staff override paths** — "resend reminder now", manual status override (force confirm/cancel/no_show), manual "send waitlist offer now" — mostly UI wiring over existing endpoints. Done: staff can run an appointment's full lifecycle from the dashboard alone with zero dependency on the patient's SMS actually working.
4. **Simple internal clinic provisioning** — one manual script/protected route to create a new `Clinic` + first `StaffUser` (per technical-plan.md §9: no self-serve signup, no multi-tenant admin panel). Done: founder can provision the pilot clinic + owner login via one command.
5. **Pilot readiness pass** (no new code) — verify prod env vars complete, Sentry receiving events in prod, one full real-world cycle using the founder's own phone (create appointment → reminder → reply C → dashboard reflects confirm → cancel via SMS → dashboard reflects cancel), and confirm the Railway rollback/redeploy path works. Done: one full cycle succeeds against production.

## Critical Files

- `packages/db/prisma/schema.prisma` — the 6-entity model plus the hand-authored no-overlap exclusion constraint; everything later depends on this being right.
- `packages/sms/src/index.ts` + `packages/sms/src/adapters/semaphore.ts` — the provider-agnostic abstraction that Reminders, Patient Self-Service, and Waitlist all call through.
- `apps/api/src/jobs/reminder-dispatch.ts` — cron entry point driving the reminder workflow.
- `apps/api/src/services/tokens.ts` + `apps/web/app/c/[token]/page.tsx` — tokenized-link mechanism reused by both reschedule (Phase 3) and waitlist claim (Phase 4).
- `apps/api/src/services/waitlist.ts` — stub-then-complete pattern bridging Phase 3's cancellation hook and Phase 4's full auto-fill logic.

## Verification Approach

Each step above has its own "Done" criterion, meant to be checked immediately after that step is executed (curl/Postman for API steps, browser for UI steps, Prisma Studio for data checks, real SMS to a test phone for SMS steps). Phase-level end-to-end checks: Phase 1 done = full appointment CRUD works in production; Phase 3 done = a real SMS reply changes appointment state visible in the dashboard; Phase 5 done = one complete real-world booking-to-confirmation-to-cancellation cycle succeeds against production using the founder's own phone as the test patient.
