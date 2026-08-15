# Architecture

This document explains how UTL-AcademyOS is put together — the moving parts, how they talk, how tenants are isolated, and where each concern lives.

## 1. High-level view

```
                     ┌──────────────────────────────┐
                     │           Browser            │
                     │  React + Vite SPA (:3000)    │
                     └──────────────┬───────────────┘
                                    │ HTTPS
                                    │ REST /api/v1/*
                                    │ WebSocket (Socket.io)
                                    ▼
                     ┌──────────────────────────────┐
                     │        Express API           │
                     │       Node 20 (:4000)        │
                     │  ┌────────────────────────┐  │
                     │  │  Middleware chain      │  │
                     │  │  helmet · cors · gzip  │  │
                     │  │  requestId · logger    │  │
                     │  │  auth · tenant · rbac  │  │
                     │  │  validate (zod)        │  │
                     │  └──────────┬─────────────┘  │
                     │             ▼                │
                     │  ┌────────────────────────┐  │
                     │  │  Modules (16)          │  │
                     │  │  routes/controller/    │  │
                     │  │  service/schemas       │  │
                     │  └──────────┬─────────────┘  │
                     │             │                │
                     └─────────────┼────────────────┘
                                   │
        ┌──────────────┬───────────┼────────────┬──────────────┐
        ▼              ▼           ▼            ▼              ▼
   ┌─────────┐    ┌────────┐   ┌───────┐   ┌────────┐    ┌────────┐
   │Postgres │    │ Redis  │   │  S3   │   │ SMTP   │    │  AI    │
   │ 16 +    │    │  7     │   │(MinIO)│   │(Mailhog│    │Provider│
   │pgvector │    │ cache  │   │       │   │  dev)  │    │(OpenAI│
   │         │    │queues  │   │       │   │        │    │Anthropic)│
   │         │    │pubsub  │   │       │   │        │    │        │
   └─────────┘    └────────┘   └───────┘   └────────┘    └────────┘
                      ▲
                      │ BullMQ
                      │
              ┌───────┴──────────┐
              │ Worker processes │
              │ email · exam ·   │
              │ evaluate · import│
              │ · embedding ·    │
              │ autosubmit ·     │
              │ dunning · digest │
              └──────────────────┘
```

The API process also spawns the BullMQ workers in-process (same Node runtime); in production you'd split them onto separate replicas.

## 2. Tech stack (why each piece)

| Layer          | Choice                                                                           | Why                                                  |
| -------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| SPA            | **React 19 + Vite + TypeScript**                                                 | Fast dev loop, wide component ecosystem              |
| Styling        | **Tailwind + ShadCN UI**                                                         | Constrained, accessible primitives                   |
| Client state   | **Zustand** (UI, auth) + **TanStack Query** (server)                             | Clear split: UI in zustand, server cache in RQ       |
| Routing        | **React Router v6** with a `ProtectedRoute` wrapper                              | Role guards at the route level                       |
| Realtime       | **Socket.io client**                                                             | Attempt heartbeat + live console                     |
| API            | **Express + TypeScript**                                                         | Boring, well-known, easy to hire for                 |
| Validation     | **Zod** everywhere (requests, env, jobs)                                         | Same schema used by API + OpenAPI gen                |
| DB             | **Postgres 16 + pgvector**                                                       | Relational data + AI embeddings in one place         |
| ORM            | **Prisma**                                                                       | Type-safe queries, easy migrations                   |
| Cache / queue  | **Redis 7 + BullMQ**                                                             | Background work + rate limit + Socket.io adapter     |
| Realtime       | **Socket.io + Redis adapter**                                                    | Horizontal scale (many API replicas)                 |
| Object storage | **S3-compatible** (MinIO in dev, S3 in prod)                                     | Question images, user photos, imports, invoices      |
| Auth           | **JWT** (short-lived access + rotating refresh) with **argon2** password hashing | Reuse detection kills a whole token family on replay |
| Docs           | **Swagger UI + zod-to-openapi**                                                  | Spec generated from Zod schemas, no drift            |
| Observability  | **pino** structured logs + **Sentry** for errors                                 | JSON logs are grep/pipe friendly                     |
| Security       | **helmet**, CSP headers, per-route rate limits (redis-backed), audit log         | Defence in depth                                     |

## 3. Monorepo layout

