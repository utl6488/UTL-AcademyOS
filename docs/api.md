# REST API Reference

The backend exposes a versioned REST API under `/api/v1`. Every response is JSON. Every mutating request must send a Bearer JWT unless marked **Public**.

- **Base URL (dev)** — `http://localhost:4000/api/v1`
- **Swagger UI** — `http://localhost:4000/api/docs`
- **OpenAPI JSON** — `http://localhost:4000/api/openapi.json`

## Conventions

### Authentication

```
Authorization: Bearer <access-token>
```

Access tokens are short-lived (~15 min). When they expire, call `POST /auth/refresh` with the refresh token — you receive a new access + refresh pair and the old refresh is invalidated. Replaying an old refresh revokes the whole session family.

### Tenant scoping

The tenant is derived from the token — clients never send a `tenantId` header. Cross-tenant IDs in URL params are rejected with `403`.

### Errors

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "email is required",
    "requestId": "req_01H…",
    "details": [/* zod issues, when applicable */]
  }
}
```

Common codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `RATE_LIMITED`, `PLAN_LIMIT_EXCEEDED`, `INTERNAL_ERROR`.

### Pagination

List endpoints accept `page` (1-indexed) and `pageSize` (default 20, max 100). Responses:

```json
{
  "items": [/* … */],
  "page": 1,
  "pageSize": 20,
  "total": 137
}
```

### Uploads

Files are never POSTed to the API. Instead:

1. `POST …/upload-url` → returns a presigned S3 PUT URL.
2. Client `PUT`s bytes directly to S3.
3. Client sends the returned object key back with the parent record (e.g. `imageKey` on a question).

---

## Modules

### Health

| Method | Path            | Description             | Auth   | Roles |
| ------ | --------------- | ----------------------- | ------ | ----- |
| GET    | `/health/live`  | Liveness probe          | Public | —     |
| GET    | `/health/ready` | Readiness (DB + Redis)  | Public | —     |
| GET    | `/health`       | Combined human-readable | Public | —     |

### Auth

| Method | Path                        | Description                | Auth   | Roles |
| ------ | --------------------------- | -------------------------- | ------ | ----- |
| POST   | `/auth/signup`              | Register institute + owner | Public | —     |
| POST   | `/auth/login`               | Log in, receive tokens     | Public | —     |
| POST   | `/auth/refresh`             | Rotate tokens              | Public | —     |
| POST   | `/auth/logout`              | Revoke a refresh token     | Public | —     |
| POST   | `/auth/logout-all`          | Revoke every session       | Yes    | any   |
| POST   | `/auth/verify-email`        | Confirm email address      | Public | —     |
| POST   | `/auth/resend-verification` | Resend verify email        | Public | —     |
| POST   | `/auth/forgot-password`     | Request password reset     | Public | —     |
| POST   | `/auth/reset-password`      | Complete password reset    | Public | —     |
| GET    | `/auth/me`                  | Current user profile       | Yes    | any   |
| GET    | `/auth/sessions`            | List active sessions       | Yes    | any   |
| DELETE | `/auth/sessions/:familyId`  | Revoke a session family    | Yes    | any   |

**Example — login**

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@demo.local","password":"changeme123"}'
```

```json
{
  "user": { "id": "usr_…", "email": "teacher@demo.local", "role": "TEACHER" },
  "accessToken": "eyJhbGciOi…",
  "refreshToken": "eyJhbGciOi…",
  "expiresIn": 900
}
```

### Users

| Method | Path                          | Description              | Auth | Roles         |
| ------ | ----------------------------- | ------------------------ | ---- | ------------- |
| GET    | `/users`                      | List institute users     | Yes  | `USER_READ`   |
| GET    | `/users/:id`                  | Get user                 | Yes  | `USER_READ`   |
| PATCH  | `/users/:id`                  | Update user              | Yes  | `USER_MANAGE` |
| PATCH  | `/users/:id/activate`         | Activate user            | Yes  | `USER_MANAGE` |
| PATCH  | `/users/:id/deactivate`       | Deactivate user          | Yes  | `USER_MANAGE` |
| POST   | `/users/invite`               | Send invite              | Yes  | `USER_INVITE` |
| POST   | `/users/:id/photo/upload-url` | Presigned photo URL      | Yes  | `USER_MANAGE` |
| POST   | `/users/import/upload-url`    | Presigned import CSV URL | Yes  | `USER_INVITE` |
| POST   | `/users/import/preview`       | Dry-run CSV import       | Yes  | `USER_INVITE` |
| POST   | `/users/import/start`         | Enqueue import job       | Yes  | `USER_INVITE` |
| GET    | `/users/import/:jobId`        | Poll import job          | Yes  | `USER_READ`   |

