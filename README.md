# Training LMS

A learning management system for a full-stack trainer and their students. It covers courses and roadmaps, study materials, assignments, submissions and progress tracking. Built with MongoDB, Express, React and Node.

The design and the phase plan are in [docs/superpowers/specs/2026-10-14-training-lms-design.md](docs/superpowers/specs/2026-10-14-training-lms-design.md).

## Status

| Phase | Scope                                       | Status                                                                                    |
| ----- | ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0     | Planning                                    | ✅ Approved                                                                               |
| 1     | Foundation and authentication               | ✅ Approved ([report](docs/phase-reports/phase-1.md))                                     |
| 2     | Courses and roadmaps                        | ✅ Approved ([report](docs/phase-reports/phase-2.md))                                     |
| 3     | Study materials                             | ✅ Approved ([report](docs/phase-reports/phase-3.md))                                     |
| 4     | Assignments and submissions                 | ✅ Approved ([report](docs/phase-reports/phase-4.md))                                     |
| 5     | Student progress and learning tracking      | ✅ Approved ([report](docs/phase-reports/phase-5.md))                                     |
| 6     | Review queue, student management, analytics | ✅ Approved ([report](docs/phase-reports/phase-6.md))                                     |
| 7     | Notifications, performance, accessibility   | ✅ Approved ([report](docs/phase-reports/phase-7.md))                                     |
| 8     | Production readiness, deployment, E2E tests | ✅ Approved locally; production release pending ([report](docs/phase-reports/phase-8.md)) |

## Requirements

- Node.js 22.12 or newer (npm 10)
- MongoDB 7 or newer, running locally on `mongodb://127.0.0.1:27017`, or a MongoDB Atlas connection string

## Setup

```bash
npm install                                  # installs root, server and client workspaces
cp server/.env.example server/.env           # then fill in the values below
npm run seed                                 # trainer account + 3 starter courses (safe to run again)
npm run dev                                  # API on :5000, client on :5173
```

Open http://localhost:5173.

The values you must set in `server/.env`:

| Variable                                  | Purpose                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                             | MongoDB connection string                                                                                                 |
| `JWT_ACCESS_SECRET`                       | 32+ random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The trainer login created by `npm run seed`. The password needs 8+ characters with a letter and a number                  |