```
backend/               Express API + BullMQ workers + Socket.io
  src/
    app.ts             Express app factory (middleware, routes, docs)
    server.ts          HTTP + Socket.io bootstrap
    index.ts           Process entry
    config/            env, constants, logger
    common/            middleware, errors, utils, types
    db/                Prisma client + tenant scoping
    modules/           auth · user · institute · org · question · exam ·
                       attempt · grading · result · analytics · ai ·
                       billing · admin · audit · health · notifications
                       (each: routes.ts, controller.ts, service.ts, schemas.ts)
    jobs/              queues + workers (email, exam, evaluate, import, embedding)
    sockets/           Socket.io setup, room helpers
    docs/              OpenAPI registry
  prisma/              schema.prisma + migrations + seed.ts

frontend/              React + Vite SPA
  src/
    app/               App shell + router
    routes/            Route table + ProtectedRoute
    layouts/           AuthLayout · DashboardLayout · ExamLayout
    features/          One folder per feature area (auth, dashboard,
                       exam-authoring, exam-attempt, grading, results,
                       question-bank, institute, org, users, ai, billing,
                       admin, notifications, settings)
    components/        Cross-feature UI + ShadCN primitives
    store/             Zustand stores (auth, theme, …)
    lib/               API client, socket client, format helpers
    hooks/             Reusable hooks (debounce, …)
    locales/           en.json · hi.json
    styles/            Tailwind entry
    tests/             Vitest + RTL

packages/shared/       TS types, Zod schemas, enums shared by API + SPA

infra/                 Postgres init SQL (extensions)
docs/                  This folder
docker-compose.dev.yml Local Postgres, Redis, Mailhog, MinIO
```

## 4. Multi-tenancy

**Model** — shared database, shared schema, tenant-scoped by column.

Every tenant-owned table has a `tenantId` column and a compound index leading with `tenantId`. Isolation is enforced in **three** independent layers:

1. **Auth** — the access token carries `{ userId, tenantId, role, permissions }`. Middleware puts them on `req.auth`.
2. **Tenant middleware** — stamps `req.tenantId` from the token and rejects cross-tenant IDs in URL params.
3. **Prisma extension** — every `where` clause is augmented with `tenantId = req.tenantId` before the query is issued. Writes are validated the same way. A developer _cannot_ forget to filter by tenant; it's not an option they hold.

The `Tenant` model itself is only mutable by `SUPER_ADMIN` (via the `/admin/*` module), which runs in a bypass context.

## 5. Auth and RBAC

### Tokens

- **Access token** — JWT, ~15 min TTL, signed with `JWT_SECRET`. Sent as `Authorization: Bearer …`.
- **Refresh token** — JWT, ~7 day TTL, signed with `JWT_REFRESH_SECRET`. Stored server-side in `RefreshToken` with a `familyId`. Rotation is mandatory: every refresh returns a new pair and invalidates the previous one. If a token is presented twice, the whole family is revoked (reuse detection).
- Sessions surface in `GET /api/v1/auth/sessions`; a user can revoke a family via `DELETE …/sessions/:familyId` or nuke all via `POST …/logout-all`.

### Roles

Six roles: `SUPER_ADMIN`, `INSTITUTE_OWNER`, `INSTITUTE_ADMIN`, `TEACHER`, `EVALUATOR`, `STUDENT`.

Roles map to fine-grained **permissions** (e.g. `USER_MANAGE`, `EXAM_TAKE`, `RESULT_PUBLISH`, `BILLING_MANAGE`, `AI_USE_TEACHER`, `SUPER_ADMIN`). Route middleware checks the permission set attached to the token; roles are just permission bundles.

The `UserPermission` table lets an admin grant additional permissions on top of the role bundle when needed.

### Password + email flows

- **Signup** — creates the tenant _and_ its `INSTITUTE_OWNER` in one transaction; a verification email goes out via the email queue.
- **Forgot / reset** — one-time token in `OtpToken`, single-use, TTL enforced.
- **Verify email** — same table, different purpose.

## 6. Request lifecycle

For a typical authenticated request:

