# Local Development Setup

This guide walks you from a fresh clone to a fully running UTL-AcademyOS stack on your machine.

## TL;DR

```bash
make start           # or: npm start / ./scripts/dev.sh
```

That single command boots Docker (Postgres, Redis, Mailhog, MinIO), copies `.env` templates on first run, applies migrations, seeds the DB, and runs backend + frontend concurrently with prefixed logs. Ctrl+C shuts down cleanly; Docker keeps running for a fast next boot.

Flags: `--skip-docker`, `--skip-migrate`, `--skip-seed`, `--stop-docker` (see `./scripts/dev.sh --help`).

The rest of this doc explains each step by hand — read on if you want to know what `make start` actually does, or you need to run pieces individually.

## 1. Prerequisites

Install these once:

| Tool    | Version    | Notes                                                       |
| ------- | ---------- | ----------------------------------------------------------- |
| Node.js | 20.11+     | Match `.nvmrc`. `nvm use` picks it up.                      |
| npm     | 10+        | Ships with Node 20                                          |
| Docker  | 24+        | With `docker compose` v2 (the plugin, not `docker-compose`) |
| Git     | any recent | For hooks (Husky)                                           |

Optional but useful:

- **Prisma CLI** — installed as a workspace dep; run via `npm run --workspace @utl/backend db:*`
- **`make`** — the Makefile wraps common commands; you can run raw npm equivalents if you prefer

## 2. Clone and install

```bash
git clone <repo-url> UTL-AcademyOS
cd UTL-AcademyOS
nvm use              # optional, matches .nvmrc
npm install          # installs deps for backend, frontend, packages/shared
```

The postinstall Husky hook wires up Git hooks (pre-commit → lint-staged, commit-msg → commitlint).

## 3. Boot the Docker stack

```bash
make dev-up
# or: npm run docker:up
```

This starts four containers via `docker-compose.dev.yml`:

| Service                | Container      | Ports                         | Credentials                                 |
| ---------------------- | -------------- | ----------------------------- | ------------------------------------------- |
| Postgres 16 + pgvector | `utl-postgres` | 5432                          | `postgres` / `postgres`, db `utl_academyos` |
| Redis 7                | `utl-redis`    | 6379                          | none                                        |
| Mailhog                | `utl-mailhog`  | 1025 (SMTP), 8025 (web)       | none                                        |
| MinIO                  | `utl-minio`    | 9000 (S3 API), 9001 (console) | `minioadmin` / `minioadmin`                 |

A one-shot `minio-init` container creates the `utl-uploads` and `utl-question-images` buckets and marks `utl-uploads` publicly readable.

Postgres init scripts in `infra/postgres/init/` enable the required extensions on first boot (`pgvector`, `pgcrypto`, `citext`).

Check everything came up:

```bash
docker compose -f docker-compose.dev.yml ps
```

You should see all four services `healthy`.

## 4. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

The defaults point at the Docker stack above, so **no edits are required** for a local run. The most important knobs:

**backend/.env**

| Var                                   | Default                                                                     | Why you'd change it                                  |
| ------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------- |
| `PORT`                                | `4000`                                                                      | Change if 4000 is taken                              |
| `DATABASE_URL`                        | `postgresql://postgres:postgres@localhost:5432/utl_academyos?schema=public` | Point at a remote DB                                 |
| `REDIS_URL`                           | `redis://localhost:6379`                                                    | Point at a remote Redis                              |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`    | placeholder                                                                 | **Must be replaced before any non-local deployment** |
| `S3_ENDPOINT`                         | `http://localhost:9000`                                                     | Swap MinIO for real S3                               |
| `SMTP_HOST` / `SMTP_PORT`             | `localhost:1025` (Mailhog)                                                  | Real SMTP for staging                                |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | empty                                                                       | Required to exercise AI endpoints                    |
| `SENTRY_DSN`                          | empty                                                                       | Enables Sentry error capture                         |

**frontend/.env**

| Var                                              | Default                     | Why you'd change it              |
| ------------------------------------------------ | --------------------------- | -------------------------------- |
| `VITE_API_BASE_URL`                              | `http://localhost:4000/api` | Change if backend is not on 4000 |
| `VITE_SOCKET_URL`                                | `http://localhost:4000`     | Socket.io host                   |
| `VITE_STRIPE_PUBLIC_KEY`, `VITE_RAZORPAY_KEY_ID` | empty                       | Enables billing checkout UI      |

