# Phase 1 — Foundation

Monorepo scaffold, schema, staff auth, manual appointment CRUD dashboard, deployed to real hosting. Everything later depends on this.

Full context, confirmed decisions, and cross-phase assumptions: see [`implementation-plan.md`](./implementation-plan.md).

## Step 1 — Init pnpm + Turborepo skeleton

**Depends on:** nothing (first step).

**Build:** root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, root `tsconfig.base.json`, `.gitignore`. No app/package code yet.

**Files:** `confirmly/package.json`, `confirmly/pnpm-workspace.yaml`, `confirmly/turbo.json`, `confirmly/tsconfig.base.json`, `confirmly/.gitignore`.

**Done:** `pnpm install` succeeds at root; `pnpm turbo run build` runs without error (no-op, no packages yet); committed to git.

## Step 2 — Scaffold `packages/config`

**Depends on:** Step 1.

**Build:** shared ESLint config, shared base `tsconfig.json`, Prettier config, packaged as an installable pnpm workspace package.

**Files:** `packages/config/eslint-preset.js`, `packages/config/tsconfig.base.json`, `packages/config/prettier.config.js`, `packages/config/package.json`.

**Done:** another workspace package can extend this tsconfig/ESLint config; lint and typecheck run cleanly against it.

## Step 3 — Scaffold `packages/shared-types`

**Depends on:** Step 2.

**Build:** TS package holding DTOs shared between `apps/web`/`apps/api` — API contract shapes, distinct from the Prisma models defined in Step 4. Minimal content is fine; it just needs to be wired up.

**Files:** `packages/shared-types/src/index.ts`, `packages/shared-types/package.json`, `packages/shared-types/tsconfig.json` (extends `packages/config`).

**Done:** builds without error; importable by name (`@confirmly/shared-types`) from another workspace package.

## Step 4 — Scaffold `packages/db` + author Prisma schema

**Depends on:** Step 2. (A local/reachable Postgres is needed to run migrations — Docker Postgres is fine here; Step 5 provisions the real hosted one.)

**Build:** Prisma schema for the 6 core entities, plus the generated client exported from the package.

- **`Clinic`** — id, name, timezone, sms_sender_name, subscription_status, timestamps.
- **`StaffUser`** — id, clinic_id (FK), email, password_hash (+ whatever session/key tables Lucia requires — see Step 7), role, timestamps.
- **`Patient`** — id, clinic_id (FK), name, phone (E.164), timestamps; unique `(clinic_id, phone)`.
- **`Appointment`** — id, clinic_id (FK), patient_id (FK), resource_id (nullable, v1 single-resource), starts_at, ends_at, status enum (`scheduled`,`confirmed`,`cancelled`,`no_show`,`completed`), reminder_sent_at (nullable), timestamps.
- **`WaitlistEntry`** — id, clinic_id (FK), patient_id (FK), desired_start, desired_end, status enum (`waiting`,`offered`,`claimed`,`expired`,`cancelled`), timestamps.
- **`SmsLog`** — id, clinic_id (FK), direction enum (`in`,`out`), appointment_id (nullable FK), phone, body, provider_status, provider_message_id (nullable), created_at.