1. **helmet** sets CSP + security headers.
2. **cors** — allowlist from `CORS_ORIGINS`.
3. **compression** + **cookie-parser** + JSON body parser.
4. **requestId** middleware — mints an ID and puts it in the response header + log context.
5. **pino-http** — one log line per request with duration, status, tenantId, userId.
6. **rate-limit** — redis-backed, per route category (auth, ai, generic).
7. **auth** — decode JWT, load user, populate `req.auth`.
8. **tenant** — populate `req.tenantId`, guard against cross-tenant IDs.
9. **RBAC** — check the route's required permission set.
10. **Zod validate** — parse body/params/query; 400 on failure.
11. **Controller → service → prisma (tenant-scoped)** — return a plain object.
12. **Error middleware** — normalises `AppError` and Prisma errors to `{ error: { code, message, requestId } }`.

## 7. Data model (34 tables)

Grouped by concern:

- **Tenancy & auth** — `Tenant`, `User`, `UserPermission`, `RefreshToken`, `OtpToken`, `AuditLog`
- **Org structure** — `Branch`, `AcademicYear`, `Class`, `Section`, `Batch`, `BatchMember`, `Subject`, `Topic`
- **Bulk imports** — `ImportJob` (users, questions)
- **Question bank** — `Question`, `QuestionVersion` (immutable snapshots per publish)
- **Exams** — `Exam`, `ExamSection`, `ExamQuestion`, `ExamAssignment` (to class/batch/section/user)
- **Attempts** — `ExamAttempt`, `AttemptAnswer`, `AttemptEvent` (proctoring log)
- **Results** — `Result`
- **AI** — `AiUsage` (cost), `AiFeedback`, `StudentStudyPlan`, `Embedding` (pgvector)
- **Billing** — `Plan`, `Subscription`, `Invoice`, `Coupon`
- **Platform** — `FeatureFlag`

Common patterns:

- `tenantId` on everything tenant-owned; compound indexes lead with it.
- Soft-delete via `deletedAt` where user-visible history matters; hard-delete for internal churn.
- `createdAt` / `updatedAt` on almost every row; `createdById` / `updatedById` where audit matters.

## 8. Background jobs

Five BullMQ queues, backed by Redis, with retries + exponential backoff. Workers live in `backend/src/jobs/workers/`:

| Queue       | Producers                                                      | Workers                            | Purpose                                                                  |
| ----------- | -------------------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `email`     | auth (verify/reset/invite), billing (invoice, dunning), digest | `email.worker`                     | Deliver transactional email via nodemailer                               |
| `import`    | user CSV, question CSV upload                                  | `import.worker`                    | Stream-parse CSV, validate, insert in chunks, publish progress           |
| `exam`      | exam publish → schedule auto-submit; `autosubmit.worker`       | `exam.worker`, `autosubmit.worker` | Notify attendees, force-submit at deadline                               |
| `evaluate`  | attempt submit                                                 | `evaluate.worker`                  | Auto-grade objective answers, enqueue subjective grading, compute result |
| `embedding` | question upsert                                                | `embedding.worker`                 | Generate vector embeddings for RAG                                       |

Also present as workers (not always as dedicated queues): `dunning` (subscription retry ladder → grace → downgrade), `digest` (weekly institute email).

Bull-Board UI is mounted at `/admin/queues` in dev.

## 9. Realtime (Socket.io)

- Client connects to `/`, presenting a Bearer JWT in `handshake.auth.token`.
- On auth success the socket auto-joins `t:{tenantId}` and `u:{userId}`.
- **Attempt runtime** — client joins `attempt:{attemptId}` and emits `attempt:heartbeat` every ~15s; the server rebroadcasts to the room.
- **Live console** — teachers join `exam:{examId}:console` to receive presence + proctoring events for all attempts on that exam.
- Redis adapter (`@socket.io/redis-adapter`) fans out events across API replicas.

## 10. Exam engine

### Two modes

- **FLEXIBLE_WINDOW** — student may start any time between `startAt` and `endAt`; their own timer runs for `durationMin` after start.
- **SYNCHRONOUS** — all attendees start at the same moment; a **lobby** page counts down; late entry allowed inside a configurable grace window.

### Runtime protections

- **Auto-save every 15–30s** with an IndexedDB offline queue — connectivity loss doesn't lose answers.
- **Attempt heartbeat** — the server marks an attempt "disconnected" if heartbeats stop; on reconnect the client resyncs.
- **Anti-cheat events** — tab-blur, fullscreen exit, copy, paste, right-click, devtools open — logged to `AttemptEvent` and broadcast to the live console.
- **Auto-submit** — a scheduled BullMQ job force-submits at the deadline even if the browser is closed.

