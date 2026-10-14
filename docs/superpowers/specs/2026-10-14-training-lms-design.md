# Training LMS: Design and Implementation Plan

Status: **Phase 0 approved 2026-10-14**. All decisions in §11 confirmed by the trainer.
Date: 2026-10-14

This document covers the architecture, data model, API, permissions, phases and acceptance criteria for the full-stack training LMS. Items marked **[DECISION Dn]** refer to the confirmed decisions in §11.

---

## 1. Starting point

Repository inspection (2026-10-14):

- `client/` is empty. `server/app.js` exists but is a 0-byte file. There's no `package.json`, no lockfile and no README. Nothing needs to be preserved.
- The folder is **not a git repository**.
- Machine: Node v22.21.1, npm 10.9.4, git 2.48.1, MongoDB server 8.2.5 running on `localhost:27017`. No `mongosh`, no Docker.

`server/app.js` moves to `server/src/app.js`, following the requested folder structure.

## 2. Goal and success criteria

One trainer (admin) runs three starter courses (MERN, Java Full-Stack, DSA with JS) and any courses added later. Students sign up, get enrolled, work through the roadmaps lesson by lesson, read notes, code and PDFs, and submit assignments. The trainer reviews and grades the work and tracks progress.

The project succeeds when:

1. A fresh clone, `npm install`, `npm run seed` and `npm run dev` gives a working app with the 3 courses, real starter content, a demo admin and demo students.
2. Every permission rule in §6 is enforced on the server and covered by an automated API test.
3. The full student flow works end to end: sign up → enroll → complete lessons → submit → see feedback. So does the full trainer flow: create content → publish → review → grade → see reports.
4. Video is out of scope. There are no video models, players or upload paths.
5. This is a single-trainer product. There are no tenants, organizations or per-tenant data scoping. Adding more admins later only needs the existing `role` field.

## 3. Tech stack

| Area                | Choice                                                                                                 | Notes                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Client              | React 19, Vite, Tailwind CSS v4, React Router v7                                                       |                                                                                                         |
| Server state        | TanStack Query                                                                                         | Handles caching, loading and error states, and pagination                                               |
| Forms               | react-hook-form + zod                                                                                  | The same validation rules as the server, written separately on each side                                |
| HTTP client         | axios instance with an interceptor                                                                     | Attaches the access token and retries once after a refresh                                              |
| Notes rendering     | react-markdown + remark-gfm + rehype-sanitize                                                          | **[DECISION D2]** Notes are stored as Markdown                                                          |
| Syntax highlighting | prism-react-renderer                                                                                   | Covers JS/TS, Java, SQL, HTML, CSS, JSON, bash and more                                                 |
| Code input          | CodeMirror 6 (`@uiw/react-codemirror`)                                                                 | For trainer snippets and student code submissions                                                       |
| Server              | Node 22, Express 5, Mongoose 8, ES modules                                                             |                                                                                                         |
| Auth                | bcrypt (cost 12) and jsonwebtoken                                                                      | **[DECISION D4]** Access token kept in memory, refresh token in an httpOnly cookie                      |
| Validation          | zod schemas plus a `validate(schema)` middleware                                                       | Applied to body, params and query                                                                       |
| Security            | helmet, cors (allowlist), express-rate-limit, `express.json({limit:'1mb'})`, Mongoose `sanitizeFilter` | `express-mongo-sanitize` doesn't work with Express 5, so filters are sanitized through Mongoose and zod |
| Uploads             | multer and `file-type` (magic-byte check)                                                              | Checks extension, MIME type and actual file content                                                     |
| Storage             | `StorageProvider` interface: `local` driver, plus an S3-compatible driver                              | **[DECISION D3]**                                                                                       |
| Logging             | pino + pino-http                                                                                       |                                                                                                         |
| Tests               | Vitest + Supertest (API); Vitest + React Testing Library (UI); Playwright (E2E, Phase 8)               | API tests use a throwaway `lms_test_<run>` database on the local mongod                                 |
| Language            | JavaScript (ESM)                                                                                       | **[DECISION D1]** TypeScript is the alternative                                                         |