Every other variable has a working default; [server/.env.example](server/.env.example) documents each one. In development uploaded files go to `server/uploads/` (git-ignored) unless you set `UPLOAD_DIR`; production stores them in a private Cloudflare R2 bucket (see [Deployment](#deployment)). Set `SEED_DEMO_STUDENT_PASSWORD` if you also want three demo students (`aarav.demo`, `neha.demo` and `kabir.demo` `@example.com`) with sample enrollments, lesson progress and submissions (one reviewed, one with a resubmission request).

Students create their own accounts at `/register`. There is no public sign-up for trainers: the trainer account comes only from the seed.

## Scripts (run from the repository root)

| Command                                      | What it does                                                                                                                                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                | Starts the API (with `node --watch`) and the Vite dev server together                                                                                                                                  |
| `npm test`                                   | Runs the server tests, then the client tests                                                                                                                                                           |
| `npm run lint`                               | Runs ESLint across both workspaces                                                                                                                                                                     |
| `npm run format` / `npm run format:check`    | Runs Prettier (write / check)                                                                                                                                                                          |
| `npm run build`                              | Builds the client for production into `client/dist`                                                                                                                                                    |
| `npm run seed`                               | Creates the trainer account, the 3 starter courses with their study materials and assignments, and (optionally) demo students with sample progress. Existing records are never changed                 |
| `npm run seed -- --reset`                    | Development only: deletes all courses, materials, assignments, submissions, uploaded files, enrollments, progress and demo students, then seeds again                                                  |
| `npm run test:e2e`                           | Playwright end-to-end tests against a production build in Chromium, Firefox and WebKit, with a throwaway `lms_e2e` database (see [e2e/README.md](e2e/README.md)). First run `npm run test:e2e:install` |
| `npm run files -- check`                     | Writes, reads and deletes one temporary object in the configured storage                                                                                                                               |
| `npm run files -- cleanup [--apply]`         | Reports (with `--apply`, removes) uploads that were never attached and stored bytes without a record, older than 24 hours                                                                              |
| `npm run files -- migrate --to=s3 [--apply]` | Copies files to another storage provider, verifying each one, and points their records at it. Never deletes the source                                                                                 |

To run a single test file: `npm test -w server -- tests/auth.test.js` or `npm test -w client -- src/routes/guards.test.jsx`. Add `-t "name"` to filter by test name.

The server tests need the local MongoDB. Each test file creates and then drops its own `lms_test_*` database. Point them elsewhere with `TEST_MONGODB_URI`.

## How sign-in works

- The client always calls the API as `/api/v1/...` on its own origin. In development the Vite proxy forwards these calls; in production the Vercel `/api` route does. Because of this, the refresh cookie is never a third-party cookie.
- **Access token:** a 15-minute JWT, held in memory only.
- **Refresh token:** a 7-day `httpOnly` cookie, limited to `/api/v1/auth`. It's rotated on every use, and reusing an old token revokes that login.
- **Logout:** revokes the session on the server. Other open tabs are signed out through a `BroadcastChannel` message.

The full design is in §11a of the spec.

## Study materials and files

- Each lesson holds an ordered list of materials: Markdown notes, code examples, files (PDF, DOCX, PPTX up to 20 MB) and links. Each has its own draft/published status.
- Students see a lesson's published materials only when the lesson, its module and its course are published and their enrollment is active.
- Uploads are trainer-only. The file's extension, its declared type and its actual content (magic bytes) must all agree; the stored name is a random key.
- Files are never public. `GET /api/v1/files/:id` checks access on every request, and the app fetches files with the signed-in user's token.
- The starter notes and code live in `server/src/seeds/content/`, one Markdown file per course. `npm run seed` adds them to starter lessons that have no materials yet, so it is safe to rerun.

## Assignments and submissions

- The trainer creates assignments from a course's **Assignments** tab: for the whole course, a module or a lesson, with Markdown instructions, a due date, maximum marks, an attempt limit, the accepted submission types and an optional late policy (a cutoff date and a penalty). Handouts are PDF, DOCX or PPTX files.
- Students see published assignments of the courses they're enrolled in, on the course page and under the lesson they belong to. Dates are shown in the browser's time zone.
- Students hand in any mix of a GitHub repository link, a deployed project link, a Google Drive link, a PDF (up to 10 MB) and a code snippet (up to 100 KB, stored as text and never run). Links must be `https://`; project links can't point at localhost or private addresses.
- A submission can be edited until the trainer reviews it and, for a first attempt, until the window closes. Work after the due date is marked late and loses the late penalty when graded.
- The trainer reviews each student's latest attempt: marks (capped at the maximum), Markdown feedback, or a request for a new attempt. Every attempt is kept as history.
- A student's submissions and PDFs are visible only to that student and the trainer.
- Archiving an assignment closes it. Students who submitted can still read their attempts, marks and feedback; nobody can hand in new work.

## Progress and the student dashboard

- Students mark each lesson complete (or not complete) at the bottom of the lesson reader. Course progress is the share of the course's **currently published** lessons they have completed, worked out by the server every time. It is never stored, so adding a lesson lowers it and unpublishing one takes that lesson out of both numbers.
- Completions are kept when content is unpublished or archived, or an enrollment is removed, and count again when it returns. A lesson, module or course with completions can't be deleted; archive it instead.
- The course page shows the progress bar, a check mark per completed lesson, "x of y done" per module, and a Start / Continue / Up next button.
- The student dashboard (`/app`) shows their courses with progress, where to continue, assignments they can hand in now, recent feedback and pending enrollment requests.
- **Assignments** (`/app/assignments`) lists every assignment across their courses, with filters for Not submitted, Overdue, Resubmission requested, Submitted and Reviewed. States are worked out on the server from UTC dates; times are shown in the browser's time zone.
- Students only ever see their own progress and submissions. The trainer sees everyone's on the pages below.

## The trainer workspace

- **Dashboard** (`/admin`): students and enrollments, work waiting for review, overdue work, enrollment requests to approve, each course's average progress, assignments due this week or overdue, and recent student activity. Every figure comes from the server.
- **Reviews** (`/admin/reviews`): each student's latest attempt at every assignment, across all courses. Tabs for To review (the longest-waiting first), Resubmissions, Waiting for student, Reviewed and All, with counts; filters for course, assignment and late work, and a search on student or assignment. **Review** opens the same review page as before (marks capped at the maximum, feedback, resubmission requests) with a link back to the queue and its filters.
- **Students** (`/admin/students`): search by name or email; filter by course, enrollment (enrolled, pending, removed, not enrolled) and learning state (work to review, overdue work, not started, in progress, completed). A student's page shows their courses with progress per module, their assignments and submissions with marks, and their recent activity. You can approve or decline requests, remove, re-enroll, or enroll them in another course there.
- **Reports** (`/admin/reports`): one row per course with enrollments, average progress, completions, review counts and overdue work, with totals. A course's report adds the progress distribution, completion per module, statistics per assignment, and its students sorted by name, progress or recent study.
- Removing a student from a course or archiving a course never deletes their progress, submissions or activity; the trainer pages keep showing them.
- Progress counts the lessons students can see (published lessons in published modules) and rounds down. "Overdue" means past the due date with nothing handed in, by a student actively enrolled. Review counts use each student's latest attempt.
- Student activity (sign-ups, sign-ins, enrollment changes, completed lessons, submissions and reviews) is kept for a year. It records ids only: no passwords, tokens, addresses or submitted work.

## Notifications

- The bell (top of the sidebar, or the top bar on phones) shows how many notifications are unread; it opens the latest six, and **View all notifications** opens the full list (`/app/notifications` or `/admin/notifications`) with an Unread filter. Opening a notification marks it read and goes to what it is about.
- **Students** are told when a study material or assignment is published in a course they are enrolled in (only once it is visible to them), when the trainer reviews their work or asks for another attempt, and when an assignment they haven't handed in is due within 24 hours.
- **The trainer** is told when a student hands in an attempt, with a link to its review page.
- Each event notifies a person once; a changed review updates the existing notification. Read notifications are deleted after 90 days.
- The app asks the server for the unread count once a minute while the tab is visible (no WebSockets). "Due soon" reminders are worked out at most every 5 minutes per student, so one can appear a few minutes after an assignment comes within 24 hours of its deadline, and only while the student uses the app (no email). Everyone only ever sees and changes their own notifications.

## Performance and accessibility

- Every page is loaded on first use. The JavaScript loaded at startup is the app shell only (435 kB, 140 kB gzip, down from 617 kB / 192 kB); forms, Markdown, code highlighting and the code editor arrive with the pages that use them, and each code editor language loads when it is first needed.
- A page that can't load (offline, or a new release) shows a message with **Reload** instead of a blank screen.
- Keyboard: a skip link, focus moves to the new page after navigation, dialogs and the mobile menu keep focus inside and return it, the course builder's tabs use the arrow keys. Each page names the browser tab.
- Messages (toasts) appear at the top of the screen, pause while the pointer or focus is on them, and never cover the lesson's **Next lesson** link: marking a lesson complete reports the result inside the lesson's completion panel.
- Animations stop when the system asks for reduced motion. Every page works at 390 px wide without sideways scrolling.
- An automated axe scan (WCAG 2.2 A and AA) of 27 pages and a form dialog runs in the end-to-end suite in Chromium, Firefox and WebKit, with phone layouts checked in Pixel 7 and iPhone 14 emulation. Screen reader and real-device checks are manual; see the Phase 8 report.

## Deployment

Production runs on Vercel (client), Render (API), MongoDB Atlas and a private Cloudflare R2 bucket. The step-by-step guide, with environment variables, the `TRUST_PROXY` measurement, smoke tests, rollback and data migration, is [docs/deployment.md](docs/deployment.md). In short:

- **Render:** the Blueprint in [render.yaml](render.yaml). `NODE_ENV=production` refuses to start without `TRUST_PROXY` or `ORIGIN_SECRET`, with local disk storage, with an `http` browser origin or with insecure cookies, and names the problem without printing any secret.
- **Vercel:** root directory `client`; put the Render URL into [client/vercel.json](client/vercel.json) and set the `ORIGIN_SECRET` project variable (a Vercel build fails while either is missing). The same file sets the security headers (CSP and friends) and turns off CDN caching for `/api`.
- **Only Vercel can reach the API:** Vercel's `/api` route adds a shared secret header at the edge; the API refuses every request without it (except its health check), so calling the Render URL directly gets a 403. The secret never reaches the browser.
- **Files:** stored in R2 under random keys and only ever streamed by the API after its access check. There are no public or pre-signed URLs.
- **Not done by this repository:** no deployment, DNS change or hosted-data change happens without you; see the release checklist in the [Phase 8 report](docs/phase-reports/phase-8.md).

## Project layout

```
client/   React 19 + Vite 8 + Tailwind CSS 4 single-page app
server/   Express 5 + Mongoose 8 REST API (/api/v1)
e2e/      Playwright end-to-end tests (production build, three browser engines)
docs/     Design spec, deployment guide and per-phase reports
```
