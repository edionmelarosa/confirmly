# Phase 3 — Patient Self-Service

Confirm/cancel via SMS reply, reschedule via tokenized link — no login, no app.

Full context, confirmed decisions, and cross-phase assumptions: see [`implementation-plan.md`](./implementation-plan.md).

## Step 1 — Inbound SMS webhook endpoint

**Depends on:** Phase 2 complete.

*Open question: verify Semaphore's actual inbound-webhook support before/during this step — flagged as unconfirmed in the technical plan. If unsupported, polling their inbound-messages endpoint is the fallback.*

**Build:** `POST /webhooks/sms/inbound` receiving the provider's inbound payload (or a polling job if webhooks aren't available), writing a raw inbound `SmsLog` row for every message.

**Files:** `apps/api/src/routes/webhooks-sms.ts`.

**Done:** a test inbound payload posted to the endpoint (curl, simulating the provider) produces an `SmsLog` row with `direction=in`.

## Step 2 — Inbound keyword parsing + appointment status update

**Depends on:** Step 1.

*Assumption in effect: reply keywords are `C` (confirm), `R` (reschedule → replies with a link), `X` (cancel). Case-insensitive, trimmed.*

**Build:** parser matching the sender's phone to a Patient/pending Appointment, extracting the keyword, applying the status transition, sending a confirmation SMS back; unrecognized keywords get a graceful fallback reply (e.g. "reply C/R/X") instead of being silently dropped.

**Files:** `apps/api/src/services/inbound-sms.ts`.

**Done:** replying "C" to a reminder (simulated via webhook) flips the matched Appointment to `confirmed` and logs an outbound confirmation SMS; unrecognized keyword triggers the fallback.

## Step 3 — Cancellation triggers waitlist-fill check (stub only)

**Depends on:** Step 2.

**Build:** on `X` → `cancelled`, call a stubbed `checkWaitlistFill(appointmentSlot)`. Full matching/offer logic deferred to Phase 4 — this step only establishes the call site/signature so Phase 4 doesn't need to touch Step 2 again.

**Files:** `apps/api/src/services/waitlist.ts` (stub only).

**Done:** cancelling via SMS reply calls the stub, verifiable via a log line, even though it does nothing functional yet.

## Step 4 — Tokenized link generation

**Depends on:** Step 3.

*Assumptions in effect: opaque signed token stored server-side with expiry + purpose (not a self-contained JWT); 48h TTL for reschedule links (waitlist claim links get a shorter TTL — see Phase 4 Step 3).*

**Build:** token issuance service generating a token tied to `(appointment_id or waitlist_entry_id, purpose, expires_at)`, persisted in a new `AccessToken` model, included in outbound SMS as a short link.

**Files:** `packages/db/prisma/schema.prisma` — add `AccessToken` model (id, token, purpose enum, appointment_id nullable FK, waitlist_entry_id nullable FK, expires_at, used_at nullable), new migration; `apps/api/src/services/tokens.ts`.

**Done:** a generated token round-trips — can be created, looked up, and correctly reports valid/expired/already-used states via isolated API tests.

## Step 5 — Token validation endpoint

**Depends on:** Step 4.

**Build:** `GET /api/patient/session/:token` — validates the token, returns appointment+clinic context, or `410 Gone` if expired/used. Backs the `/c/[token]` page's data fetch (Step 6).

**Files:** `apps/api/src/routes/patient-session.ts`.

**Done:** a valid token returns appointment details; an expired/used token returns a clean `410`, not a crash.

## Step 6 — Build `/c/[token]` patient page shell + reschedule flow

**Depends on:** Step 5.

**Build:** mobile-first Next.js dynamic route, fetches the token session, shows the current appointment, lists available slots (real-time query against Appointment for the clinic/resource) so the patient can pick a new one — no login.

**Files:** `apps/web/app/c/[token]/page.tsx`, `apps/web/components/patient/*`.

**Done:** opening a real token link on a phone browser (no login) renders the clinic's current appointment info correctly on mobile, fast on typical PH mobile data.

## Step 7 — Reschedule submission API + double-booking validation reuse

**Depends on:** Step 6.

**Build:** `POST /api/patient/session/:token/reschedule` reusing Phase 1's double-booking-safe appointment update path, marks the old token used, sends a confirmation SMS.

**Files:** `apps/api/src/routes/patient-session.ts` (extend), reuses `apps/api/src/services/appointments.ts`.

**Done:** submitting a reschedule to an open slot succeeds, updates Postgres, sends confirmation SMS; re-using the same token afterward is rejected (410); rescheduling into a taken slot is rejected cleanly, never resulting in a double-booked row.