A root `package.json` uses npm workspaces (`client`, `server`) with `dev`, `test`, `lint` and `seed` scripts. The server and client run together through `concurrently`. ESLint and Prettier are set up for both workspaces.

## 4. Architecture

```
client (Vite SPA, :5173) ──/api proxy──▶ server (Express, :5000) ──▶ MongoDB
                                               │
                                               └──▶ StorageProvider (local disk | S3-compatible)
```

### Server layout (`server/src/`)

```
config/       env.js (zod-validated env), db.js, storage.js
models/       one Mongoose model per file
validators/   zod schemas per resource
middleware/   auth.js (authenticate, requireRole), validate.js, upload.js,
              rateLimits.js, errorHandler.js, notFound.js
services/     business rules (access checks, progress math, submission rules,
              notifications, storage drivers)
controllers/  thin handlers: parse → call service → respond
routes/       one router per resource, mounted under /api/v1
utils/        ApiError, asyncHandler, respond(), pagination, slugify
seeds/        seed.js + data/{mern,java,dsa}.js + demo users/assignments
app.js        builds the Express app (no listen): used by tests
server.js     connects to the DB and listens
```

Controllers never query for access rules themselves. They go through a single **access service** (`canViewCourse`, `canViewLesson`, `canViewFile`, `canViewSubmission`, …). That way every permission rule has one implementation, and one test target.

### Client layout (`client/src/`)

```
components/   design-system primitives (Button, Input, Badge, ProgressBar,
              Skeleton, EmptyState, ConfirmDialog, Pagination, DataTable,
              MarkdownView, CodeBlock, FileCard, Toast)
layouts/      AuthLayout, DashboardLayout (sidebar + topbar), role-specific nav
features/     auth, courses, roadmaps, lessons, assignments, dashboard,
              notifications: each has api.js (query hooks), components, pages
services/     http.js (axios + refresh interceptor), queryClient.js
context/      AuthContext (current user, login/logout)
hooks/        useDebounce, useDisclosure, …
routes/       router config with <RequireAuth role="admin|student">
utils/        formatters (dates, durations, marks), status helpers
```

Admin pages live under `/admin/*` and student pages under `/app/*`. The route guards are only for UX. The server is the actual authority.

### API conventions

