# UI/UX Phase 5 — Settings, Patient-Page Alignment & Final Polish

Finish the remaining page (settings), align the patient page's visual tokens with the dashboard's design system without adding weight to its bundle, and run a final cross-cutting consistency/accessibility/performance pass.

Full context, confirmed decisions, and the bundle-size guardrail: see [`overview.md`](./overview.md).

## Step 1 — Rebuild the settings page

**Depends on:** Phase 1 primitives.

**Build:** rebuild `apps/web/app/dashboard/settings/page.tsx` using `Input`/`Select`/`Button`/`Card`; use `useToast()` for save success/failure instead of inline text; add a `ConfirmDialog` if any setting change proves irreversible (check current fields — reminder lead time and SMS sender name are not, but confirm before skipping).

**Files:** `apps/web/app/dashboard/settings/page.tsx`.

**Done:** settings save round-trips identically to before; no `style={{` remains; save feedback is a toast, not inline text.

## Step 2 — Align patient-page tokens with the dashboard

**Depends on:** Phase 1 Step 2 (design tokens must exist).

**Build:** update `PatientSessionView.tsx`, `RescheduleView.tsx`, and `WaitlistClaimView.tsx` to reference the shared brand/status color tokens defined in `globals.css`'s `@theme` block instead of any hardcoded Tailwind classes that now diverge from the dashboard palette. Extract the button className string currently repeated verbatim across these files (`"rounded-lg bg-neutral-900 px-4 py-3 text-white active:bg-neutral-700"`) into one small `PatientButton` component local to `components/patient/` — explicitly **not** imported from `components/ui/`, to preserve bundle isolation.

**Files:** `apps/web/components/patient/PatientSessionView.tsx`, `RescheduleView.tsx`, `WaitlistClaimView.tsx`, `apps/web/components/patient/PatientButton.tsx` (new).

**Done:** the patient page visually reads as the same product as the dashboard (consistent brand color, radius, spacing) without importing anything from `components/ui/`; the repeated button className string no longer appears verbatim in more than one file.

## Step 3 — Re-run the bundle-size guardrail

**Depends on:** Step 2.

**Build:** no code — verification only.

**Files:** none.

**Done:** `pnpm --filter web build` shows `/c/[token]`'s First Load JS materially unchanged from the Phase 1 baseline, confirming Step 2's changes didn't leak dashboard weight into the patient bundle.

## Step 4 — Cross-cutting accessibility pass

**Depends on:** Phases 2-4 complete.

**Build:** verify color contrast of all new status badges/buttons against WCAG AA (manual/devtools contrast check); verify all interactive dashboard elements are keyboard-reachable in a sane tab order; verify every destructive action across the app goes through `ConfirmDialog` (grep for cancel/no-show/delete call sites not behind a confirm).

**Files:** none, or minor fixups wherever the checks fail.

**Done:** no status badge/button combination fails AA contrast; the full dashboard is operable via keyboard alone (tab/enter/esc) for one complete appointment-lifecycle walkthrough (create → confirm → reschedule → cancel).

## Step 5 — Final inline-style sweep

**Depends on:** Phases 2-4 complete, Step 1.

**Build:** grep `apps/web/app` and `apps/web/components` for any remaining `style={{` usage outside `components/ui/` (a couple of legitimate dynamic-positioning cases may remain — justify each with a one-line comment rather than removing).

**Files:** wherever the grep finds remaining instances.

**Done:** `grep -rn "style={{" apps/web/app apps/web/components` returns zero results outside `components/ui/`, or each remaining hit carries a one-line justification.
