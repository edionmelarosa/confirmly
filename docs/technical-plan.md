# Confirmly — Technical Plan

Companion to [business-plan.md](./business-plan.md). Covers architecture, stack, and build sequencing for v1 (single pilot clinic → 5-10 clinics).

Last updated: 2026-09-08

---

## 1. Design Principles

- **Optimize for solo-founder velocity, not scale.** At 1-10 clinics, total load is trivial (low hundreds of SMS/day, a handful of concurrent dashboard users). Every choice below favors shipping and debugging speed over theoretical scalability.
- **SMS is the product's nervous system.** Reminders, confirmations, reschedules, and waitlist offers all flow through SMS. The SMS provider integration must be reliable, observable, and provider-agnostic (see §4).
- **No native app, no build pipeline for patients.** Patient-facing surface is a single lightweight mobile web page reachable via SMS link — must load fast on low-end Android browsers on PH mobile data.
- **Don't build for a marketplace.** Single-tenant-per-clinic data model, not a multi-sided marketplace — matches the business plan's explicit non-goal (§2, §8 of business plan).

## 2. High-Level Architecture

```
                    ┌─────────────────────────┐
                    │   Next.js App           │
                    │  - /dashboard (staff)   │
                    │  - /c/[token] (patient) │
                    └───────────┬─────────────┘
                                │ REST/RPC
                    ┌───────────▼─────────────┐
                    │   Node.js API Server     │
                    │   (Express/Fastify)      │
                    │  - Auth (clinic staff)   │
                    │  - Appointments CRUD     │
                    │  - Waitlist logic        │
                    │  - SMS abstraction layer │
                    │  - Scheduled job runner  │
                    └───────┬───────┬──────────┘
                            │       │
                 ┌──────────▼─┐   ┌─▼────────────────┐
                 │ PostgreSQL │   │ SMS Gateway       │
                 │ (Railway)  │   │ (Semaphore/       │
                 │            │   │  Movider)         │
                 └────────────┘   └───────────────────┘
```

**Single deployable unit for v1:** one Node process serves both the API and (if using Next.js in the same repo) can be deployed as a separate Next.js service — two Railway/Render services total, one Postgres instance. No separate queue infra initially (see §5).

## 3. Monorepo Structure

Turborepo + npm/pnpm workspaces (pnpm recommended for disk efficiency and speed).