### Grading pipeline

Attempt submit → `evaluate` queue → worker:

1. Auto-grade objective questions (MCQ, MSQ, TRUE_FALSE, FILL_BLANK, NUMERICAL, IMAGE_BASED with exact match).
2. Push subjective answers (SHORT_ANSWER, LONG_ANSWER) to the grading queue for humans.
3. When all questions are graded (auto + human), compute `Result`: total, percentage, per-topic accuracy, weak topics.
4. Ranking + percentile are computed **on read** from the leaderboard endpoint, not stored, so late-graded attempts don't cause stale ranks.
5. `RESULT_PUBLISH` unlocks the result for students.

## 11. AI pipeline

- **Provider abstraction** — a thin adapter over OpenAI + Anthropic; the caller picks a `PromptId` from a registry, not a model name.
- **Prompt registry** — every prompt has an `id`, `version`, `provider`, `model`, `maxTokens`, and a Zod output schema. Bumping a prompt is a code change, not a config change.
- **Cost tracking** — every AI call writes an `AiUsage` row: tenant, prompt id, tokens in/out, USD cost. Billing surfaces this per tenant.
- **RAG** — question embeddings live in the `Embedding` table (pgvector); retrieval is a cosine-distance k-NN query scoped by tenant + subject.
- **Student flows** — weak-topic detector, study-plan generator, readiness score, practice question recommender.
- **Teacher flows** — question generator (targeted topic + difficulty), exam generator (blueprint → questions), class performance summary, homework recommendations.
- **Institute flows** — batch trends, weekly digest email.

## 12. Billing

- Four plans (`Free`, `Basic`, `Pro`, `Enterprise`) with limits (users, exams/month, AI credits, storage).
- **Usage metering** — each metered action increments a counter on `Subscription`; the API rejects with 402 when a hard limit is hit.
- **Invoices** — generated with PDFKit (GST-ready), stored in S3, signed URL on download.
- **Coupons** — percent or fixed amount, per-plan or global, redemption limits.
- **Dunning** — on failed charge: 3 retries with backoff → 7-day grace period with feature restrictions → auto-downgrade to Free.

## 13. Security posture

- **Passwords** — argon2id, per-user salt.
- **Tokens** — short access, rotating refresh with reuse detection, session listing + per-family revoke.
- **HTTP** — helmet CSP, HSTS, X-Frame-Options, no-sniff.
- **Rate limits** — per-IP for anonymous auth routes, per-user for authenticated ones, per-tenant for AI.
- **File uploads** — presigned S3 PUT URLs only; the API never proxies bytes; content-type + size are enforced client-side and re-validated on read.
- **Audit log** — every mutating admin action (invites, role changes, publish, release, billing, super-admin actions) writes to `AuditLog`.
- **Prisma extension** — the tenant guard is not opt-in.

## 14. Observability

- **Structured logs** — pino JSON to stdout; `pino-pretty` in dev. Every log line has `requestId`, `tenantId`, `userId`.
- **Error capture** — Sentry SDK on the backend; frontend Sentry wiring is stubbed (TODO in code).
- **Health** — `/api/v1/health/live` (process up), `/api/v1/health/ready` (DB + Redis reachable), `/api/v1/health` (human-readable combined).
- **Queues** — Bull-Board at `/admin/queues`.

## 15. Not yet built

Called out honestly so you know the seams:

- **Production DevOps** — Dockerfiles exist for backend; no Nginx, no k8s/Terraform, no Prometheus/Grafana/Loki, no automated backups, no CI deploy stage.
- **Deeper testing** — 39 unit tests total; no integration tests on route level, no e2e that spans API + SPA together, no load testing.
- **Legal / launch** — no Terms / Privacy / DPA copy, no public marketing site, no helpdesk integration.
- **Secure Browser** — Phase 15 Electron kiosk app is a stub; the exam runtime's proctoring works in a regular browser but OS-level lockdown isn't there.

## 16. Where to go next

- [docs/setup.md](./setup.md) to actually run it.
- [docs/api.md](./api.md) for the endpoint reference.
- [docs/features.md](./features.md) for the UI walkthrough by role.
