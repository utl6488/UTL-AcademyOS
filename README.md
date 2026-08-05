# UTL-ExamPro

Multi-tenant AI-powered online examination SaaS platform.

## Stack

- **Frontend:** React 19 · TypeScript · Vite · Tailwind CSS · ShadCN UI · TanStack Query · React Router · Zustand · Recharts · Socket.io Client
- **Backend:** Node.js 20+ · Express · TypeScript · Prisma · PostgreSQL 16 (+ pgvector) · Redis 7 · BullMQ · Socket.io
- **AI:** LangGraph · LangChain · OpenAI · Anthropic Claude · pgvector RAG
- **Infra:** Docker · Nginx · GitHub Actions · Prometheus · Grafana · Loki · Sentry

## Monorepo Layout

```
UTL-AcademyOS/
├── backend/            # Express + Prisma API (Phase 1+)
├── frontend/           # React + Vite SPA (Phase 2+)
├── secure-browser/     # Electron kiosk app (Phase 15, post-MVP)
├── packages/
│   └── shared/         # Shared TS types + Zod schemas + enums
├── infra/              # Docker, deploy, ops manifests
├── docs/               # Architecture notes, guides
├── docker-compose.dev.yml
├── Makefile
└── package.json        # npm workspaces root
```

## Prerequisites

- **Node.js 20+** (see `.nvmrc`) — `nvm use`
- **npm 10+**
- **Docker + Docker Compose** — for Postgres, Redis, Mailhog, MinIO

## Quick Start

```bash
# 1. Install workspace deps
npm install

# 2. Boot local infra (Postgres + pgvector, Redis, Mailhog, MinIO)
make dev-up

# 3. Copy env templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 4. Run the frontend dev server
npm run dev
```

## Common Scripts

| Command                         | What it does                     |
| ------------------------------- | -------------------------------- |
| `npm run dev`                   | Start the frontend dev server    |
| `npm run build`                 | Build all workspaces             |
| `npm run lint`                  | Lint every workspace             |
| `npm run typecheck`             | Typecheck every workspace        |
| `npm run test`                  | Run tests across every workspace |
| `npm run format`                | Prettier-write the repo          |
| `make dev-up` / `make dev-down` | Start / stop local Docker stack  |
| `make dev-reset`                | Nuke local Docker volumes        |

## Local Services

Started by `docker-compose.dev.yml`:

| Service                | Port                        | Notes                                 |
| ---------------------- | --------------------------- | ------------------------------------- |
| Postgres 16 + pgvector | 5432                        | `postgres/postgres`, db `utl_exampro` |
| Redis 7                | 6379                        | no auth in dev                        |
| Mailhog                | 1025 (SMTP) / 8025 (web UI) | catches outbound email                |
| MinIO                  | 9000 (API) / 9001 (console) | `minioadmin/minioadmin`               |

## Development Workflow

1. Create a branch off `main`.
2. Commit using [conventional commits](https://www.conventionalcommits.org/) — `commitlint` enforces this.
3. `lint-staged` runs Prettier + ESLint on staged files.
4. Open a PR — CI runs lint, typecheck, and unit tests.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Roadmap

Full multi-phase plan lives in [`task.md`](./task.md). MVP order:

1. Phase 0 — Repo foundation _(current)_
2. Phase 1 — Backend skeleton + auth
3. Phase 2 — Frontend shell + auth screens
4. Phase 3–7 — Institute, question bank, exam engine, results
5. Phase 8 — AI features
6. Phase 9–14 — Billing, super admin, security, DevOps, launch
7. Phase 15 — UTL Secure Browser (post-MVP)
