# Features (by role)

A walkthrough of what each role can actually do in the SPA today. Route paths point at real components in `frontend/src/features/`.

## Roles at a glance

| Role                        | Who they are                                                          | Home                    |
| --------------------------- | --------------------------------------------------------------------- | ----------------------- |
| **Student**                 | Takes exams, sees own results, uses AI study tools                    | `/` (student dashboard) |
| **Teacher**                 | Authors questions and exams, invigilates, grades                      | `/` (teacher dashboard) |
| **Institute Admin / Owner** | Configures org, users, billing; oversees everything inside the tenant | `/` (admin dashboard)   |
| **Super Admin**             | Cross-tenant platform operator                                        | `/admin`                |

Layouts:

- `AuthLayout` — centered card, used by all `/auth/*` routes.
- `DashboardLayout` — sidebar + header, used by everything else.
- `ExamLayout` — fullscreen, no chrome, used by `/exam/:id/attempt`.

Cross-cutting UI:

- **i18n** — English + Hindi (`en.json`, `hi.json`).
- **Theme** — light / dark / system (persisted).
- **Notifications** — inbox at `/notifications`, real-time badge via Socket.io.

---

## Student

### Auth flow

| Path                           | Screen                                                                   |
| ------------------------------ | ------------------------------------------------------------------------ |
| `/auth/login`                  | Log in with email + password                                             |
| `/auth/signup`                 | Sign up (creates a new institute + owner — students are usually invited) |
| `/auth/forgot-password`        | Request reset link                                                       |
| `/auth/reset-password?token=…` | Set new password                                                         |
| `/auth/verify?token=…`         | Confirm email                                                            |

### Dashboard `/`

Cards: upcoming exams, recent results, weak-topic hints from AI, quick "start exam" for anything currently open.

### Take an exam `/exam/:id/attempt`

**Phases the runtime walks through:**

1. **Intro** — exam name, section list, duration, rules, proctoring policy. Confirms fullscreen and camera prompts if enabled.
2. **Lobby** (SYNCHRONOUS only) — waits until the shared start time; shows a countdown and reconnects if you drop.
3. **In progress** — the main runtime:
   - Left: section + question navigator grid (visited / answered / marked / unanswered colour states).
   - Right: current question with input matching its type (radio / checkbox / text / numeric / long-text).
   - Header: exam timer, "mark for review", "save & next", "submit".
   - **Auto-save every 15–30s.** If the connection drops, answers queue in IndexedDB and flush on reconnect.
   - **Proctoring** — tab-blur, fullscreen exit, copy, paste, right-click, devtools events are logged and warnings are shown; repeated violations can auto-submit.
4. **Submitted** — receipt with attempt ID and a link to the result (once released).

### Results

| Path                           | What                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `/results`                     | List of every attempt with score + status (grading / released)                          |
| `/results/:attemptId`          | Question-by-question breakdown, correct answers (if enabled), your topic-level accuracy |
| `/results/:examId/leaderboard` | Rank + percentile against classmates                                                    |

### AI study tools `/ai`

- **Weak topics** — the topics you struggle with most, ranked by evidence.
- **Study plan** — a multi-week AI-generated plan targeted at your weak topics; regenerate on demand.
- **Readiness score** — predictor for an upcoming exam.
- **Practice questions** — RAG-recommended items pulled from the question bank.

### Settings

| Path                 | What                                                  |
| -------------------- | ----------------------------------------------------- |
| `/settings`          | Profile (name, photo, password)                       |
| `/settings/sessions` | Active sessions with revoke per-family and revoke-all |

### Notifications `/notifications`

Exam invites, reminder pings, result releases, AI plan updates — pushed via Socket.io, persisted server-side.

---

## Teacher

### Question Bank

