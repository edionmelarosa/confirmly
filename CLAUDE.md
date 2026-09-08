# Confirmly

*Working name — subject to change before public launch. No technical dependency on the name.*

SMS-first scheduling and no-show recovery tool for small Philippine clinics (starting with dental). Full context lives in:
- [docs/business-plan.md](./docs/business-plan.md) — problem, customer, business model, GTM, risks
- [docs/technical-plan.md](./docs/technical-plan.md) — architecture, stack, data model, build sequencing

Read both before proposing significant changes in direction or scope. This file is a quick-reference distillation, not a replacement.

## What this is

A tool clinics pay a flat monthly subscription for, replacing manual paper/SMS-based appointment scheduling with:
1. A staff dashboard for managing a real-time slot calendar.
2. Automated SMS reminders (N days before appointment).
3. One-tap confirm/reschedule/cancel via SMS reply keyword or a short tokenized link (no app install).
4. Waitlist auto-fill when a slot is cancelled/unconfirmed.

Patients never need to log in or install anything — SMS reply or a short-lived tokenized link is the entire patient-facing surface.

## Status

Pre-build. Currently validating the core assumption (no-show/reschedule volume, staff time spent) with a single pilot clinic (founder's dentist) before writing product code. No repo code exists yet — this file exists to keep future implementation aligned with the plan.

## Non-negotiable constraints

- **No native app, ever (for now).** Patient surface is a lightweight mobile web page reached via SMS link. Must be fast on low-end Android + PH mobile data.
- **No Messenger/Meta dependency for reminders.** Meta's 2026 policy changes break the mechanism this would need. SMS is the channel, deliberately.
- **Single-tenant-per-clinic data model.** No cross-clinic patient directory, no marketplace/clinic-finder functionality.
- **No AI triage/doctor-recommendation features.** Real medical-liability risk; explicitly deferred until there's a clinical review process.
- **Optimize for solo-founder velocity over scale.** Expected load at 1–10 clinics is trivial. Don't build for hypothetical scale.

## Tech stack (planned)

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere |
| Frontend | Next.js (App Router) — staff dashboard + patient `/c/[token]` page |
| Backend | Node.js + Fastify (or Express), standalone from Next.js |
| Database | PostgreSQL via Prisma |
| SMS | Provider-agnostic abstraction (`packages/sms`) over Semaphore or Movider (PH-local gateways) |
| Auth (staff) | Session-based (Lucia) or JWT + httpOnly cookie — no heavyweight auth provider |
| Patient identity | No login — signed, expiring tokenized links only |
| Scheduled jobs | `node-cron` in the API process — no queue infra yet |
| Hosting | Railway or Render — single long-running instance, not serverless/Lambda |
| Monorepo | Turborepo + pnpm workspaces |
| Error tracking | Sentry (free tier) |

**Compute model:** single instance, not Lambda — see technical-plan.md §5 for full reasoning and the "hybrid path" revisit trigger (extract only the SMS dispatch to Lambda/EventBridge once volume justifies it, not before).

## Monorepo layout (planned)

```
confirmly/
├── apps/
│   ├── web/     # Next.js — dashboard + patient page
│   └── api/     # Node API server
├── packages/
│   ├── db/            # Prisma schema, migrations
│   ├── sms/           # SMS provider abstraction — keep provider-agnostic
│   ├── shared-types/  # Shared TS types between web and api
│   └── config/        # Shared eslint/tsconfig/prettier
```

Keep `web` and `api` split — the reminder cron and inbound SMS webhooks are backend concerns that shouldn't couple to Next.js's request lifecycle.

## Core data entities

`Clinic`, `StaffUser`, `Patient` (scoped to a clinic, not global), `Appointment` (with status enum, `reminder_sent_at`), `WaitlistEntry`, `SmsLog` (every outbound/inbound SMS, for debugging delivery disputes).

Enforce at the DB level: no two `Appointment`s for the same clinic/resource/slot may overlap.

## Build order

Follow technical-plan.md §8 — don't build ahead of pilot validation:
1. Monorepo scaffold, Postgres schema, staff auth, manual appointment CRUD dashboard.
2. SMS abstraction + reminder cron + `SmsLog`.
3. Inbound reply handling (confirm/cancel) + tokenized reschedule page.
4. Waitlist auto-fill.
5. Sentry, clinic settings, manual staff override fallback.

Steps 1–3 are the minimum viable pilot. Don't start 4–5 before the core loop is validated with the pilot clinic.

## When proposing changes

- If a request pulls toward a patient app, multi-clinic directory, AI triage, or Messenger integration — flag that this contradicts the current plan's explicit non-goals before implementing. These get revisited only after multiple paying clinics validate demand for them, not by default.
- Prefer the simplest thing that unblocks the pilot clinic. This is pre-PMF; the plan explicitly deprioritizes scalability and generality in favor of shipping speed.