```
confirmly/
├── apps/
│   ├── web/              # Next.js — clinic dashboard + patient confirm/reschedule page
│   └── api/               # Node.js API server (Express/Fastify)
├── packages/
│   ├── db/                 # Prisma schema, migrations, generated client
│   ├── sms/                # SMS provider abstraction (see §4)
│   ├── shared-types/       # Shared TS types/DTOs between web and api
│   └── config/              # Shared eslint/tsconfig/prettier config
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

**Why split `web` and `api` rather than Next.js API routes for everything:** the scheduled reminder job (§5) and SMS webhook handlers (inbound SMS replies) are backend concerns that shouldn't be coupled to Next.js's request lifecycle or deploy cadence. Keeping a standalone API also makes the future "offload reminders to a worker" migration (business plan's hybrid path) a non-rewrite.

## 4. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere | Shared types between frontend/backend, catches errors before they hit a clinic's live calendar. |
| Frontend | Next.js (App Router) | One framework for both the authenticated dashboard and the public patient page; deploys cleanly to Railway/Render or Vercel. |
| Backend API | Node.js + Fastify (or Express) | Fastify preferred for built-in schema validation (TypeBox/Zod) and lower overhead; Express acceptable if team is more familiar. |
| Database | PostgreSQL | Relational fit for appointments/slots/waitlist with real constraints (no double-booking); Railway/Render both offer managed Postgres. |
| ORM | Prisma | Fast schema iteration, type-safe queries, easy migrations — good for pre-PMF speed. |
| SMS | Provider-agnostic abstraction over **Semaphore or Movider** (PH-local gateways) | Business-plan-critical channel; local gateways have better Globe/Smart deliverability and lower cost than Twilio for PH. Abstraction layer means switching or adding a fallback provider is a config change, not a rewrite. |
| Auth (staff) | Session-based auth via [Lucia](https://lucia-auth.com) or simple JWT + httpOnly cookie | Single clinic-staff login per clinic account; no need for a heavyweight auth provider at this scale. Revisit Clerk/Auth0 only if multi-staff-per-clinic roles get complex. |
| Patient identity | No login — signed, expiring tokenized links (`/c/[token]`) sent via SMS | Matches "zero install, zero friction" requirement in business plan §2/§3. Token maps to a specific appointment; short TTL. |
| Scheduled jobs | `node-cron` (or Postgres-backed job table) running in the API process | See §5 — no separate infra needed at this scale. |
| Hosting | Railway or Render | Git-push deploy, managed Postgres, cron/worker support, minimal ops for a solo founder. |
| Monorepo tool | Turborepo | Fast incremental builds/caching, low config overhead. |
| Error tracking | Sentry (free tier) | Non-negotiable given SMS delivery failures must be caught, not silently dropped. |
| SMS delivery logging | Dedicated `sms_log` table | Every outbound/inbound SMS recorded with status — critical for debugging "patient says they never got the reminder." |

## 5. Compute Model: Single Instance (not Lambda)

**Decision: single long-running instance, not serverless.**

Reasoning:
- Traffic is tiny and predictable (1-10 clinics, each with a handful of daily appointments) — Lambda's scale-to-zero benefit is irrelevant; you'd be paying Lambda's complexity tax for zero benefit.
- The reminder scheduler is naturally a long-running cron-style process — trivial with `node-cron` in a single instance, awkward with Lambda (requires EventBridge + Lambda + likely SQS for retry logic).
- Inbound SMS webhooks (patient replies "C" to confirm, "R" to reschedule) need a stable, always-warm endpoint — Lambda cold starts add latency and risk to a UX-critical path (patient waiting for a reply/redirect).
- Debugging is dramatically simpler: `railway logs` / `render logs` vs. distributed Lambda + CloudWatch tracing, especially valuable pre-PMF when you're iterating fast and solo.
- Cost at this scale: a single Railway/Render instance + Postgres runs ~$10-25/mo total. Lambda's savings only materialize at much higher, spikier scale than this business will see for a long while.

**Revisit trigger:** if/when reminder volume or dashboard concurrency genuinely grows past what one instance comfortably handles (realistically: dozens of clinics, thousands of daily SMS), consider the **hybrid path** — keep the API on a single instance, move only the scheduled SMS dispatch to AWS Lambda + EventBridge (or a managed queue like SQS) so bursty send volume doesn't block the main API. This is a targeted extraction, not a rewrite, because the SMS logic already lives behind the `packages/sms` abstraction.

## 6. Data Model (v1 sketch)

Core entities — refine once validated with the first clinic (per business plan §9):

- `Clinic` — id, name, timezone, SMS sender config, subscription status
- `StaffUser` — belongs to a Clinic, auth credentials
- `Patient` — belongs to a Clinic (not global — no cross-clinic patient directory, matches non-goal in business plan §2), name, phone number
- `Appointment` — clinic_id, patient_id, slot start/end, status (`scheduled`, `confirmed`, `cancelled`, `no_show`, `completed`), reminder_sent_at
- `WaitlistEntry` — clinic_id, patient_id, desired date range, status
- `SmsLog` — direction (in/out), appointment_id (nullable), phone, body, provider_status, created_at

Key constraint to enforce at the DB level: no two `Appointment`s for the same clinic can overlap on the same resource/slot (prevents double-booking bugs from ever reaching production).

## 7. Core Workflows

1. **Reminder dispatch** — cron job runs hourly, finds appointments N days out with `reminder_sent_at IS NULL`, sends SMS via `packages/sms`, logs to `SmsLog`, updates `reminder_sent_at`.
2. **Inbound SMS reply** — SMS gateway webhook → API parses keyword (`C`/`R`/`X` or similar) → updates `Appointment.status` → if cancelled, triggers waitlist-fill check.
3. **Reschedule via link** — SMS includes short link to `/c/[token]` → patient picks new slot from clinic's real-time availability → API validates against existing appointments (no double-booking) → confirms → sends confirmation SMS.
4. **Waitlist auto-fill** — on cancellation, API finds next matching `WaitlistEntry`, sends an SMS offer with a short claim link/TTL, first-to-confirm wins, others notified slot is taken.

## 8. Build Sequencing

Matches business plan's "validate with one clinic first" strategy — build only what the pilot needs before adding the next layer.

1. **Foundation:** monorepo scaffold, Postgres schema, staff auth, basic dashboard (view/create/edit appointments manually).
2. **Reminders:** SMS abstraction + Semaphore/Movider integration, cron-based reminder dispatch, `SmsLog`.
3. **Patient self-service:** inbound reply handling (confirm/cancel), tokenized `/c/[token]` reschedule page.
4. **Waitlist:** waitlist entry capture + auto-fill-on-cancellation flow.
5. **Polish for pilot:** error tracking (Sentry), basic clinic-facing settings (reminder timing, SMS sender name), manual fallback path (staff can always override/manual-send, per business plan §8 risk mitigation).

Steps 1-3 are the minimum viable pilot; steps 4-5 can follow once the core loop is validated with the founder's dentist clinic.

## 9. Explicit Non-Goals (Technical)

Mirrors business plan §2/§8 — do not build:
- Multi-clinic patient accounts or cross-clinic directory/search.
- Native mobile app or app-store presence.
- Messenger/Meta integration for reminders (policy risk, per business plan §8).
- Multi-tenant SaaS admin panel beyond what's needed to onboard clinics manually (founder can provision new clinics directly in the DB/simple internal tool for the first several customers).
- Kubernetes, service mesh, multi-region — irrelevant at this scale and would slow shipping.