### Institute

| Method | Path                         | Description            | Auth | Roles              |
| ------ | ---------------------------- | ---------------------- | ---- | ------------------ |
| GET    | `/institute/profile`         | Get institute settings | Yes  | `INSTITUTE_READ`   |
| PUT    | `/institute/profile`         | Replace profile        | Yes  | `INSTITUTE_MANAGE` |
| PATCH  | `/institute/profile`         | Partial update         | Yes  | `INSTITUTE_MANAGE` |
| POST   | `/institute/logo/upload-url` | Presigned logo URL     | Yes  | `INSTITUTE_MANAGE` |

### Organization (branches, classes, batches, subjects, topics)

| Method | Path                              | Description  | Auth | Roles        |
| ------ | --------------------------------- | ------------ | ---- | ------------ |
| GET    | `/org/academic-years`             | List         | Yes  | `ORG_READ`   |
| POST   | `/org/academic-years`             | Create       | Yes  | `ORG_MANAGE` |
| PUT    | `/org/academic-years/:id`         | Update       | Yes  | `ORG_MANAGE` |
| DELETE | `/org/academic-years/:id`         | Delete       | Yes  | `ORG_MANAGE` |
| GET    | `/org/branches`                   | List         | Yes  | `ORG_READ`   |
| POST   | `/org/branches`                   | Create       | Yes  | `ORG_MANAGE` |
| PUT    | `/org/branches/:id`               | Update       | Yes  | `ORG_MANAGE` |
| DELETE | `/org/branches/:id`               | Delete       | Yes  | `ORG_MANAGE` |
| GET    | `/org/classes`                    | List         | Yes  | `ORG_READ`   |
| POST   | `/org/classes`                    | Create       | Yes  | `ORG_MANAGE` |
| PUT    | `/org/classes/:id`                | Update       | Yes  | `ORG_MANAGE` |
| DELETE | `/org/classes/:id`                | Delete       | Yes  | `ORG_MANAGE` |
| GET    | `/org/batches`                    | List         | Yes  | `ORG_READ`   |
| POST   | `/org/batches`                    | Create       | Yes  | `ORG_MANAGE` |
| PUT    | `/org/batches/:id`                | Update       | Yes  | `ORG_MANAGE` |
| DELETE | `/org/batches/:id`                | Delete       | Yes  | `ORG_MANAGE` |
| GET    | `/org/subjects`                   | List         | Yes  | `ORG_READ`   |
| POST   | `/org/subjects`                   | Create       | Yes  | `ORG_MANAGE` |
| PUT    | `/org/subjects/:id`               | Update       | Yes  | `ORG_MANAGE` |
| DELETE | `/org/subjects/:id`               | Delete       | Yes  | `ORG_MANAGE` |
| GET    | `/org/subjects/:subjectId/topics` | List topics  | Yes  | `ORG_READ`   |
| POST   | `/org/subjects/:subjectId/topics` | Create topic | Yes  | `ORG_MANAGE` |
| PUT    | `/org/topics/:id`                 | Update topic | Yes  | `ORG_MANAGE` |
| DELETE | `/org/topics/:id`                 | Delete topic | Yes  | `ORG_MANAGE` |

### Questions

