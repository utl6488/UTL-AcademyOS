# UTL-AcademyOS

Multi-tenant, AI-powered online examination SaaS platform.

UTL-AcademyOS lets institutes run secure online exams end-to-end: onboard students, build a versioned question bank, author flexible or synchronous exams, invigilate a live console, auto-grade objective questions, queue subjective grading, publish results with analytics, and layer AI on top for weak-topic detection, study plans, question generation, and homework recommendations. Institutes are isolated by tenant; billing, plans, and usage are metered per tenant.

## Documentation

| Doc                                            | What's in it                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [docs/setup.md](./docs/setup.md)               | Local dev quickstart: Docker services, env, migrations, seed, running backend + frontend |
| [docs/architecture.md](./docs/architecture.md) | System diagram, tech stack, multi-tenancy model, request flow, queues, AI pipeline, RBAC |
| [docs/api.md](./docs/api.md)                   | REST endpoint reference (all 136 endpoints, grouped by module, with roles)               |
| [docs/features.md](./docs/features.md)         | Feature walkthrough by role: student, teacher, institute admin, super admin              |
| [CONTRIBUTING.md](./CONTRIBUTING.md)           | Branch, commit, and PR conventions                                                       |
| [task.md](./task.md)                           | Full phased delivery plan (Phase 0–15)                                                   |

## Stack

- **Frontend** — React 19, TypeScript, Vite, Tailwind CSS, ShadCN UI, TanStack Query, React Router v6, Zustand, Recharts, Socket.io client
- **Backend** — Node.js 20+, Express, TypeScript, Prisma, PostgreSQL 16 + pgvector, Redis 7, BullMQ, Socket.io, Helmet, argon2, JWT (access + rotating refresh)
- **AI** — LangGraph/LangChain wrappers over OpenAI + Anthropic Claude, pgvector RAG, per-tenant cost tracking
- **Infra (dev)** — Docker Compose (Postgres, Redis, Mailhog, MinIO), Nginx (planned), GitHub Actions CI, Sentry

## Monorepo Layout

```
UTL-AcademyOS/
├── backend/            Express + Prisma API, BullMQ workers, Socket.io
├── frontend/           React + Vite SPA
├── packages/
│   └── shared/         Shared TS types, Zod schemas, enums
├── infra/              Postgres init scripts, ops manifests
├── docs/               Architecture, setup, API, feature docs
├── secure-browser/     Electron kiosk app (Phase 15, post-MVP stub)
├── docker-compose.dev.yml
├── Makefile
└── package.json        npm workspaces root
```

## Prerequisites

- **Node.js 20.11+** (see `.nvmrc`) — `nvm use`
- **npm 10+**
- **Docker + Docker Compose** — for Postgres (with pgvector), Redis, Mailhog, MinIO

## Quick Start

One command — boots Docker services, waits for Postgres, copies `.env` templates on first run, applies migrations, seeds the DB, then runs backend + frontend concurrently with prefixed logs:

```bash
make start
# or: npm start
# or: ./scripts/dev.sh
```

Ctrl+C shuts backend + frontend down cleanly; Docker keeps running for a fast next boot. Pass `--stop-docker` to also stop the containers, or `--skip-docker`, `--skip-migrate`, `--skip-seed` to skip individual phases. `./scripts/dev.sh --help` lists all flags.

Prefer to run pieces by hand? See the step-by-step version in [docs/setup.md](./docs/setup.md).

Once it's up, open http://localhost:3000 and log in with any seeded account (password `changeme123`):

| Email                | Role            |
| -------------------- | --------------- |
| `super@utl.local`    | Super Admin     |
| `owner@demo.local`   | Institute Owner |
| `teacher@demo.local` | Teacher         |
| `student@demo.local` | Student         |

Full walkthrough (troubleshooting, MinIO buckets, Mailhog, Prisma Studio) lives in [docs/setup.md](./docs/setup.md).

## Common Scripts

| Command                                      | What it does                                           |
| -------------------------------------------- | ------------------------------------------------------ |
| `make start` / `npm start`                   | One-shot: docker + migrate + seed + backend + frontend |
| `npm run dev`                                | Start the frontend dev server (Vite on :3000)          |
| `npm run dev:backend`                        | Start the backend API (Express on :4000, tsx watch)    |
| `npm run build`                              | Build every workspace                                  |
| `npm run lint`                               | ESLint across every workspace                          |
| `npm run typecheck`                          | `tsc --noEmit` across every workspace                  |
| `npm run test`                               | Vitest across every workspace                          |
| `npm run format`                             | Prettier-write the repo                                |
| `make dev-up` / `dev-down` / `dev-reset`     | Start / stop / nuke the Docker stack                   |
| `make db-migrate` / `db-seed` / `db-reset`   | Prisma migrate / seed / reset                          |
| `npm run --workspace @utl/backend db:studio` | Open Prisma Studio                                     |

## Local Services

Started by `docker-compose.dev.yml`:

| Service                | Port                    | Notes                                                                 |
| ---------------------- | ----------------------- | --------------------------------------------------------------------- |
| Postgres 16 + pgvector | 5432                    | `postgres/postgres`, db `utl_academyos`                               |
| Redis 7                | 6379                    | no auth in dev; used for cache, rate-limit, BullMQ, Socket.io adapter |
| Mailhog                | 1025 SMTP / 8025 web UI | Catches all outbound email                                            |
| MinIO                  | 9000 API / 9001 console | `minioadmin/minioadmin`; buckets auto-created                         |

## API Surface

- **Base path** — `/api/v1`
- **Docs** — Swagger UI at `http://localhost:4000/api/docs`, OpenAPI JSON at `/api/openapi.json`
- **Auth** — Bearer JWT (access token in header, refresh token rotated with reuse detection)
- **Realtime** — Socket.io on `/`, JWT-authenticated, rooms per tenant / user / attempt / exam console

See [docs/api.md](./docs/api.md) for the full endpoint reference.

## Testing

```bash
npm run test              # all workspaces (vitest)
npm run test --workspace @utl/backend
npm run test --workspace utl-academyos-frontend
```

## Development Workflow

1. Branch off `main`.
2. Commit using [conventional commits](https://www.conventionalcommits.org/) — `commitlint` enforces it.
3. `lint-staged` runs Prettier + ESLint on staged files (Husky pre-commit hook).
4. Open a PR — GitHub Actions runs lint, typecheck, and unit tests.

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## Roadmap Status

Implemented (Phases 0–11): monorepo, backend + auth + RBAC, frontend shell, institute/org management, question bank, exam authoring, exam runtime with proctoring, grading, results + analytics, AI (student + teacher + institute), billing + plans + invoices, super-admin console, security hardening.

Stubbed / not yet built (Phases 12–15): production DevOps (Nginx, Prometheus/Grafana/Loki, backups), deeper integration & load tests, launch/legal, UTL Secure Browser (Electron kiosk).

Full phased plan in [task.md](./task.md).