- Base path `/api/v1`.
- Success: `{ success: true, data, meta? }`, where `meta` = `{ page, limit, total, totalPages }` for lists.
- Error: `{ success: false, error: { code, message, details? } }`, with codes such as `VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `FILE_REJECTED`.
- Pagination: `?page=1&limit=20` (max 100). Lists also take `?q=` and filters.
- When students request unpublished content or content they're not enrolled in, the API returns **404, not 403**, so it doesn't reveal what exists.
- Ordering: every ordered entity has an integer `order`. Reordering goes through `PATCH …/reorder` with `{ ids: [...] }`, which runs as a single `bulkWrite`.

## 5. Data model

All models have `timestamps: true`. `ref` means an ObjectId reference.

**User**: `name`, `email` (unique, lowercase), `passwordHash` (`select:false`), `role` (`admin` | `student`, default `student`, never taken from request bodies), `avatarUrl`, `bio`, `isActive`, `lastLoginAt`, `tokenVersion` (bumped on password change to invalidate all access tokens and sessions).

**Session**: one refresh token. `user`, `family`, `tokenHash` (unique), `expiresAt` (TTL), `revokedAt`, `replacedAt`, `userAgent`, `ip`. See §11a.

**Course**: `title`, `slug` (unique), `summary`, `description` (md), `thumbnail` (ref FileAsset or URL), `level` (`beginner` | `intermediate` | `advanced`), `estimatedHours`, `status` (`draft` | `published` | `archived`), `tags[]`, `createdBy`. Index: `{status, createdAt}`.

**Module**: `course`, `title`, `description`, `order`, `status` (`draft` | `published` | `archived`). Index: `{course, order}`.

**Lesson**: `course`, `module`, `title`, `slug`, `objectives[]`, `prerequisites[]`, `estimatedMinutes`, `order`, `status`. Index: `{module, order}`, `{course, status}`.

**Material**: one ordered content block inside a lesson. `lesson`, `course` (denormalized for access checks), `type` (`note` | `code` | `file` | `link`), `title`, `order`, `status`, plus a type-specific payload:

- `note`: `body` (Markdown, which can include fenced code)
- `code`: `language`, `source`, `caption`
- `file`: `file` (ref FileAsset), `downloadable` (bool)
- `link`: `url`, `description` (external reading, docs)

A lesson page renders its materials in order. Keeping notes, code and files as separate blocks lets the trainer reorder, publish and edit each one independently.

**FileAsset**: `provider`, `storageKey`, `originalName`, `mimeType`, `size`, `uploadedBy`, `purpose` (`material` | `assignment` | `submission` | `thumbnail` | `avatar`), `course?`, `checksum`. Files are **never** served as public static files. They're streamed through `GET /files/:id`, which runs the access service first (S3 uses short-lived signed URLs instead).

**Enrollment**: `user`, `course`, `status` (`pending` | `active` | `removed`), `enrolledBy`, `lastLesson`, `lastAccessedAt`. Unique `{user, course}`. **[DECISION D5]**

**LessonProgress**: `user`, `course`, `lesson`, `completedAt`. Unique `{user, lesson}`. Course progress = completed **published** lessons ÷ total published lessons. It's computed with an aggregation and never stored, so it stays correct when the trainer adds or removes lessons.

**Assignment**: `course`, `module?`, `lesson?`, `title`, `instructions` (md), `objectives[]`, `dueAt`, `maxMarks`, `allowedSubmissionTypes[]` (`drive_url` | `github_url` | `project_url` | `pdf` | `code`), `attachments[]` (ref FileAsset), `latePolicy { allowLate, lateUntil?, penaltyPercent }`, `maxAttempts?`, `status`. Index: `{course, status, dueAt}`.

**Submission**: one document **per attempt** (that gives the submission history). `assignment`, `course`, `student`, `attempt` (1, 2, …), `items[]` (each `{ type, url? | file? | code?{language, source} }`), `note`, `submittedAt`, `isLate`, `status` (`submitted` | `reviewed` | `resubmit_requested`), `review { marks, finalMarks, feedback, reviewedBy, reviewedAt }`. Unique `{assignment, student, attempt}`. Index: `{course, status}`, `{student, submittedAt}`.

The student-facing state of an assignment is **derived**, not stored: `pending`, `overdue` (past the deadline or late cutoff with no submission), `submitted`, `reviewed`, `resubmit_requested`.

Rules:

- A student can **edit** their latest attempt while it's `submitted` (not yet reviewed) and the submission window is still open.
- A **new attempt** is allowed only when the trainer sets `resubmit_requested`, and `maxAttempts` hasn't been reached.
- Late submissions are accepted until `lateUntil` if `allowLate` is set. `finalMarks = marks × (1 − penaltyPercent/100)` when the submission is late.

**Notification**: `user`, `type` (`material_published` | `assignment_published` | `submission_reviewed` | `resubmit_requested` | `deadline_soon` | `submission_received`), `title`, `body`, `link`, `readAt`. Index: `{user, readAt, createdAt}`. Old read notifications are removed with a TTL of 90 days.

**Activity**: `user`, `course`, `type` (`lesson_completed` | `submission_created` | `login` | …), `ref`, `createdAt`. Append-only. Feeds "recent activity" and the learning-activity reports. TTL of 1 year.

## 6. Permissions matrix

| Resource / action                                                               | Admin                                         | Student                                                                                                                                                             |
| ------------------------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign up                                                                         | — (admins are created by seed/CLI only)       | ✔ always created as `student`                                                                                                                                       |
| Courses: list                                                                   | all statuses                                  | `published` only                                                                                                                                                    |
| Course detail, modules, lessons, materials                                      | all                                           | published course **and** published module/lesson/material **and** active enrollment (the course overview page is visible without enrollment, lesson content is not) |
| Course/module/lesson/material create, update, reorder, publish, archive, delete | ✔                                             | ✘                                                                                                                                                                   |
| Files                                                                           | ✔                                             | `material`/`assignment` files: same rule as the parent content. `submission` files: only the owner. `downloadable:false` files: view inline, no attachment header   |
| Enrollment                                                                      | manage anyone                                 | request/self-enroll per **[D5]**; read own                                                                                                                          |
| Lesson progress                                                                 | read all                                      | mark/unmark **own**, enrolled + published lessons only                                                                                                              |
| Assignments                                                                     | full CRUD                                     | read published assignments for enrolled courses                                                                                                                     |
| Submissions                                                                     | read all, review, grade, request resubmission | create/edit **own** under the rules in §5. Never sees another student's submission (404)                                                                            |
| Reports / dashboards                                                            | trainer dashboard, course & student reports   | own dashboard only                                                                                                                                                  |
| Notifications                                                                   | own                                           | own                                                                                                                                                                 |

Ownership always comes from `req.user.id`. Any `student`, `role`, `reviewedBy`, `marks` or `status` fields in a student's request body are dropped by the zod schemas.

**Deleting content:** a course, module or lesson can't be hard-deleted if it has submissions or progress. Archive it instead. Hard delete is only allowed on empty drafts.

## 7. API plan (by phase)

**Phase 1 (auth):** `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `PATCH /users/me`, `PATCH /users/me/password`, `GET /health`.