## 5. Migrate and seed the database

```bash
make db-migrate      # runs prisma migrate dev (applies + generates client)
make db-seed         # inserts demo tenant + 4 demo users
```

The seed creates one tenant (`demo-institute`) and four users, all with password **`changeme123`**:

| Email                | Role              |
| -------------------- | ----------------- |
| `super@utl.local`    | `SUPER_ADMIN`     |
| `owner@demo.local`   | `INSTITUTE_OWNER` |
| `teacher@demo.local` | `TEACHER`         |
| `student@demo.local` | `STUDENT`         |

To inspect data:

```bash
npm run --workspace @utl/backend db:studio
```

Prisma Studio opens at http://localhost:5555.

## 6. Run backend and frontend

Two terminals:

```bash
# Terminal 1 — backend (Express + BullMQ workers + Socket.io on :4000)
npm run dev:backend
```

```bash
# Terminal 2 — frontend (Vite on :3000, proxies API to :4000)
npm run dev
```

Then open **http://localhost:3000** and log in with one of the seeded users.

Useful URLs while developing:

| URL                                    | What                                                 |
| -------------------------------------- | ---------------------------------------------------- |
| http://localhost:3000                  | SPA                                                  |
| http://localhost:4000/api/docs         | Swagger UI                                           |
| http://localhost:4000/api/openapi.json | OpenAPI spec                                         |
| http://localhost:4000/api/v1/health    | Liveness + readiness                                 |
| http://localhost:8025                  | Mailhog inbox (verification emails, invites, resets) |
| http://localhost:9001                  | MinIO console                                        |
| http://localhost:5555                  | Prisma Studio (when running)                         |

## 7. Quality gates

Run these before opening a PR — CI runs the same:

```bash
npm run lint         # ESLint across every workspace
npm run typecheck    # tsc --noEmit across every workspace
npm run test         # vitest across every workspace
npm run format:check # prettier --check
```

Auto-fix formatting: `npm run format`.

## 8. Common tasks

### Reset the database

```bash
make db-reset        # drops, re-applies migrations
make db-seed         # re-seed
```

### Nuke everything (volumes included)

```bash
make dev-reset       # docker compose down -v — destroys Postgres, Redis, MinIO data
```

### Create a new migration

Edit `backend/prisma/schema.prisma`, then:

```bash
npm run --workspace @utl/backend db:migrate -- --name my_change
```

### Regenerate the Prisma client only

```bash
npm run --workspace @utl/backend db:generate
```

### View background job status

BullMQ ships a bundled UI at `http://localhost:4000/admin/queues` (Bull-Board is mounted in the backend). Queues: `email`, `embedding`, `evaluate`, `exam`, `import`.

### Tail Docker logs

```bash
make dev-logs
```

## 9. Troubleshooting

**Postgres won't start / port 5432 taken**
Another Postgres instance is running locally. Stop it (`sudo service postgresql stop` on Debian) or change the host-side port in `docker-compose.dev.yml`.

**`prisma migrate dev` says "Database schema is not empty"**
`make db-reset` (destroys data) or connect and drop the schema manually.

**Backend can't reach Redis / DB after `make dev-up`**
Wait for the health checks: `docker compose -f docker-compose.dev.yml ps` should show all services `healthy` (up to ~30s on first boot).

**Vite says "port 3000 already in use"**
Set `--port` in the dev script or kill the other process. Also update `VITE_API_BASE_URL` if you change the backend port so proxying matches.

**Emails aren't arriving**
They land in Mailhog at http://localhost:8025 — real SMTP is only used if you point `SMTP_HOST` elsewhere.

**S3 uploads fail with "InvalidAccessKeyId"**
The `minio-init` container may not have finished. Re-run `make dev-up` or create buckets manually via the MinIO console at http://localhost:9001.

**AI endpoints return "provider not configured"**
Set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in `backend/.env`.

**"JWT_SECRET must be at least 32 chars"**
Replace the placeholder in `backend/.env` with a real 32+ character random string (`openssl rand -hex 32`).

**Husky hook is annoying / needs bypass**
Fix the underlying lint/type error. Don't `--no-verify` unless you know exactly why.

## 10. What next?

- Read [docs/architecture.md](./architecture.md) for how the pieces fit together.
- Read [docs/features.md](./features.md) to see what the UI covers.
- Read [docs/api.md](./api.md) to look up endpoints.
