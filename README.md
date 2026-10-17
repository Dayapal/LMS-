# Training LMS

A learning management system for a full-stack trainer and their students. It covers courses and roadmaps, study materials, assignments, submissions and progress tracking. Built with MongoDB, Express, React and Node.

The design and the phase plan are in [docs/superpowers/specs/2026-10-14-training-lms-design.md](docs/superpowers/specs/2026-10-14-training-lms-design.md).

## Status

| Phase | Scope                                           | Status                                                |
| ----- | ----------------------------------------------- | ----------------------------------------------------- |
| 0     | Planning                                        | ✅ Approved                                           |
| 1     | Foundation and authentication                   | ✅ Approved ([report](docs/phase-reports/phase-1.md)) |
| 2     | Courses and roadmaps                            | ✅ Approved ([report](docs/phase-reports/phase-2.md)) |
| 3     | Study materials                                 | ✅ Approved ([report](docs/phase-reports/phase-3.md)) |
| 4     | Assignments and submissions                     | ✅ Approved ([report](docs/phase-reports/phase-4.md)) |
| 5     | Student progress and learning tracking          | ✅ Approved ([report](docs/phase-reports/phase-5.md)) |
| 6–8   | Review and analytics, notifications, deployment | ⏳ Not started                                        |

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

Every other variable has a working default; [server/.env.example](server/.env.example) documents each one. Uploaded files go to `server/uploads/` (git-ignored) unless you set `UPLOAD_DIR`. Set `SEED_DEMO_STUDENT_PASSWORD` if you also want three demo students (`aarav.demo`, `neha.demo` and `kabir.demo` `@example.com`) with sample enrollments, lesson progress and submissions (one reviewed, one with a resubmission request).

Students create their own accounts at `/register`. There is no public sign-up for trainers: the trainer account comes only from the seed.

## Scripts (run from the repository root)

| Command                                   | What it does                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                             | Starts the API (with `node --watch`) and the Vite dev server together                                                                                                                  |
| `npm test`                                | Runs the server tests, then the client tests                                                                                                                                           |
| `npm run lint`                            | Runs ESLint across both workspaces                                                                                                                                                     |
| `npm run format` / `npm run format:check` | Runs Prettier (write / check)                                                                                                                                                          |
| `npm run build`                           | Builds the client for production into `client/dist`                                                                                                                                    |
| `npm run seed`                            | Creates the trainer account, the 3 starter courses with their study materials and assignments, and (optionally) demo students with sample progress. Existing records are never changed |
| `npm run seed -- --reset`                 | Development only: deletes all courses, materials, assignments, submissions, uploaded files, enrollments, progress and demo students, then seeds again                                  |

To run a single test file: `npm test -w server -- tests/auth.test.js` or `npm test -w client -- src/routes/guards.test.jsx`. Add `-t "name"` to filter by test name.

The server tests need the local MongoDB. Each test file creates and then drops its own `lms_test_*` database. Point them elsewhere with `TEST_MONGODB_URI`.

## How sign-in works

- The client always calls the API as `/api/v1/...` on its own origin. In development the Vite proxy forwards these calls; in production a Vercel rewrite does. Because of this, the refresh cookie is never a third-party cookie.
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
- Students only ever see their own progress and submissions. The trainer's view of student progress arrives with the reports in Phase 6.

## Project layout

```
client/   React 19 + Vite 8 + Tailwind CSS 4 single-page app
server/   Express 5 + Mongoose 8 REST API (/api/v1)
docs/     Design spec and per-phase reports
```