**Phase 2 (courses & roadmap):**
`GET|POST /courses`, `GET|PATCH|DELETE /courses/:id`, `PATCH /courses/:id/status`,
`GET|POST /courses/:id/modules`, `PATCH /courses/:id/modules/reorder`, `PATCH|DELETE /modules/:id`,
`GET|POST /modules/:id/lessons`, `PATCH /modules/:id/lessons/reorder`, `GET|PATCH|DELETE /lessons/:id`,
`GET /courses/:id/roadmap` (the whole tree, filtered by role),
`POST /courses/:id/enroll`, `GET|POST /admin/enrollments`, `PATCH /admin/enrollments/:id`.

**Phase 3 (materials):** `GET|POST /lessons/:id/materials`, `PATCH /lessons/:id/materials/reorder`, `PATCH|DELETE /materials/:id`, `POST /files` (multipart), `GET /files/:id`, `GET /lessons/:id/navigation` (previous/next).

**Phase 4 (assignments):** `GET|POST /assignments` (filters: course, module, lesson, status), `GET|PATCH|DELETE /assignments/:id`, `POST /assignments/:id/submissions`, `GET /assignments/:id/submissions/me`, `PATCH /submissions/:id`.

**Phase 5 (student progress):** `POST|DELETE /lessons/:id/complete`, `GET /me/courses` (enrolled + progress + continue-learning), `GET /me/assignments` (with derived statuses), `GET /dashboard/student`.

**Phase 6 (review & analytics):** `GET /admin/submissions` (filters: course, status, student, late), `POST /submissions/:id/review`, `POST /submissions/:id/request-resubmission`, `GET /admin/students` (search, filter, paginate), `GET /admin/students/:id`, `GET /dashboard/admin`, `GET /reports/courses/:id`, `GET /reports/students/:id`.

**Phase 7 (notifications):** `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`, `GET /notifications/unread-count`. The client polls the unread count every 60 s. **[DECISION D6]**

## 8. Validation and upload rules

