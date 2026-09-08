# Phase 5 — Polish for Pilot

Operational readiness for the actual dentist-clinic pilot.

Full context, confirmed decisions, and cross-phase assumptions: see [`implementation-plan.md`](./implementation-plan.md).

## Step 1 — Wire Sentry into `apps/api` and `apps/web`

**Depends on:** Phase 4 complete. **Requires:** a Sentry account (free tier) and a DSN per project.

**Build:** Sentry SDK init in both apps — error boundary in Next.js, unhandled-error hook in Fastify, DSN via env vars, source maps uploaded for readable stack traces.

**Files:** `apps/api/src/instrument.ts` (or a Fastify plugin), `apps/web/sentry.client.config.ts`, `apps/web/sentry.server.config.ts`.

**Done:** deliberately throwing a test error in each app (temporary debug route, hit once then removed) appears in the Sentry dashboard with a readable stack trace.

## Step 2 — Clinic-facing settings (reminder timing, SMS sender name)

**Depends on:** Step 1 (sequenced here per the plan; can run independently).

**Build:** settings UI + endpoint letting a clinic staff owner adjust reminder lead time (N) and SMS sender display name, persisted on `Clinic`.

**Files:** `apps/web/app/dashboard/settings/page.tsx`, `apps/api/src/routes/clinic-settings.ts`.

**Done:** changing the reminder lead time in settings changes which appointments the Phase 2 Step 4 cron job picks up on the next tick.

## Step 3 — Manual fallback / staff override paths

**Depends on:** Phases 1-4 complete (mostly UI wiring over existing endpoints, not new backend logic).

**Build:** "resend reminder now" button, manual status override (force-confirm/cancel/no_show regardless of SMS state), manual "send waitlist offer now" trigger.

**Files:** `apps/web/app/dashboard/appointments/*` (extend), `apps/web/app/dashboard/waitlist/*` (extend).

**Done:** staff can fully operate an appointment's lifecycle (confirm/reschedule/cancel/mark no-show/resend reminder) from the dashboard UI alone, with zero dependency on the patient's SMS actually working.

## Step 4 — Simple internal clinic provisioning path

**Depends on:** Phase 1 Step 7 (staff auth) at minimum; sequenced here as pilot-readiness polish.

*Note: per technical-plan.md §9, deliberately not a self-serve signup flow or multi-tenant admin panel — just a minimal internal tool.*

**Build:** a minimal internal script or single protected internal route to create a new `Clinic` + first `StaffUser` — run manually by the founder, not exposed publicly.

**Files:** `apps/api/src/scripts/provision-clinic.ts` (run via `pnpm --filter api exec`).

**Done:** founder can create a brand-new clinic + owner login for the pilot dentist by running one script/command, without touching the DB by hand.

## Step 5 — Pilot readiness pass

**Depends on:** Steps 1-4.

**Build (no new code — operational verification):**
- Production env vars complete on both Railway services.
- Sentry receiving events in production.
- One full real-world cycle using the founder's own phone as "patient": create appointment → receive reminder → reply "C" → dashboard reflects confirm → cancel via SMS → dashboard reflects cancellation.
- Rollback/redeploy plan documented and tested at least once (e.g. Railway's deployment history/rollback feature).

**Files:** none.

**Done:** one full end-to-end cycle (appointment creation through SMS confirm/cancel) completes successfully against the production deployment, using the founder's own phone.
