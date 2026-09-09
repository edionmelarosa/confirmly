# UI/UX Phase 1 — Foundation: Design Tokens, Branding, and Core Primitives

Establish shared design tokens, kill the dual-styling-paradigm root cause, fix branding basics, and build the primitive component layer — without touching any page's actual layout/content yet, so the app keeps working identically at the end of this phase.

Full context, confirmed decisions, and the bundle-size guardrail: see [`overview.md`](./overview.md).

## Step 1 — Add new dependencies

**Depends on:** nothing (first step of the overhaul).

**Build:** add `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `zod` to `apps/web`'s dependencies.

**Files:** `apps/web/package.json`.

**Done:** `pnpm install` succeeds; each package is importable with no type errors.

## Step 2 — Design tokens in `globals.css`

**Depends on:** Step 1.

**Build:** rewrite `globals.css` to remove the dead `prefers-color-scheme` dark-mode block and the hardcoded `font-family: Arial` override (currently fighting the already-imported Geist Sans vars), and define real tokens via Tailwind v4's `@theme` block: one brand color scale (teal or blue — pick one), status colors (`--color-status-confirmed`, `--color-status-pending`, `--color-status-cancelled`, `--color-status-noshow`), a neutral scale reference, and a radius scale.

**Files:** `apps/web/app/globals.css`.

**Done:** `body` renders in Geist Sans (verified via devtools computed style, not Arial); no `prefers-color-scheme` block remains; `/login` and `/c/[token]` still render with no visual regression (colors intentionally still unapplied until later phases).

## Step 3 — Branding basics

**Depends on:** Step 2.

**Build:** replace the unmodified `create-next-app` metadata (title "Create Next App", generic description) in the root layout with real Confirmly branding, add a real favicon via Next's file-based metadata convention, and update `global-error.tsx`'s copy so it doesn't read as a template default either.

**Files:** `apps/web/app/layout.tsx`, `apps/web/app/icon.png` (or `favicon.ico`), `apps/web/app/global-error.tsx`.

**Done:** the browser tab shows "Confirmly" and a real favicon, not "Create Next App"; view-source shows a real meta description.

## Step 4 — `cn()` class-merge helper

**Depends on:** Step 1.

**Build:** a small helper combining `clsx` + `tailwind-merge` so variant class strings resolve Tailwind conflicts correctly (e.g. a later `px-4` override wins over an earlier `px-2`).

**Files:** `apps/web/lib/cn.ts` (new).

**Done:** a manual test case (`cn("px-2", condition && "px-4")`) resolves to the expected single padding class.

## Step 5 — Core UI primitives

**Depends on:** Steps 2, 4.

**Build:** the primitive layer every later phase consumes — `Button` (variants: primary/secondary/destructive/ghost, via `cva`), `Input`, `Select`, `Textarea`, `Card`, `Badge` (status-colored pill using Step 2's status tokens), `Table` (`Table`/`TableHead`/`TableRow`/`TableCell` wrappers), `Skeleton` (loading placeholder), plus a barrel `index.ts`.

**Files:** `apps/web/components/ui/Button.tsx`, `Input.tsx`, `Select.tsx`, `Textarea.tsx`, `Card.tsx`, `Badge.tsx`, `Table.tsx`, `Skeleton.tsx`, `index.ts`.

**Done:** each primitive renders in isolation (a throwaway test route is fine) with no console errors/warnings and visually consistent radius/spacing/color; nothing outside `components/ui/` imports them yet.

## Step 6 — Accessible `Dialog` primitive

**Depends on:** Step 5.

**Build:** a `Dialog` wrapping the native `<dialog>` element — open/close state, ESC-to-close and focus trap (both native to `<dialog>`), backdrop click-to-close, and a header/body/footer slot API. This is what fixes `AppointmentForm`'s current accessibility gap in Phase 4.

**Files:** `apps/web/components/ui/Dialog.tsx`.

**Done:** on a throwaway test page, the dialog opens/closes via mouse, ESC key, and backdrop click; tabbing cycles only within the dialog while it's open (verified manually via keyboard).

## Step 7 — `ConfirmDialog` primitive

**Depends on:** Step 6.

**Build:** a destructive-action confirmation dialog built on `Dialog` — title/message/confirm-label/cancel-label/`onConfirm` props. Used in Phase 4 for cancel/no-show and in Phase 5 for any destructive settings actions.

**Files:** `apps/web/components/ui/ConfirmDialog.tsx`.

**Done:** renders with keyboard-operable confirm/cancel buttons; the confirm callback fires exactly once per click (no double-fire on rapid clicks).

## Step 8 — Toast/notification system

**Depends on:** Step 5.

**Build:** a hand-rolled `ToastProvider` (React context + stack state) and `useToast()` hook exposing `toast.success()/error()/info()`, backed by a presentational `Toast` component, mounted once at the root layout so it's available to both `/dashboard/*` and `/c/[token]`.

**Files:** `apps/web/components/ui/ToastProvider.tsx`, `Toast.tsx`, `apps/web/app/layout.tsx` (wrap `children`).

**Done:** calling `useToast().success("test")` from a throwaway button shows a dismissable, auto-expiring toast; multiple toasts stack without visual overlap.

## Step 9 — Bundle-size guardrail check

**Depends on:** Steps 1-8.

**Build:** no code — verification only.

**Files:** none.

**Done:** `pnpm --filter web build` shows `/c/[token]`'s First Load JS unchanged (±trivial) from its pre-Phase-1 baseline, confirming the new dependencies and `components/ui/` additions haven't leaked into the patient bundle via a shared import chain.
