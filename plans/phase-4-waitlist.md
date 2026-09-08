# Phase 4 — Waitlist

Cancelled/unconfirmed slots auto-offer to the next matching waitlisted patient.

Full context, confirmed decisions, and cross-phase assumptions: see [`implementation-plan.md`](./implementation-plan.md).

## Step 1 — Waitlist entry capture

**Depends on:** Phase 3 complete.

*Note: patient self-serve waitlist signup is out of scope for the pilot — staff add patients to the waitlist after a phone call, consistent with the "manual fallback always available" principle.*

**Build:** staff-side UI/endpoint to add a patient to the waitlist with a desired date range.

**Files:** `apps/api/src/routes/waitlist.ts`, `apps/api/src/services/waitlist.ts` (extend from the Phase 3 Step 3 stub), `apps/web/app/dashboard/waitlist/*`.

**Done:** staff can create a `WaitlistEntry` via the dashboard, persisted with status `waiting`.

## Step 2 — Auto-fill matching logic

**Depends on:** Step 1.

*Assumption in effect: waitlist matching is date-range overlap only (no time-of-day preference) for v1.*

**Build:** replace the Phase 3 Step 3 stub with the real `checkWaitlistFill(appointmentSlot)`: find the next matching waiting `WaitlistEntry` (date-range overlap, FIFO by creation time), transition it to `offered`.

**Files:** `apps/api/src/services/waitlist.ts` (complete implementation).

**Done:** cancelling with a matching waiting entry present flips it to `offered` (verifiable in Prisma Studio); no match → no-op, no error.

## Step 3 — Waitlist offer SMS + short-TTL claim link

**Depends on:** Step 2.

*Assumption in effect: waitlist claim links get a 15-minute TTL (shorter than the 48h reschedule TTL) — urgency avoids double-offering.*

**Build:** send an SMS offer with a claim link, reusing the Phase 3 token infrastructure (purpose=`waitlist_claim`); extend `/c/[token]` to branch its UI on token purpose (reschedule vs. waitlist-claim).

**Files:** `apps/api/src/services/waitlist.ts` (extend), `apps/web/app/c/[token]/page.tsx` (extend).

**Done:** a waitlisted patient receives a working claim link within one request cycle of the triggering cancellation.

## Step 4 — First-to-confirm-wins claim logic

**Depends on:** Step 3.

**Build:** an atomic claim endpoint (transaction/row lock) checking the slot is still open, booking it for the claimant, marking the entry `claimed`, and expiring/notifying any other simultaneously-offered entries that the slot is taken.

**Files:** `apps/api/src/routes/patient-session.ts` (extend for claim), `apps/api/src/services/waitlist.ts` (extend).

**Done:** two near-simultaneous claim attempts on the same freed slot (e.g. two curl calls fired back to back) result in exactly one successful booking and one clean "slot no longer available" response.
