# Confirmly

*Working name — subject to change before public launch. No technical dependency on the name.*

SMS-first scheduling and no-show recovery tool for small Philippine clinics (starting with dental).

Small clinics currently run booking and reminders entirely by hand: appointments tracked on paper or an ad-hoc calendar, reminders sent manually via SMS with no built-in confirm/reschedule, and no way to fill a cancelled slot on short notice. No-show rates in Philippine clinics are reported as high as 40–50%. Confirmly automates the parts of this workflow clinics already do manually — without asking the clinic or patient to change the channel they already use (SMS).

Full context lives in:
- [`docs/business-plan.md`](./docs/business-plan.md) — problem, customer, business model, go-to-market, risks
- [`docs/technical-plan.md`](./docs/technical-plan.md) — architecture, stack, data model, build sequencing
- [`docs/local-setup.md`](./docs/local-setup.md) — detailed local dev setup + troubleshooting (this README's Quick Start is the short version)
- [`plans/`](./plans) — the phased implementation plan this build follows

## Status

**Pre-PMF, Phases 1–5 built on main.** Validating the core assumption (no-show/reschedule volume, staff time spent) with a single pilot clinic (founder's dentist) before/alongside building. Live deployment in progress. See [Build phases](#build-phases) below for what's implemented so far.

## What this is

A tool clinics pay a flat monthly subscription for, replacing manual paper/SMS-based appointment scheduling with:

1. **A staff dashboard** for managing a real-time slot calendar.
2. **Automated SMS reminders** (N days before an appointment).
3. **One-tap confirm / reschedule / cancel** via SMS reply keyword or a short tokenized link — no app install.
4. **Waitlist auto-fill** when a slot is cancelled or unconfirmed.

Patients never log in or install anything — an SMS reply or a short-lived tokenized link is the entire patient-facing surface.

## Non-negotiable constraints

These are deliberate, not oversights — see `docs/business-plan.md` §2/§8 and `docs/technical-plan.md` §9 for the full reasoning:

- **No native app, ever (for now).** Patient surface is a lightweight mobile web page reached via SMS link. Must be fast on low-end Android + PH mobile data.
- **No Messenger/Meta dependency for reminders.** Meta's 2026 policy changes break the mechanism this would need. SMS is the channel, deliberately.
- **Single-tenant-per-clinic data model.** No cross-clinic patient directory, no marketplace/clinic-finder functionality.
- **No AI triage/doctor-recommendation features.** Real medical-liability risk; explicitly deferred until there's a clinical review process.
- **Optimize for solo-founder velocity over scale.** Expected load at 1–10 clinics is trivial. Don't build for hypothetical scale.

## Architecture

```
                    ┌─────────────────────────┐
                    │   Next.js App           │
                    │  - /dashboard (staff)   │
                    │  - /c/[token] (patient) │
                    └───────────┬─────────────┘
                                │ REST
                    ┌───────────▼─────────────┐
                    │   Node.js API (Fastify)  │
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

One Node process serves the API, deployed as a separate service from the Next.js dashboard — two Railway/Render services total, one Postgres instance. No queue infra; scheduled jobs run in-process via `node-cron` (see `docs/technical-plan.md` §5 for why not Lambda, and the revisit trigger for when that changes).

### Monorepo layout

```
confirmly/
├── apps/
│   ├── web/     # Next.js (App Router) — staff dashboard + patient /c/[token] page
│   └── api/     # Fastify API server — auth, appointments/patients CRUD, SMS + cron
├── packages/
│   ├── db/            # Prisma schema, migrations, generated client
│   ├── shared-types/  # Shared TS types/DTOs between web and api
│   ├── config/        # Shared eslint/tsconfig/prettier config
│   └── sms/           # SMS provider abstraction
├── docs/       # business plan, technical plan, local setup guide
├── plans/      # phased implementation plan (this repo's build order)
├── docker-compose.yml   # local Postgres
└── turbo.json
```

`web` and `api` are deliberately split: the reminder cron and inbound SMS webhooks are backend concerns that shouldn't couple to Next.js's request lifecycle or deploy cadence.

## Tech stack

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere |
| Frontend | Next.js 16 (App Router) |
| Backend | Node.js + Fastify |
| Database | PostgreSQL via Prisma |
| Staff auth | Session-based (httpOnly cookies, Argon2 password hashing) — no heavyweight auth provider |
| Patient identity | No login — signed, expiring tokenized links only |
| SMS | Provider-agnostic abstraction over Semaphore or Movider (PH-local gateways) |
| Scheduled jobs | `node-cron` in the API process |
| Hosting | Railway or Render — single long-running instance per service, not serverless |
| Monorepo | Turborepo + pnpm workspaces |
| Error tracking | Sentry (free tier) |

## Core data entities

`Clinic`, `StaffUser` (+ `Session` for auth), `Patient` (scoped to a clinic, not global), `Appointment` (status enum, `reminder_sent_at`), `WaitlistEntry`, `SmsLog` (every outbound/inbound SMS, for debugging delivery disputes).

Enforced at the database level (a Postgres `EXCLUDE` constraint via `btree_gist`, not just app-level validation): no two `Appointment`s for the same clinic + resource may overlap in time.

## Build phases

Follows `docs/technical-plan.md` §8 and the per-phase plans in [`plans/`](./plans) — steps aren't built ahead of pilot validation.

| Phase | Covers | Status |
|---|---|---|
| 1 — [Foundation](./plans/phase-1-foundation.md) | Monorepo, DB schema, staff auth, manual appointment CRUD dashboard, deploy | ✅ Built locally; live Railway deploy in progress |
| 2 — [Reminders](./plans/phase-2-reminders.md) | SMS abstraction, reminder cron, `SmsLog` | ✅ Built |
| 3 — [Patient self-service](./plans/phase-3-patient-self-service.md) | Inbound SMS reply handling, tokenized reschedule page | ✅ Built |
| 4 — [Waitlist](./plans/phase-4-waitlist.md) | Waitlist capture + auto-fill on cancellation | ✅ Built |
| 5 — [Polish for pilot](./plans/phase-5-polish-for-pilot.md) | Sentry, clinic settings, manual staff override fallback | ✅ Built |

Phases 1–3 are the minimum viable pilot per the business plan; 4–5 add waitlist and polish. Phase 6 (recurring appointments, session-based capacity) exists on branch `feat/phase-6-recurring` but is not yet on `main` — deferred until pilot validation demonstrates demand.

## Quick start (local dev)

Full walkthrough with troubleshooting: [`docs/local-setup.md`](./docs/local-setup.md). Short version:

**Prerequisites:** [Node.js](https://nodejs.org/) 20+, [pnpm](https://pnpm.io/installation) 10.x (`npm install -g pnpm@10`), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running).

```bash
git clone <repo-url> confirmly && cd confirmly
pnpm install
docker compose up -d                              # starts local Postgres on :5433
pnpm --filter @confirmly/db migrate:deploy         # apply schema
pnpm db:seed                                       # creates a clinic + login you can use
pnpm dev                                           # runs api (:4000) + web (:3000)
```

Then open **http://localhost:3000** and log in with the credentials the seed script prints to the terminal.

### Useful commands

| Command | What it does |
|---|---|
| `pnpm dev` | run api + web together |
| `pnpm build` | build all packages/apps |
| `pnpm typecheck` / `pnpm lint` | typecheck / lint everything |
| `pnpm db:seed` | re-run the dev seed (safe to repeat) |
| `pnpm --filter @confirmly/db studio` | Prisma Studio (visual DB browser) at `localhost:5555` |
| `pnpm --filter @confirmly/db migrate:dev` | create + apply a new migration after editing `schema.prisma` |
| `docker compose up -d` / `down` | start / stop local Postgres |

## When proposing changes

If a request pulls toward a patient app, multi-clinic directory, AI triage, or Messenger integration — flag that this contradicts the current plan's explicit non-goals before implementing. These get revisited only after multiple paying clinics validate demand for them, not by default.

Prefer the simplest thing that unblocks the pilot clinic. This is pre-PMF; the plan explicitly deprioritizes scalability and generality in favor of shipping speed.