| Method | Path                           | Description            | Auth | Roles             |
| ------ | ------------------------------ | ---------------------- | ---- | ----------------- |
| GET    | `/questions`                   | List                   | Yes  | `QUESTION_READ`   |
| POST   | `/questions`                   | Create                 | Yes  | `QUESTION_MANAGE` |
| GET    | `/questions/:id`               | Get                    | Yes  | `QUESTION_READ`   |
| PUT    | `/questions/:id`               | Update (bumps version) | Yes  | `QUESTION_MANAGE` |
| DELETE | `/questions/:id`               | Soft-delete            | Yes  | `QUESTION_MANAGE` |
| GET    | `/questions/:id/versions`      | Version history        | Yes  | `QUESTION_READ`   |
| POST   | `/questions/image/upload-url`  | Presigned image URL    | Yes  | `QUESTION_MANAGE` |
| POST   | `/questions/import/upload-url` | Presigned CSV URL      | Yes  | `QUESTION_MANAGE` |
| POST   | `/questions/import/start`      | Enqueue import         | Yes  | `QUESTION_MANAGE` |
| GET    | `/questions/import/:jobId`     | Poll import            | Yes  | `QUESTION_READ`   |
| POST   | `/questions/export`            | Stream CSV export      | Yes  | `QUESTION_READ`   |

**Question types** — `MCQ`, `MSQ`, `TRUE_FALSE`, `FILL_BLANK`, `NUMERICAL`, `SHORT_ANSWER`, `LONG_ANSWER`, `IMAGE_BASED`.

### Exams

| Method | Path                                          | Description              | Auth | Roles         |
| ------ | --------------------------------------------- | ------------------------ | ---- | ------------- |
| GET    | `/exams`                                      | List                     | Yes  | `EXAM_READ`   |
| POST   | `/exams`                                      | Create draft             | Yes  | `EXAM_MANAGE` |
| GET    | `/exams/:id`                                  | Get                      | Yes  | `EXAM_READ`   |
| PUT    | `/exams/:id`                                  | Update draft             | Yes  | `EXAM_MANAGE` |
| DELETE | `/exams/:id`                                  | Delete draft             | Yes  | `EXAM_MANAGE` |
| POST   | `/exams/:id/publish`                          | Publish to students      | Yes  | `EXAM_MANAGE` |
| POST   | `/exams/:id/unpublish`                        | Withdraw                 | Yes  | `EXAM_MANAGE` |
| POST   | `/exams/:id/duplicate`                        | Clone                    | Yes  | `EXAM_MANAGE` |
| GET    | `/exams/:id/live-console`                     | Live monitor payload     | Yes  | `EXAM_READ`   |
| POST   | `/exams/:id/start`                            | Student begins attempt   | Yes  | `EXAM_TAKE`   |
| POST   | `/exams/:id/attempts/:attemptId/force-submit` | Invigilator force-submit | Yes  | `EXAM_MANAGE` |
| POST   | `/exams/:id/attempts/:attemptId/send-warning` | Push warning to student  | Yes  | `EXAM_MANAGE` |

**Exam modes** — `FLEXIBLE_WINDOW` (start any time within window) and `SYNCHRONOUS` (all start together, with lobby + late-entry grace).

### Attempts (student-facing runtime)

| Method | Path                              | Description                     | Auth | Roles       |
| ------ | --------------------------------- | ------------------------------- | ---- | ----------- |
| POST   | `/attempts/reserve`               | Reserve attempt slot            | Yes  | `EXAM_TAKE` |
| GET    | `/attempts/:id`                   | Attempt state                   | Yes  | `EXAM_TAKE` |
| GET    | `/attempts/:id/answers`           | Saved answers                   | Yes  | `EXAM_TAKE` |
| POST   | `/attempts/:id/answers`           | Save one answer                 | Yes  | `EXAM_TAKE` |
| POST   | `/attempts/:id/answers/batch`     | Save many (offline queue flush) | Yes  | `EXAM_TAKE` |
| POST   | `/attempts/:id/submit`            | Submit for grading              | Yes  | `EXAM_TAKE` |
| POST   | `/attempts/:id/proctoring-events` | Log anti-cheat events           | Yes  | `EXAM_TAKE` |
| POST   | `/attempts/:id/launch-token`      | Token for secure browser launch | Yes  | `EXAM_TAKE` |