| Path             | What                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/questions`     | Filter/search by subject, topic, difficulty, type, tags, author. Bulk import from CSV via presigned upload. Export to CSV.                                   |
| `/questions/new` | Author a question — pick from 8 types (MCQ, MSQ, TRUE_FALSE, FILL_BLANK, NUMERICAL, SHORT_ANSWER, LONG_ANSWER, IMAGE_BASED). Image upload goes direct to S3. |
| `/questions/:id` | Edit; every save creates an immutable `QuestionVersion` so old exams still see the exact wording they were built on.                                         |

### Exam authoring

| Path         | What                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| `/exams`     | All exams (draft / scheduled / live / ended / archived)                               |
| `/exams/new` | Six-step wizard: **metadata → sections → questions → schedule → proctoring → review** |
| `/exams/:id` | Edit while in draft; view read-only after publish                                     |

**Scheduling** picks the mode:

- **FLEXIBLE_WINDOW** — set `startAt` + `endAt`; each student's own duration timer begins when they start.
- **SYNCHRONOUS** — set a start moment; all attendees are held in the lobby until then; optional late-entry grace.

**Assignment** — target any combination of classes, batches, sections, or individual students. Publish triggers invite emails and a scheduled auto-submit job.

### Live console `/exams/:id/live-console`

Real-time table of attempts on a running exam: student, status, elapsed, connection state, proctoring flags. Row actions:

- **Send warning** — pushes a toast into the student's runtime.
- **Force-submit** — locks the attempt and hands it to the evaluator.

Backed by Socket.io (`exam:{examId}:console` room) so events land within a second.

### Grading

| Path                          | What                                                                                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `/grading`                    | Queue of pending subjective grading across your exams                                          |
| `/grading/:examId`            | Attempt list for one exam with per-attempt progress                                            |
| `/grading/:examId/:attemptId` | Grade one attempt — subjective answers side-by-side with rubric, per-question marks + comments |

Once every question is graded (auto + human), the result is computed. Teachers with `RESULT_PUBLISH` can **release** or **unrelease** the whole exam.

### Analytics

| Path                            | What                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------- |
| `/results/:examId/class-report` | Distribution of marks, per-question difficulty index, per-topic class accuracy, weak-topic clusters |
| `/analytics`                    | Dashboard — pass rate, attempt volume, batch trends                                                 |

### AI tools

- **Generate questions** — pick a topic + difficulty; the model drafts questions in the requested type; teacher reviews before saving.
- **Generate an exam** — feed a blueprint (subject, topics, difficulty mix, section counts); the model composes a full paper.
- **Class summary** — natural-language summary of how a class performed on an exam.
- **Homework recommender** — suggests targeted follow-up questions per student, drawn from the question bank via RAG.

---

## Institute Admin / Owner

Everything a Teacher has, plus:

### Institute profile `/institute`

Name, logo, contact, timezone, GST details for invoices.

### Organization `/org/*`

| Path                  | What                      |
| --------------------- | ------------------------- |
| `/org/academic-years` | Multi-year setup          |
| `/org/branches`       | Physical/logical branches |
| `/org/classes`        | Class + section CRUD      |
| `/org/batches`        | Batches with membership   |
| `/org/subjects`       | Subjects + nested topics  |

### Users `/users/*`

| Path              | What                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `/users/teachers` | Invite teachers by email; assign permissions                                            |
| `/users/students` | Invite students; assign to class/batch/section                                          |
| `/users/import`   | Bulk CSV import — presigned upload → dry-run preview → background job with progress bar |

### Billing `/billing`

| Path                | What                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| `/billing`          | Current plan, next invoice, usage bars (users / exams / AI credits / storage) |
| `/billing/pricing`  | Plan comparison, upgrade / downgrade, coupon entry                            |
| `/billing/invoices` | Invoice history with PDF download                                             |

If the plan lapses: three retry attempts → 7-day grace period with feature restrictions → automatic downgrade to Free.

### Everything else

- **Question Bank** — sees every question in the institute.
- **Exams** — sees every exam, can force-submit any attempt.
- **Analytics** — institute-wide numbers.

---

## Super Admin

Isolated console under `/admin/*` (not tenant-scoped).

| Path                   | What                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `/admin`               | Landing — tenant count, MRR, active users, health at a glance                                                  |
| `/admin/tenants`       | List all tenants; filter by plan / status                                                                      |
| `/admin/tenants/:id`   | Tenant profile: owner, users, subscription, usage, audit log; **suspend / reactivate / override plan** actions |
| `/admin/revenue`       | Revenue dashboard — MRR, ARR, churn, plan mix, coupon usage                                                    |
| `/admin/feature-flags` | Global feature flags (create / toggle / delete)                                                                |
| `/admin/health`        | API + DB + Redis + queue depths + AI provider status                                                           |

Super-admin actions are always written to `AuditLog` with actor + tenant + payload.

---

## Cross-role features

### Notifications

Inbox lives at `/notifications`. A Socket.io badge lights up when new items arrive (exam invites, result releases, billing alerts, AI plan ready, etc.).

### Settings

Available to everyone at `/settings` — profile, password change, session list, theme, language.

### Realtime

Every role holds a Socket.io connection. Rooms:

- `t:{tenantId}` — tenant broadcasts (billing, feature flag changes).
- `u:{userId}` — direct pushes (notifications, forced logout).
- `attempt:{attemptId}` — student runtime + invigilators.
- `exam:{examId}:console` — invigilators only.

### File uploads

Any UI that uploads a file (logos, photos, question images, CSVs) goes through the same three-step presigned pattern documented in [docs/api.md](./api.md#uploads).

---

## What's not in the UI yet

Called out honestly:

- No public marketing/landing page — the app redirects unauthenticated users to `/auth/login`.
- Frontend Sentry wiring is stubbed (TODO in code); backend Sentry is live.
- Secure Browser (Phase 15) — the proctoring surface in `/exam/:id/attempt` works in a standard browser; the Electron kiosk that hardens it at the OS level is a stub in `secure-browser/`.
- Some dashboards (institute analytics, super-admin revenue) render on real data but haven't been polished for large-scale customers yet.

For the roadmap, see [task.md](../task.md).