**Critical — no-overlap enforcement on `Appointment`:** two appointments for the same `clinic_id`+`resource_id` must never overlap in time. Prisma can't express a Postgres exclusion constraint natively:
1. Author schema/columns/types/indexes via Prisma.
2. Generate a migration with `prisma migrate dev --create-only` (don't apply yet).
3. Hand-edit the SQL to add `CREATE EXTENSION IF NOT EXISTS btree_gist;` and an `EXCLUDE USING gist` constraint on `(clinic_id WITH =, resource_id WITH =, tstzrange(starts_at, ends_at) WITH &&)`, scoped with a partial `WHERE` to exclude `cancelled` (and possibly `no_show`) from the overlap check.
4. Apply the migration.

**Files:** `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*/migration.sql` (hand-edited), `packages/db/src/index.ts` (exported Prisma client singleton), `packages/db/package.json`.

**Done:** migration applies cleanly locally; inserting two overlapping appointments for the same clinic+resource (both `scheduled`) is rejected by the database, not just app code; Prisma Studio shows all 6 tables.

## Step 5 — Provision Railway (or Render) + managed Postgres

**Depends on:** Step 4. **Requires:** a live Railway or Render account — provisions real cloud resources.

**Build:** create a Railway project (assumed default; Render works equivalently), add a managed Postgres addon, capture the `DATABASE_URL` securely (not committed).

**Files:** none in-repo beyond documenting required env var names in root `.env.example` and `packages/db/.env.example`.

**Done:** can connect to the managed Postgres locally with the captured `DATABASE_URL`; `prisma migrate deploy` runs successfully against it.

## Step 6 — Scaffold `apps/api` (Fastify)

**Depends on:** Steps 3-4.

**Build:** Fastify bootstrap, server entry point, env var loading/validation (e.g. zod schema), DB wiring, `GET /health` route.

**Files:** `apps/api/src/server.ts`, `apps/api/src/app.ts`, `apps/api/src/env.ts`, `apps/api/package.json`, `apps/api/tsconfig.json`.

**Done:** `pnpm --filter api dev` starts locally; `GET /health` returns 200 and confirms Postgres connectivity.

## Step 7 — Staff auth (Lucia session-based)

**Depends on:** Step 6.

*Assumption in effect: Lucia session-based auth over JWT — simpler cookie lifecycle for a small dashboard. Confirm before implementing.*

**Build:** signup/login/logout endpoints, httpOnly session cookies (secure in prod), auth guard middleware, password hashing, any Lucia-required Prisma tables added to the schema + migrated.

**Files:** `apps/api/src/auth/*`, additions to `packages/db/prisma/schema.prisma` + new migration.

**Done:** can create a `StaffUser`, log in via the API and receive a session cookie, hit a protected route with the cookie (200) and without it (401).

## Step 8 — Appointment CRUD API

**Depends on:** Step 7.

**Build:** create/list/get/update/cancel endpoints, scoped to the authenticated user's `clinic_id` (no cross-clinic leakage), request validation, double-booking DB constraint violations mapped to a clean `409` (not a raw 500).

**Files:** `apps/api/src/routes/appointments.ts`, `apps/api/src/services/appointments.ts`, `packages/shared-types/src/appointment.ts`.

**Done:** via curl/Postman — create, list, update all work; double-booked create returns a clean 409; a staff user can't see/modify another clinic's appointments.

## Step 9 — Patient CRUD (minimal)

**Depends on:** Step 7.

**Build:** find-or-create patient by clinic+phone, list patients.

**Files:** `apps/api/src/routes/patients.ts`, `apps/api/src/services/patients.ts`.

**Done:** can create a patient and attach to an appointment via API; re-creating an existing clinic+phone reuses the existing patient rather than duplicating/erroring.

## Step 10 — Scaffold `apps/web` (Next.js App Router)

**Depends on:** Steps 7-9.

**Build:** `/login` and `/dashboard` route shells, API client wrapper (fetch, credentials included for the session cookie), basic layout/nav.

**Files:** `apps/web/app/login/page.tsx`, `apps/web/app/dashboard/layout.tsx`, `apps/web/app/dashboard/page.tsx`, `apps/web/lib/api-client.ts`, `apps/web/package.json`.

**Done:** `pnpm --filter web dev` runs; can log in through the UI and land on `/dashboard` with a valid session cookie set.

## Step 11 — Dashboard calendar/slot view + manual CRUD UI

**Depends on:** Step 10.

*Assumption in effect: 30-minute slot granularity; pilot clinic uses a single resource.*

**Build:** slot calendar view (polling/refetch-on-focus is enough at this scale, no websockets), create/edit/cancel appointment forms/modals wired to Step 8's API.

**Files:** `apps/web/app/dashboard/appointments/*`, `apps/web/components/calendar/*`.

**Done:** staff creates an appointment via the UI and it persists in Postgres (verifiable via Prisma Studio or refresh); double-booking attempt in the UI surfaces the 409 as a clear user-facing error, not a silent failure.

## Step 12 — Deploy `apps/api` and `apps/web` as two Railway services

**Depends on:** Steps 5-11. **Requires:** the live Railway/Render account from Step 5.

**Build:** one Railway service per app pointing at this monorepo with correct build/start commands (e.g. `pnpm --filter api build && pnpm --filter api start`, equivalent for web); env vars per service (`DATABASE_URL`, session secret, `NEXT_PUBLIC_API_URL`); git-push-to-deploy on `main`.

**Files:** `apps/api/railway.json` or `nixpacks.toml` if needed, equivalent for `apps/web`, root `.env.example` documenting required vars (names only).

**Done:** pushing to `main` redeploys both services automatically; the live dashboard can create/view appointments against the live API and managed Postgres — the full Phase 1 loop works in production.
