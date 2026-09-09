# UI/UX Phase 3 — Dashboard Home: At-a-Glance View

Turn the nearly-empty dashboard home into the tool's actual value-prop surface — visibility into today's schedule and no-shows is core to what clinics are paying for, so this gets its own phase rather than being folded into generic "polish."

Full context, confirmed decisions, and the bundle-size guardrail: see [`overview.md`](./overview.md).

## Step 1 — Decide data source for at-a-glance stats

**Depends on:** Phase 1 (primitives), Phase 2 (nav shell this page lives inside).

**Build:** determine whether today's appointment count, this week's no-show count, pending/unclaimed waitlist offers, and unconfirmed appointments in the next 24h can be computed client-side from data already fetched by existing endpoints (likely sufficient at single-pilot-clinic data volume), or whether a small new summary endpoint is warranted. Prefer client-side computation — avoid new API surface unless it proves impractical.

**Files:** possibly `apps/api/src/routes/dashboard-summary.ts` (only if client-side computation proves impractical), `apps/web/lib/api-client.ts` (extend if a new endpoint is added).

**Done:** a documented choice (client-computed vs. new endpoint) that returns correct counts against real/seeded pilot data.

## Step 2 — `StatCard` component

**Depends on:** Step 1.

**Build:** a card (extends the Phase 1 `Card` primitive) showing a label, a large number, and an optional icon/trend indicator.

**Files:** `apps/web/components/dashboard/StatCard.tsx`.

**Done:** renders correctly with real data for at least the four stats named above.

## Step 3 — Rebuild the dashboard home page

**Depends on:** Step 2.

**Build:** replace the current bare `<h1>Dashboard</h1>` / "Signed in as..." page with a `StatCard` grid plus a "today's appointments" quick-list (compact `Table` showing time/patient/status `Badge`, linking into the full appointments view), and a new `EmptyState` primitive for days/clinics with zero appointments.

**Files:** `apps/web/app/dashboard/page.tsx`, `apps/web/components/ui/EmptyState.tsx` (new primitive, reused in Phase 4).

**Done:** the dashboard home shows real counts and today's appointment list on load; a day with zero appointments shows a friendly empty state, not a blank page; no placeholder copy remains.

## Step 4 — Loading skeleton state

**Depends on:** Step 3.

**Build:** show the Phase 1 `Skeleton` primitive in place of stat cards/list while data is fetching.

**Files:** `apps/web/app/dashboard/page.tsx` (extend).

**Done:** on a throttled connection (Chrome devtools "Slow 3G"), the dashboard shows skeleton placeholders rather than a blank screen or a layout shift once data arrives.