- **Links:** must parse with `new URL()` and use `https:`. Allowed hosts:
  - `drive_url`: `drive.google.com`, `docs.google.com`
  - `github_url`: `github.com`, with path `/owner/repo[/...]`
  - `project_url`: any public host. Localhost, private IP ranges and `javascript:`/`data:` schemes are rejected.
- **Uploads:**
  - Materials: PDF ≤ 20 MB, plus optional DOCX/PPTX ≤ 20 MB.
  - Submissions: PDF only, ≤ 10 MB.
  - Thumbnails and avatars: JPEG/PNG/WebP ≤ 2 MB.
  - Each file must match on extension, on the declared MIME type, **and** on its magic bytes (`file-type`).
  - Stored filenames are random keys. The original name is kept only as metadata.
- **Code submissions:** ≤ 100 KB of text, with `language` taken from an allowlist. Code is stored and displayed as text and never executed.
- **Rate limits:**
  - Auth routes: 10 requests / 15 min / IP.
  - Uploads: 30 / hour / user.
  - All other routes: 300 / 15 min / IP.

## 9. Seed data

`npm run seed` is **idempotent and non-destructive**. It creates a course only if its slug doesn't exist yet, so trainer edits are never overwritten. `npm run seed -- --reset` drops and recreates the data (dev only, and it refuses to run when `NODE_ENV=production`).

The seed creates:

- **Admin**: from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `.env`.
- **3 published courses**, with modules matching the roadmaps in the brief:
  - MERN: 11 modules
  - Java: 13 modules
  - DSA: 14 modules
- **Content**: every module has 2–4 lessons. Every lesson has real objectives, a concise Markdown note (roughly 150–400 words), and at least one code example in the right language. Some lessons also link to official docs (MDN, react.dev, docs.oracle.com, spring.io).
- **Sample PDFs**: a few small PDFs generated at seed time, such as a cheat sheet per course, to exercise the file flow.
- **Assignments**: 1–2 per course in the first modules, with mixed submission types and late policies.
- **Demo students**: 3, with varied progress and submissions (one reviewed, one resubmit-requested, one overdue) so the dashboards show realistic data.

The seed content is written in Phase 2 (course, module and lesson structure plus notes) and Phase 3 (code, PDF and link materials), then extended in Phase 4 (assignments) and Phase 5 (demo progress).

## 10. Phases and acceptance criteria

Each phase ends with passing tests, an updated README, a phase report in `docs/phase-reports/phase-N.md`, and a stop for the trainer's review.

