# Confirmly — UI/UX Overhaul Plan

## Context

The original build (Phases 1-5 in [`implementation-plan.md`](../implementation-plan.md)) shipped a functionally complete pilot: staff auth, appointment CRUD, SMS reminders, patient self-service, waitlist auto-fill, and pilot-readiness polish. It was built for functional correctness, not visual/UX quality — the staff dashboard is currently a bare, unstyled shell (see screenshot: plain links, black background from an unstyled `prefers-color-scheme` default, no visual hierarchy at all).

A codebase review surfaced the underlying cause: **two incompatible styling paradigms coexist in `apps/web`**. The patient-facing `/c/[token]` page correctly uses Tailwind CSS (already installed, v4, zero-config), while every staff-facing page (login, dashboard home, appointments, waitlist, settings, the calendar, the appointment modal) uses raw inline `style={{...}}` objects exclusively. There is no shared component layer anywhere (no Button/Card/Input/Modal/Table/Badge/Toast), no icon system, no confirmation dialogs before destructive actions, no loading/empty states, dead dark-mode CSS variables actively fighting a hardcoded Arial font override, and the page still carries the unmodified `create-next-app` title ("Create Next App") and no favicon/branding.

This matters beyond aesthetics: the dashboard is a workflow tool a non-technical clinic front-desk staffer will use all day, and the pilot clinic's willingness to keep using it (vs. reverting to paper) depends on it feeling trustworthy and fast, not like an unfinished prototype. The goal of this plan is to fix that — establish a real, lightweight design system and apply it across every existing page — before approaching additional pilot clinics.

**Intended outcome:** a staff dashboard that looks and feels like a finished product (consistent components, clear status colors, confirmations before destructive actions, useful at-a-glance information on the dashboard home) while keeping the patient-facing `/c/[token]` page exactly as lightweight as it is today — this is a non-negotiable constraint (see `CLAUDE.md`: patient surface must stay fast on low-end Android + PH mobile data).

## Confirmed Decisions Baked Into This Plan

- **Styling approach: Tailwind v4 (already installed) + a small hand-rolled primitives layer in `apps/web/components/ui/`** — not a full shadcn/ui CLI install, not CSS Modules, not a CSS-in-JS library. Tailwind already exists and is already the *correct* paradigm on the patient page; extending it to the dashboard reconciles the split rather than adding a third system. The primitive surface needed here (button, input, select, card, badge, table, dialog, confirm-dialog, toast, empty state, skeleton) is small enough (~10 components) that hand-rolling them with `class-variance-authority` for variants is faster to build and easier for a solo founder to own/debug than adopting a CLI-managed component library.
- **Modal/dialog primitive: native `<dialog>` element**, not Radix Dialog or Headless UI — built-in focus trap and ESC-to-close, zero JS dependency, fixes the current `AppointmentForm` accessibility gap for free.
- **New small dependencies:** `clsx` + `tailwind-merge` (combined into a `cn()` helper), `class-variance-authority` (variant styling), `lucide-react` (tree-shakeable icons, dashboard-only), `zod` (added to `apps/web` for dashboard form validation — mirrors shapes already validated server-side in `apps/api`, does not import across the app boundary).
- **No new dependencies for:** dates (native `Date`/`Intl` + existing `components/calendar/slots.ts` logic is sufficient at this scale), animation (Tailwind's built-in `transition-*`/`animate-*` utilities only), toasts (hand-rolled context + component, not a library).
- **Visual direction:** light mode only (dead dark-mode CSS vars removed, not implemented — halves the QA surface with no clinic ever having asked for dark mode). A calm single-accent palette (one brand color — teal or blue, pick one during Phase 1) on a warm neutral canvas, with consistent semantic status colors (green=confirmed, amber=pending/offered, red=cancelled/no-show) replacing today's raw inline red/green backgrounds. Medium information density optimized for scanning — large tap targets, colored status badges, generous whitespace — not a dense data-grid look. Keep the already-imported Geist Sans font (currently overridden by a hardcoded Arial rule — just stop overriding it).
- **Patient page (`/c/[token]`) stays Tailwind, gets token-aligned, does not import the new dashboard primitives** — it shares design tokens (colors, radius) defined once in `globals.css`, but keeps its own tiny local `PatientButton` (Phase 5) so its bundle never depends on `components/ui/`. This is enforced with an explicit bundle-size guardrail check in Phase 1 and re-verified in Phase 5.

## Guardrail (checked at Phase 1 and Phase 5)

Run `pnpm --filter web build` and compare the `/c/[token]` route's reported First Load JS before and after each check. Any non-trivial growth means a dashboard-only dependency (lucide-react, cva, zod, `components/ui/*`) has leaked into the patient bundle through a shared import — this must be fixed (typically: ensure `components/patient/*` never imports from `components/ui/*`) before the phase is considered done. This directly protects the CLAUDE.md non-negotiable that the patient surface must stay fast on low-end Android + PH mobile data.

## Phases

1. **[Foundation](./phase1-foundation.md)** — design tokens, branding fixes, and the full `components/ui/` primitives layer (button, input, card, badge, table, dialog, confirm-dialog, toast). No page content changes yet — everything still works identically at the end.
2. **[Auth & Layout Shell](./phase2-shell.md)** — migrate login and the dashboard nav shell onto the new primitives; add active-link state, icons, logout, basic responsive nav.
3. **[Dashboard Home](./phase3-dashboard-home.md)** — turn the empty dashboard landing page into an actual at-a-glance view (today's appointments, no-show count, pending waitlist offers).
4. **[Calendar, Appointment Form & Waitlist](./phase4-calendar-waitlist.md)** — migrate the highest-inline-style-debt, highest-traffic surfaces; fix the appointment modal's accessibility gap; add confirmation dialogs before destructive actions.
5. **[Settings, Patient-Page Alignment & Final Polish](./phase5-polish.md)** — finish the last page, align patient-page tokens with the dashboard without adding weight, run the final accessibility/inline-style/bundle-size sweep.

## Critical Files

- `apps/web/components/ui/` (new) — the entire primitive layer, created in Phase 1, consumed by every later phase.
- `apps/web/app/globals.css` — single source of design tokens (`@theme` block: brand color, status colors, radius scale); currently the unmodified `create-next-app` scaffold with dead dark-mode vars and a stray Arial override.
- `apps/web/lib/cn.ts` (new) — class-merge helper used by every new/rebuilt component.
- `apps/web/app/dashboard/layout.tsx` — nav shell wrapping every dashboard page; rebuilt in Phase 2, load-bearing for everything after.
- `apps/web/components/calendar/AppointmentForm.tsx` and `DayCalendar.tsx` — highest inline-style debt, highest-traffic staff UI, and the specific accessibility gap (no focus trap/ESC handling) called out below.
- `apps/web/components/patient/*` — must stay isolated from `components/ui/` per the bundle-size guardrail.

## Verification Approach

Each phase file has its own per-step "Done" criteria (visual smoke checks, keyboard/accessibility checks, functional regression checks against existing API behavior). Two cross-cutting checks apply across the whole plan: the bundle-size guardrail above, and a final grep sweep (Phase 5) confirming no `style={{` usage remains in `apps/web/app` or `apps/web/components` outside the primitives layer itself. Because this is a pure frontend/UX overhaul, no `apps/api` behavior should change — every "Done" criterion should confirm the underlying functionality (login, booking, cancellation, waitlist offers, settings save) still works exactly as before, just presented better.
