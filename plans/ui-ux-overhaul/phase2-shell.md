# UI/UX Phase 2 — Auth & Layout Shell Migration

Migrate the login page and dashboard nav/layout shell off inline styles onto the Phase 1 primitives — the first user-visible change, low-risk because it's isolated to entry/shell, not the data-heavy pages yet.

Full context, confirmed decisions, and the bundle-size guardrail: see [`overview.md`](./overview.md).

## Step 1 — Rebuild the login page

**Depends on:** Phase 1 complete.

**Build:** rebuild `apps/web/app/login/page.tsx` using the `Input`, `Button`, and `Card` primitives; replace the inline error `<p>` with `useToast().error()` on failed login; add a loading state to the submit button (disabled + spinner icon from `lucide-react` during the request).

**Files:** `apps/web/app/login/page.tsx`.

**Done:** login succeeds/fails functionally identically to before; a failed login shows a toast instead of inline text; no `style={{` remains in the file.

## Step 2 — Rebuild the dashboard nav shell

**Depends on:** Step 1 (shares the same primitives; can run independently if needed).

**Build:** rebuild `apps/web/app/dashboard/layout.tsx` as a proper nav shell — wordmark + clinic name, nav links with `lucide-react` icons (calendar, waitlist/users, settings) and active-link styling via `usePathname()`, and a logout button that calls the existing logout endpoint through `lib/api-client.ts` and redirects to `/login`.

**Files:** `apps/web/app/dashboard/layout.tsx`.

**Done:** the active nav link is visually distinguished on its route; logout ends the session and redirects to `/login`; no `style={{` remains in the file.

## Step 3 — Basic responsive nav

**Depends on:** Step 2.

**Build:** collapse the nav to a top bar with a hamburger-triggered menu (using the Phase 1 `Dialog` primitive) below a `md:` breakpoint, so the shell doesn't visibly break if a staffer glances at the dashboard on a tablet/phone, even though the primary use case remains desktop/laptop.

**Files:** `apps/web/app/dashboard/layout.tsx` (extend).

**Done:** resizing the browser below `md` collapses the nav into a working hamburger menu; no layout overlap/breakage at 375px, 768px, and 1280px widths.

## Step 4 — Regression check on the patient page

**Depends on:** Steps 1-3.

**Build:** no code — verification only, since Phase 1 wrapped the root layout with `ToastProvider`.

**Files:** none.

**Done:** manually clicking through `/c/[token]` on a simulated mobile viewport shows no visual regression from the layout changes above.