| Phase                        | Scope                                                                                                                                                                                                                                                                        | Accepted when                                                                                                                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** Plan                   | This document                                                                                                                                                                                                                                                                | The trainer approves this plan and answers the decisions in §11                                                                                                                                                                                          |
| **1** Foundation & auth      | Workspaces, lint/format, env validation, DB connection, error handling and response envelope, security middleware, User model, auth endpoints, refresh flow, admin seed; client shell with Tailwind, router, AuthContext, login/register/profile pages, role-guarded layouts | API tests cover register/login/refresh/logout/me, duplicate email, weak password, role injection ignored, rate limit, and protected route without/with a wrong-role token. The UI can register, log in, refresh the page and stay logged in, and log out |
| **2** Courses & roadmap      | Course/Module/Lesson models and CRUD, status changes, reorder, roadmap endpoint, enrollment, seed structure + notes for 3 courses; admin course builder (tree editor, drag/keyboard reorder, publish toggles, confirm dialogs); student catalog + roadmap timeline           | Students can't see draft or archived content (404). Reorder persists. Archive is used instead of delete when data exists. Seeding twice creates no duplicates                                                                                            |
| **3** Study materials        | Material + FileAsset models, storage provider (local first), upload pipeline, file streaming with access checks; Markdown editor with preview, code block editor; lesson reader with ordered blocks, syntax highlighting, PDF inline viewer/download, prev/next navigation   | Spoofed file types are rejected. Unenrolled students and anonymous users get 404 on files. Markdown with `<script>` renders inert                                                                                                                        |
| **4** Assignments            | Assignment + Submission models, link validation, PDF/code submissions, editing/attempt rules, late policy; admin assignment editor; student assignment page and submit form with history                                                                                     | A student can't read or edit another student's submission. Editing is blocked after review or after the window closes. Late flags and penalties are computed correctly. Disallowed submission types are rejected                                         |
| **5** Student portal         | Lesson completion, progress aggregation, continue-learning, my-assignments with derived statuses, student dashboard                                                                                                                                                          | Progress % is correct when lessons are added or unpublished. Overdue is computed correctly around time zones (dates stored in UTC, shown in the browser's local time)                                                                                    |
| **6** Review & analytics     | Review queue, grading, feedback, resubmission requests; student list/detail; trainer dashboard; course & student reports                                                                                                                                                     | Only admins can grade. Marks are capped at `maxMarks`. A resubmission request unlocks a new attempt. Report numbers match the seed fixtures                                                                                                              |
| **7** Notifications & polish | Notification model, triggers, bell + list, deadline-soon job (on-request check or a daily `node-cron` task); permission audit; accessibility pass (labels, focus, contrast, keyboard); responsive review; skeletons, empty states and error states everywhere; index review  | Notifications fire for every event in §5. The permission-audit test suite (every endpoint × role) passes. No obvious accessibility issues on key pages                                                                                                   |
| **8** Testing & deployment   | Playwright E2E for the critical flows, bug fixes, production build, S3 storage driver verified, env docs, deployment guide                                                                                                                                                   | The E2E suite passes against a production build. The README has full setup and deployment instructions                                                                                                                                                   |

## 11. Decisions (confirmed 2026-10-14)

| #   | Decision              | Confirmed choice                                                                                                              |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| D1  | Language              | JavaScript (ES modules) on both client and server                                                                             |
| D2  | Notes format          | Markdown, edited with a live-preview editor                                                                                   |
| D3  | File storage          | Local disk in development; S3-compatible storage (Cloudflare R2) in production, behind one `StorageProvider` interface        |
| D4  | Session handling      | Short-lived access token (15 min) held in memory; rotating refresh token (7 days) in an httpOnly cookie                       |
| D5  | Enrollment            | Students request enrollment and the trainer approves; the trainer can also enroll students directly                           |
| D6  | Notification delivery | Client polls every 60 s                                                                                                       |
| D7  | Deployment            | Vercel (client) + Render (server) + MongoDB Atlas + Cloudflare R2                                                             |
| D8  | Git                   | Repository initialized; one commit after each completed **and reviewed** phase. Remote: `https://github.com/Dayapal/LMS-.git` |
| D9  | Admin accounts        | One trainer account, created by the seed script. The `role` field allows more admins later; no multi-tenant structure         |

### 11a. Authentication across the deployment domains (D4 + D7)

**The problem.** The client on `*.vercel.app` and the API on `*.onrender.com` would be different _sites_. Both domains are on the Public Suffix List, so even two subdomains of `vercel.app` count as separate sites. If the browser called the Render API directly, the refresh cookie would be a third-party cookie and would need `SameSite=None; Secure`. Safari (ITP) blocks those by default and Firefox partitions them, so silent refresh would fail for part of the audience.

**The design.** The browser only ever talks to the Vercel origin.

```
Browser ──https://<app>.vercel.app/api/v1/*──▶ Vercel rewrite (proxy) ──▶ https://<api>.onrender.com/api/v1/*
```

- `client/vercel.json` rewrites `/api/:path*` to the Render URL. In development, the Vite dev-server proxy does the same thing, so dev and prod use the same cookie model.
- The API client always uses the relative base URL `/api/v1`. No API host is built into the client bundle.

**Refresh cookie.**

- Name `lms_rt`, `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/api/v1/auth`.
- No `Domain` attribute, so it's a host-only cookie for the Vercel origin.
- It's only ever sent to the auth endpoints, never to the rest of the API.

**Access token.** A JWT signed with HS256, valid for 15 min, with payload `{ sub, role, tv }`. It's held in a JS module variable, never in `localStorage`, and sent as `Authorization: Bearer`. On every request the server loads the user and rejects the token if the user is inactive or `tv` doesn't match `user.tokenVersion`. That means role changes, password changes and deactivation take effect immediately.

**Rotation.**

- Refresh tokens are 256-bit random values. Only their SHA-256 hash is stored, in a `Session` collection with `family`, `expiresAt` (TTL index), `revokedAt` and `replacedAt`.
- Every `POST /auth/refresh` revokes the presented token and issues a new one in the same family.
- **Reuse detection:** if a token that was already rotated is presented again more than 10 s after rotation, the whole family is revoked. That logs out that device and anyone holding a stolen copy.
- **Grace window:** within those 10 s, a reused token gets a fresh token in the same family. This covers harmless races, such as two tabs refreshing at once.
- The client also runs at most one refresh at a time per tab.

**Logout.** `POST /auth/logout` revokes the session family and clears the cookie, even if the access token has already expired. Changing the password bumps `tokenVersion`, which revokes every session and access token for that user, then signs in only the current device again.

**CORS and CSRF.**

- In production the browser sees only same-origin requests, so CORS isn't involved.
- The server still uses `cors({ origin: CLIENT_ORIGINS allowlist, credentials: true })` for direct calls and local tools.
- The cookie-using endpoints (`/auth/refresh`, `/auth/logout`) also reject any request whose `Origin` header isn't in `CLIENT_ORIGINS`. Together with `SameSite=Lax`, which stops cross-site POSTs from carrying the cookie, this covers CSRF.
- All other endpoints authenticate with the bearer header only, which browsers never attach on their own.

**Proxies and rate limits.** Requests reach Express through Vercel's edge and then Render's load balancer. `TRUST_PROXY` (the number of proxy hops) is configurable so that `req.ip` (used by the rate limiter) is the real client IP. _To verify in Phase 8:_ the correct hop count against the live deployment.

**Cross-site fallback.** If the API is ever called cross-site, set `COOKIE_SAMESITE=none` and add the client origin to `CLIENT_ORIGINS`. No code changes are needed, but Safari users will lose silent refresh, as described above.

## 12. Risks

1. **Seed content volume.** About 38 modules × 2–4 lessons means roughly 100 lessons of real notes and code. _Mitigation:_ concise notes per lesson, written in Phases 2–3. The trainer can expand them in the UI later.
2. **Cross-site cookies in production.** Resolved by design: the Vercel `/api` rewrite keeps the refresh cookie first-party (§11a). The remaining check, the proxy hop count for `TRUST_PROXY`, happens in Phase 8.
3. **Ephemeral disk on PaaS hosts.** Local uploads are lost on redeploy. _Mitigation:_ the S3-compatible driver is required in production, and production fails fast at startup if `STORAGE_DRIVER=local`.
4. **Native `bcrypt` on Windows.** It installs from prebuilt binaries for Node 22. _Mitigation:_ if a build ever fails, fall back to `bcryptjs`, which has the same API.
5. **Express 5 ecosystem.** Some middleware (for example `express-mongo-sanitize`) isn't compatible. _Mitigation:_ use Mongoose `sanitizeFilter` and strict zod schemas instead.
6. **Permission regressions** as features are added. _Mitigation:_ the access service is the single source of truth, and Phase 7 adds an endpoint × role audit suite.
7. **Deadlines and time zones.** _Mitigation:_ store dates in UTC, compute "overdue" on the server, and show deadlines in the browser's local time with the time zone visible.
8. **Scope creep.** Video, payments, live classes, quizzes and certificates are explicitly out of scope.
