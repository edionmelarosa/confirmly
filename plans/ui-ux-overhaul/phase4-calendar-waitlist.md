# UI/UX Phase 4 — Calendar, Appointment Form & Waitlist Migration

Migrate the two most complex, highest-inline-style-debt surfaces — the day calendar + appointment modal, and the waitlist table/form — onto the shared primitives, and fix the appointment modal's accessibility gap. This is the largest phase; it's sequenced after the shell/home phases precisely because it's the riskiest to get wrong.

Full context, confirmed decisions, and the bundle-size guardrail: see [`overview.md`](./overview.md).

## Step 1 — Rebuild `AppointmentForm` on the `Dialog` primitive

**Depends on:** Phase 1 (`Dialog`, `ConfirmDialog`, toast, `Input`/`Select`/`Button`), Phase 3's `EmptyState`/`Skeleton` patterns for reference.

**Build:** replace the current hand-rolled `position: fixed; inset: 0` overlay in `AppointmentForm.tsx` with the Phase 1 `Dialog` primitive; rebuild its fields with `Input`/`Select`/`Button`; use `useToast()` for success/error feedback instead of inline text; wrap any destructive submit path (e.g. cancelling from within the form) with `ConfirmDialog`.

**Files:** `apps/web/components/calendar/AppointmentForm.tsx`.

**Done:** opening the form traps focus and closes on ESC/backdrop click (fixing the current accessibility gap); creating/editing an appointment round-trips to the API identically to before; no `style={{` remains in the file.

## Step 2 — Rebuild `DayCalendar`

**Depends on:** Step 1.

**Build:** replace the raw inline red/green backgrounds (`#fde8e8`/`#e8fdf0`) with the Phase 1 status-color tokens (via `Badge`/status-driven Tailwind classes); replace the raw date `<input>` and refresh `<button>` with `Input`/`Button` primitives; add a `Skeleton` loading state during refetch and an `EmptyState` for a day with zero slots/appointments.

**Files:** `apps/web/components/calendar/DayCalendar.tsx`.

**Done:** slot colors are visually consistent with the `Badge` status palette used elsewhere; no `style={{` remains; loading/empty states render correctly.

## Step 3 — Confirmation dialogs for destructive calendar actions

**Depends on:** Steps 1-2.

**Build:** wrap cancel-appointment and mark-no-show actions with `ConfirmDialog` wherever they're currently triggered directly without confirmation.

**Files:** `apps/web/components/calendar/DayCalendar.tsx` and/or `AppointmentForm.tsx`, wherever each action currently lives.

**Done:** clicking cancel/no-show shows a confirmation dialog first and only calls the API on explicit confirm; a toast confirms success/failure after the action completes.

## Step 4 — Rebuild the waitlist page

**Depends on:** Phase 1 primitives (independent of Steps 1-3, can run in parallel).

**Build:** replace the inline-styled add-entry form with `Input`/`Select`/`Button`, and the inline-styled HTML table with the `Table` primitive plus status `Badge`s (waiting/offered/claimed/expired/cancelled); add `EmptyState` for a zero-entry waitlist; add `ConfirmDialog` before removing/cancelling a waitlist entry.

**Files:** `apps/web/app/dashboard/waitlist/page.tsx`.

**Done:** adding/removing a waitlist entry works identically to before; no `style={{` remains; destructive removal requires confirmation.

## Step 5 — Update the appointments page wrapper

**Depends on:** Step 2.

**Build:** pass through any new props/loading states introduced by the rebuilt `DayCalendar`.

**Files:** `apps/web/app/dashboard/appointments/page.tsx`.

**Done:** page renders with no prop-type errors; functionally unchanged from a user's perspective aside from the visual/accessibility improvements above.