**Auto-save contract** — the client posts an answer no less than every 15s; server accepts idempotent saves keyed by `(attemptId, questionId)`. Offline: queued in IndexedDB and flushed via `/answers/batch` on reconnect.

### Grading

| Method | Path                                         | Description           | Auth | Roles            |
| ------ | -------------------------------------------- | --------------------- | ---- | ---------------- |
| GET    | `/grading/queue`                             | Pending grading items | Yes  | `EXAM_GRADE`     |
| GET    | `/grading/exams/:examId/attempts`            | Attempts for exam     | Yes  | `EXAM_GRADE`     |
| GET    | `/grading/attempts/:attemptId`               | Attempt for grading   | Yes  | `EXAM_GRADE`     |
| POST   | `/grading/attempts/:attemptId/grade`         | Grade one question    | Yes  | `EXAM_GRADE`     |
| POST   | `/grading/attempts/:attemptId/submit-grades` | Finalise attempt      | Yes  | `EXAM_GRADE`     |
| POST   | `/grading/exams/:examId/release`             | Release to students   | Yes  | `RESULT_PUBLISH` |
| POST   | `/grading/exams/:examId/unrelease`           | Withdraw results      | Yes  | `RESULT_PUBLISH` |

### Results

| Method | Path                                  | Description           | Auth | Roles                                  |
| ------ | ------------------------------------- | --------------------- | ---- | -------------------------------------- |
| GET    | `/results/attempts/:attemptId`        | Single attempt result | Yes  | `RESULT_READ_OWN` or `RESULT_READ_ALL` |
| GET    | `/results/exams/:examId/leaderboard`  | Exam leaderboard      | Yes  | `EXAM_READ`                            |
| GET    | `/results/exams/:examId/class-report` | Class-wide report     | Yes  | `RESULT_READ_ALL`                      |

Ranking and percentile are computed **on read** so late-graded subjective answers don't leave stale ranks.

### Analytics

| Method | Path                                 | Description              | Auth | Roles             |
| ------ | ------------------------------------ | ------------------------ | ---- | ----------------- |
| GET    | `/analytics/dashboard`               | Institute KPI dashboard  | Yes  | `RESULT_READ_ALL` |
| GET    | `/analytics/batches/:batchId/trends` | Batch performance trends | Yes  | `RESULT_READ_ALL` |

### AI

| Method | Path                                          | Description                  | Auth | Roles                                |
| ------ | --------------------------------------------- | ---------------------------- | ---- | ------------------------------------ |
| GET    | `/ai/students/:studentId/weak-topics`         | Weak-topic detector          | Yes  | `AI_USE_STUDENT` or `AI_USE_TEACHER` |
| GET    | `/ai/students/:studentId/study-plan`          | Retrieve plan                | Yes  | `AI_USE_STUDENT` or `AI_USE_TEACHER` |
| POST   | `/ai/students/:studentId/study-plan/generate` | Generate plan                | Yes  | `AI_USE_STUDENT` or `AI_USE_TEACHER` |
| GET    | `/ai/students/:studentId/predictions`         | Performance predictions      | Yes  | `AI_USE_STUDENT` or `AI_USE_TEACHER` |
| GET    | `/ai/students/:studentId/practice-questions`  | RAG-recommended Qs           | Yes  | `AI_USE_STUDENT` or `AI_USE_TEACHER` |
| POST   | `/ai/questions/generate`                      | Generate questions           | Yes  | `AI_USE_TEACHER`                     |
| POST   | `/ai/exams/generate`                          | Generate exam from blueprint | Yes  | `AI_USE_TEACHER`                     |
| GET    | `/ai/exams/:examId/class-summary`             | Class performance summary    | Yes  | `AI_USE_TEACHER`                     |
| GET    | `/ai/homework/recommend`                      | Homework recommendations     | Yes  | `AI_USE_TEACHER`                     |
| POST   | `/ai/feedback`                                | 👍/👎 on AI output           | Yes  | `AI_USE_STUDENT` or `AI_USE_TEACHER` |

Every AI call writes an `AiUsage` row (tokens, USD). Hard limit → `402 PLAN_LIMIT_EXCEEDED`.

