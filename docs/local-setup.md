# Local setup

Everything you need to get Confirmly running on your machine from a fresh clone. Written for someone touching this repo for the first time.

## What you're setting up

Two apps and a Postgres database, all running locally:

- **`apps/api`** — Fastify backend, runs on `http://localhost:4000`
- **`apps/web`** — Next.js dashboard, runs on `http://localhost:3000`
- **Postgres** — runs in Docker on port `5433` (not the default `5432`, to avoid clashing with any other local Postgres)

## 1. Prerequisites

Install these first if you don't have them:

| Tool | Why | Check you have it |
|---|---|---|
| [Node.js](https://nodejs.org/) 20+ | runs everything | `node --version` |
| [pnpm](https://pnpm.io/installation) 10.x | package manager (this repo uses pnpm workspaces) | `pnpm --version` |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | runs local Postgres | `docker --version` |

If `pnpm` isn't installed:

```bash
npm install -g pnpm@10
```

Docker Desktop needs to actually be **running** (not just installed) before step 3 below.

## 2. Clone and install

```bash
git clone <repo-url> confirmly
cd confirmly
pnpm install
```

This installs dependencies for every package in the monorepo (`apps/api`, `apps/web`, `packages/db`, `packages/shared-types`, `packages/config`) in one go.

## 3. Start Postgres

```bash
docker compose up -d
```

This starts a Postgres 16 container named `confirmly-postgres` on port `5433`, with a persistent Docker volume so your data survives restarts. Defined in `docker-compose.yml` at the repo root.

Check it's healthy:

```bash
docker compose ps
```

You should see `confirmly-postgres` with status `Up`.

To stop it later: `docker compose down` (add `-v` if you also want to wipe all data).

## 4. Environment variables

Each package that needs config already has a working `.env` committed for local dev — **you don't need to create these yourself** for local development. They exist at:

- `packages/db/.env` — `DATABASE_URL` pointing at the Docker Postgres from step 3
- `apps/api/.env` — `DATABASE_URL`, `SESSION_SECRET`, `PORT`, `NODE_ENV`
- `apps/web/.env.local` — `NEXT_PUBLIC_API_URL` pointing at the local API

If any of these are missing (e.g. they were gitignored and this is a genuinely fresh clone), copy them from the matching `.env.example` in the same directory and fill in:

```bash
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Local dev values that work out of the box with the Docker Postgres from step 3:

```
# packages/db/.env
DATABASE_URL="postgresql://confirmly:confirmly@localhost:5433/confirmly"

# apps/api/.env
DATABASE_URL="postgresql://confirmly:confirmly@localhost:5433/confirmly"
SESSION_SECRET="dev-only-secret-do-not-use-in-production"
PORT=4000
NODE_ENV=development

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 5. Run database migrations

Applies the Prisma schema (all tables, enums, and the appointment no-overlap constraint) to your local Postgres:

```bash
pnpm --filter @confirmly/db migrate:deploy
```

## 6. Seed dev data

Creates one clinic, one staff login, and one patient so you have something to log in with:

```bash
pnpm db:seed
```

This prints the login credentials to the terminal — keep them, you'll need them in step 8:

```
Log in at http://localhost:3000/login with:
  Clinic ID: clinic1
  Email:     dev@confirmly.test
  Password:  devpassword123
```

The seed is safe to re-run — it upserts, so re-running won't create duplicates or error.

## 7. Start both apps

From the repo root, one command starts both the API and the web dashboard together (via Turborepo):

```bash
pnpm dev
```

Or, if you want them in separate terminals (useful for reading logs independently):

```bash
# terminal 1
pnpm --filter @confirmly/api dev

# terminal 2
pnpm --filter @confirmly/web dev
```

## 8. Confirm it works

- API health check:
  ```bash
  curl http://localhost:4000/health
  ```
  Should return `{"status":"ok","env":"development"}`.

- Open **http://localhost:3000** in a browser — it redirects to `/login`.

- Log in with the credentials from step 6 (Clinic ID `clinic1`, email `dev@confirmly.test`, password `devpassword123`). You'll land on `/dashboard`.

- Go to **Appointments** in the nav and try booking a slot — it should persist and show up in the calendar.

## Useful commands

| Command | What it does |
|---|---|
| `pnpm install` | install/update all workspace dependencies |
| `pnpm dev` | run api + web together |
| `pnpm build` | build all packages/apps |
| `pnpm typecheck` | typecheck everything |
| `pnpm lint` | lint everything |
| `pnpm db:seed` | re-run the dev seed (safe to repeat) |
| `pnpm --filter @confirmly/db studio` | opens Prisma Studio (visual DB browser) at `http://localhost:5555` |
| `pnpm --filter @confirmly/db migrate:dev` | create + apply a new migration after editing `schema.prisma` (local dev only) |
| `docker compose up -d` | start local Postgres |
| `docker compose down` | stop local Postgres (data persists) |
| `docker compose down -v` | stop local Postgres and delete all data |

## Troubleshooting

**`pnpm install` fails on `@prisma/client` / `prisma` / `esbuild` postinstall scripts**
pnpm blocks build scripts by default for security. This repo already allowlists the ones it needs in `pnpm-workspace.yaml` (`onlyBuiltDependencies`), so a plain `pnpm install` should just work. If you still hit this, run `pnpm approve-builds` and allow `@prisma/client`, `@prisma/engines`, `prisma`, and `esbuild`.

**`GET /health` fails / API won't start — "Invalid environment variables"**
`apps/api/.env` is missing or incomplete. Check it has `DATABASE_URL`, `SESSION_SECRET`, `PORT`, and `NODE_ENV` set (see step 4).

**API can't connect to Postgres**
Confirm the container is running: `docker compose ps`. If it's not there at all, run `docker compose up -d` again. If Docker Desktop itself isn't running, start it first.

**Port already in use (3000, 4000, or 5433)**
Something else on your machine is using that port. Either stop it, or change the port in the relevant `.env` file (`PORT` for the API, and update `DATABASE_URL`'s port + `docker-compose.yml`'s port mapping together for Postgres).

**Login fails with the seeded credentials**
Re-run the seed: `pnpm db:seed`. If that doesn't help, confirm migrations were applied (step 5) and that `apps/api` and `packages/db` are pointing at the same `DATABASE_URL`.