### Billing

| Method | Path                             | Description          | Auth | Roles            |
| ------ | -------------------------------- | -------------------- | ---- | ---------------- |
| GET    | `/billing/plans`                 | Available plans      | Yes  | `BILLING_READ`   |
| GET    | `/billing/subscription`          | Current subscription | Yes  | `BILLING_READ`   |
| GET    | `/billing/usage`                 | Metered usage        | Yes  | `BILLING_READ`   |
| GET    | `/billing/invoices`              | Invoice list         | Yes  | `BILLING_READ`   |
| GET    | `/billing/invoices/:id/download` | Signed PDF URL       | Yes  | `BILLING_READ`   |
| POST   | `/billing/checkout`              | Start checkout       | Yes  | `BILLING_MANAGE` |
| POST   | `/billing/coupons/apply`         | Apply coupon         | Yes  | `BILLING_MANAGE` |
| POST   | `/billing/subscription/cancel`   | Cancel               | Yes  | `BILLING_MANAGE` |
| POST   | `/billing/subscription/resume`   | Resume               | Yes  | `BILLING_MANAGE` |

Plans: `Free`, `Basic`, `Pro`, `Enterprise`.

### Admin (super-admin only)

| Method | Path                               | Description          | Auth | Roles         |
| ------ | ---------------------------------- | -------------------- | ---- | ------------- |
| GET    | `/admin/tenants`                   | List tenants         | Yes  | `SUPER_ADMIN` |
| GET    | `/admin/tenants/:id`               | Tenant detail        | Yes  | `SUPER_ADMIN` |
| POST   | `/admin/tenants/:id/suspend`       | Suspend tenant       | Yes  | `SUPER_ADMIN` |
| POST   | `/admin/tenants/:id/reactivate`    | Reactivate           | Yes  | `SUPER_ADMIN` |
| POST   | `/admin/tenants/:id/override-plan` | Manual plan override | Yes  | `SUPER_ADMIN` |
| GET    | `/admin/revenue`                   | Revenue metrics      | Yes  | `SUPER_ADMIN` |
| GET    | `/admin/feature-flags`             | List flags           | Yes  | `SUPER_ADMIN` |
| POST   | `/admin/feature-flags`             | Create flag          | Yes  | `SUPER_ADMIN` |
| PATCH  | `/admin/feature-flags/:id`         | Update flag          | Yes  | `SUPER_ADMIN` |
| DELETE | `/admin/feature-flags/:id`         | Delete flag          | Yes  | `SUPER_ADMIN` |
| GET    | `/admin/health`                    | Platform health      | Yes  | `SUPER_ADMIN` |

---

## Realtime (Socket.io)

- **Endpoint** — same origin as the API (`http://localhost:4000`), default namespace `/`.
- **Auth** — send the access JWT in `handshake.auth.token`.
- **Auto-joined rooms** on connect — `t:{tenantId}`, `u:{userId}`.

| Event               | Direction       | Payload                     | Purpose                                       |
| ------------------- | --------------- | --------------------------- | --------------------------------------------- |
| `attempt:join`      | client → server | `{ attemptId }`             | Join the attempt room (ack: `{ ok, error? }`) |
| `attempt:heartbeat` | client → server | `{ attemptId }`             | Presence tick                                 |
| `attempt:heartbeat` | server → client | `{ attemptId, userId, at }` | Rebroadcast to invigilators                   |
| `exam:console:join` | client → server | `{ examId }`                | Invigilator joins live console                |
| `disconnect`        | server          | `reason`                    | Standard Socket.io event                      |

Additional events flow into the exam console room (`exam:{examId}:console`) for proctoring notices; the SPA subscribes and renders them in the live console UI.

---

## Rate limits

Applied per category, backed by Redis. On limit:

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1734280000
```

Categories (roughly): `auth-anonymous` (tight, per IP), `auth-authenticated`, `generic`, `ai` (per tenant), `export` (per tenant).

---

## Versioning

The API is mounted at `/api/v1`. Breaking changes will introduce `/api/v2` alongside `v1`; single-endpoint additions are non-breaking.
