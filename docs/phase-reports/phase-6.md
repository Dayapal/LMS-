# Phase 6 report: review queue, student management and analytics

Date: 2026-10-17 · Status: **approved** (2026-10-17, with the verification results and the known issues below accepted)

Final results: 424 server tests and 151 client tests passed; lint and formatting clean; production build successful; `npm audit` 0 vulnerabilities; 25 of 25 live API checks and a browser walkthrough (desktop and 390 px) passed. See "Tests executed" for the exact runs.

## Summary

The trainer now has a workspace across all courses and students:

- **Dashboard** (`/admin`): headline figures, the work waiting longest for review, enrollment requests with Approve and Decline, each course's class progress, assignments due this week and recently overdue, and recent student activity.
- **Review queue** (`/admin/reviews`): every student's latest attempt at every assignment, across courses, with tabs and counts per review state, filters, search and pagination. **Review** opens the existing Phase 4 review page, which now links back to the queue with its filters.
- **Students** (`/admin/students` and `/admin/students/:id`): search and filters by enrollment and learning state. A student's page has their courses (with enrollment actions), progress per module, assignments, submissions with marks, and activity.
- **Reports** (`/admin/reports` and `/admin/reports/courses/:id`): course-wise enrollment, progress and review statistics with totals; per course, the progress distribution, completion per module, per-assignment statistics and a sortable student list.
- **Activity log:** the `Activity` model from spec §5, recording learning events (ids only).

Everything is computed on the server from the same rules the students' own pages use, and every new endpoint is trainer-only. Phase 1–5 behaviour is unchanged. The one intended test change is noted below.

## How this matches the approved plan

There is no separate `docs/implementation-roadmap.md` in the repository. The approved roadmap is spec §7 (API plan) and §10 (phases and acceptance criteria), and both are updated.

Spec §7 lists the Phase 6 endpoints, and §10 the scope "Review queue, grading, feedback, resubmission requests; student list/detail; trainer dashboard; course & student reports". Grading, feedback and resubmission requests were brought forward into Phase 4 (Phase 4 decision 1), so this phase reuses them unchanged.

| §10 acceptance criterion                     | Where it is shown                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Only admins can grade                        | Phase 4 endpoints unchanged; re-tested from the queue (`review-queue.test.js`: a student gets 403)                                                            |
| Marks are capped at `maxMarks`               | Re-tested through the queue workflow (101 of 100 → 400, queue unchanged), and in the browser (120 → "At most 100 marks")                                      |
| A resubmission request unlocks a new attempt | `review-queue.test.js`: request → "Waiting for student"; the student's new attempt appears as a resubmission to review                                        |
| Report numbers match the seed fixtures       | `reports.test.js` "match the seed fixtures": MERN 38 lessons, Aarav 8 (21%) and Neha 3 (7%), average 14%, 1 reviewed (86), 1 resubmission request, 2 requests |

Your list for this phase is covered as follows:

| Your item                                                      | Where                                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| A. Cross-course review queue                                   | `GET /admin/submissions`, `ReviewQueuePage`; grading reuses the Phase 4 page and endpoints                         |
| B. Student management                                          | `GET /admin/students`, `GET /admin/students/:id`, `StudentsPage`, `StudentDetailPage`                              |
| C. Trainer dashboard                                           | `GET /dashboard/admin`, `TrainerDashboardPage`                                                                     |
| D. Reports and analytics                                       | `GET /reports/courses`, `GET /reports/courses/:id`, `GET /reports/students/:id`, `ReportsPage`, `CourseReportPage` |
| D. Activity model                                              | `models/Activity.js`, `services/activity.service.js`, recorded by the existing services                            |
| E. UI/UX (responsive, states, accessibility, no chart library) | Existing components; loading, error, empty and success states everywhere; CSS bars and progress bars               |

**No duplicated systems:**

- **Per-assignment submission list:** it and the queue now share one aggregation (`latestAttemptStages` in `services/submissionQueries.js`), as does the assignment `stats` count.
- **Grading:** the queue links to the existing review page; no new grading code.
- **Enrollment management:** the student page and the dashboard call the existing `PATCH /admin/enrollments/:id` and `POST /admin/enrollments`. The course's Students tab is unchanged.
- **Students' assignment states:** the student page and report call the student's own `myAssignmentRows`, so the trainer sees exactly what the student sees.
- **Visibility:** "what every enrolled student sees" moved into one function in `access.service.js` (`assignmentsOpenToEnrolledStudents`), which `assignmentsVisibleTo` now also uses.

## Decisions made in this phase

1. **The queue shows each student's latest attempt per assignment.** Earlier attempts are history, as in Phase 4, and stay reachable from the review page's attempt list.
2. **Review states:** `submitted` (to review), `resubmitted` (an attempt 2+ waiting for review, a subset of `submitted`), `resubmit_requested` (waiting for the student) and `reviewed`. The default tab is "To review"; `meta.counts` gives every state under the other filters, so tab numbers stay right.
3. **Queue order:** waiting work first, the longest-waiting first; then sent-back work and reviewed work, most recent first. "Newest" and "Oldest" are also offered.
4. **Two kinds of count, clearly separated:**
   - **Review counts** (to review, sent back, reviewed) use every student's latest attempt, even after their enrollment is removed. You can still review that work, and the queue marks it "Removed".
   - **Expected / handed in / pending / overdue** use students with an **active** enrollment and the assignments they see: published, in a published course, module and lesson. "Overdue" is the same rule as the student's own page: strictly past the due date with nothing handed in, even while late work is still accepted. The tests check the dashboard total against the sum of every student's own overdue count.
5. **Progress** is the Phase 5 rule (published lessons in published modules, rounded down). A course's average is the mean of its active students' own percentages, rounded down; it's "—" with no students. Removed students keep their progress on their own page and in the course report's Removed tab, but aren't in the course average.
6. **History is never lost:**
   - Removing an enrollment or archiving a course hides it from the student (as before).
   - Your student page and reports keep showing it with a "Removed" or "Course archived" badge, the progress and the submissions.
   - Re-enrolling brings the same numbers back.
7. **`Activity` as built** (spec §5 updated):
   - Typed references (`lesson`, `assignment`, `submission`, `attempt`) instead of one `ref`, plus `actor` for the trainer.
   - Events: sign-up, student sign-in, enrollment requested / enrolled / removed, lesson completed (once), submission handed in, reviewed, resubmission requested.
   - Ids only; a failed write never fails the request. TTL of one year.
   - Trainer sign-ins and edits aren't logged. The dashboard feed leaves out sign-ins, but they count towards "active this week".
8. **`GET /reports/courses` was added** (not in §7) for the reports index. The dashboard's course rows come from the same function, so the numbers are identical (tested). Its `meta.totals` add up the courses on the page (labelled "courses shown"). Enrollments are counted per course, so a student in two courses counts twice (the page says so).
9. **`GET /admin/students/:id` and `GET /reports/students/:id` are separate:**
   - the first is the management view (profile, every enrollment with its id for actions, summary)
   - the second is the learning report (module breakdown, current assignments, submission history, marks average, activity)

   The student page loads both.

10. **Student filters** (`learning`): `to_review`, `overdue`, `not_started` (an active course with lessons and none completed), `in_progress`, `completed` (finished at least one active course). With `course`, they apply to that course. `enrollment=none` means no enrollment record at all (with `course`: none in that course).
11. **Charts without a library:**
    - one-hue horizontal bars for the progress distribution, with values as text
    - the existing labelled `ProgressBar` for courses and modules
    - stat tiles for headline numbers

    Tables scroll inside their card on small screens.

12. **Page numbers are capped at 10,000** on the new list endpoints. Beyond that, MongoDB's `skip` fails and would have been a 500 instead of a 400. The older lists still allow larger values (see known issues).
13. **The trainer pages are one lazily loaded chunk** (`features/trainer/pages.js`, 46 kB, 10 kB gzip), including the new dashboard. The JS loaded at startup is unchanged (616 kB, 192 kB gzip).

## Database changes

| Model            | Change                                                                        | Indexes                                                                  |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `Activity` (new) | user, actor, type, course, lesson, assignment, submission, attempt, createdAt | TTL `{createdAt}` (365 days), `{user, createdAt}`, `{course, createdAt}` |
| `User`           | —                                                                             | `{role, name}`, `{role, createdAt}`                                      |
| `Enrollment`     | —                                                                             | `{status, updatedAt}`                                                    |
| `Assignment`     | —                                                                             | `{status, dueAt}`                                                        |
| constants        | `ACTIVITY_TYPES`                                                              | —                                                                        |

No migration is needed. Existing databases simply start with an empty activity log; the next `npm run seed` doesn't add activity for demo students who already exist (see known issues).

**Index check:** a live `explain` on a seeded throwaway database showed index scans for:

- the student list by name (`role_1_name_1`) and newest first (`role_1_createdAt_-1`)
- pending requests (`status_1_updatedAt_-1`)
- past-due assignments (`status_1_dueAt_1`)
- a student's activity (`user_1_createdAt_-1`) and the activity feed (`createdAt_1`)
- the queue's latest-attempt sort (`assignment_1_student_1_attempt_1`)

## API changes (`/api/v1`, bearer token, trainer only; students get 403, anonymous 401)

| Method | Path                    | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/submissions`    | Latest attempt per student per assignment. `status` (`submitted`, `resubmitted`, `resubmit_requested`, `reviewed`), `course`, `assignment`, `student`, `late` (`true`/`false`), `q` (student name/email or assignment title, matched literally), `sort` (`priority`, `newest`, `oldest`), `page` (1–10,000), `limit` (1–100). Rows: student, course, assignment (due, closes, max marks, attempts), attempt, attempts, dates, late, status, marks, `enrollmentStatus`. No work, notes or feedback. `meta.counts` per state |
| GET    | `/admin/students`       | `q`, `course`, `enrollment` (`active`/`pending`/`removed`/`none`), `learning` (see decision 10), `sort` (`name`, `newest`, `recent`), `page`, `limit`. Rows: profile, enrollment tally, courses with status and progress, `awaitingReview`, `overdue`                                                                                                                                                                                                                                                                      |
| GET    | `/admin/students/:id`   | `student`, `summary` (active/pending/removed/completed courses, lessons completed, awaiting review, assignment states as the student sees them), `enrollments` (every one, with id, course and course status, progress, awaiting review, overdue). 404 for unknown ids and non-students, 400 for malformed ids                                                                                                                                                                                                             |
| GET    | `/dashboard/admin`      | `summary` (students, enrollments, review counts, overdue), `courses` (draft and published), `reviewQueue` (5), `pendingRequests` (total + 5), `upcoming` (due within 7 days), `overdue` (recently due with students missing), `recentActivity` (10)                                                                                                                                                                                                                                                                        |
| GET    | `/reports/courses`      | `status`, `q`, `page`, `limit` (default 50). Course summary rows; `meta.totals`                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| GET    | `/reports/courses/:id`  | `course` (summary, lessons, modules), `distribution`, `modules` (completion), `assignments` (with statistics), `students` (page). Query: `enrollment` (default `active`), `q`, `sort` (`name`, `progress_desc`, `progress_asc`, `recent`), `page`, `limit`; `meta` paginates the students                                                                                                                                                                                                                                  |
| GET    | `/reports/students/:id` | `courses` (with module breakdown, removed ones included), `assignments` (counts + rows, as the student sees them), `submissions` (latest attempt per assignment, all courses), `marks` (reviewed count, average % of maximum), `activity` (20)                                                                                                                                                                                                                                                                             |

**Changed:** nothing in existing responses. The existing actions now also write activity: register, login, enrollment request and decisions, lesson completion, submission, review and resubmission request.

## Client changes

- **New pages** (`features/trainer/`, one lazy chunk): `TrainerDashboardPage`, `ReviewQueuePage`, `StudentsPage`, `StudentDetailPage`, `ReportsPage`, `CourseReportPage`. Each has a loading skeleton, an error state with retry, empty states (including "no results for these filters"), and success toasts for actions.
- **Filters live in the URL**, so Back and the review page's "← Review queue" link return to the same view.
- **Sidebar:** Reviews, Students and Reports, with new icons.
- **Review page (Phase 4):**
  - when opened from the queue, the dashboard or a student page, a back link to that page (accepted only for `/admin/…` paths), also kept across attempt links
  - the student's email links to their student page
- **Cache:** all trainer queries live under `['trainer']`. Course, enrollment and assignment mutations refresh it, so counts and statuses update after a review or an enrollment decision without a reload (tested; seen in the browser).
- **Shared:** `components/ui/StatTile.jsx` (now also used by the student dashboard, with identical markup). The placeholder trainer page in `DashboardPages.jsx` was removed (only `Welcome` remains).
- **Accessibility:**
  - filter buttons use `aria-pressed` and show their counts
  - selects have visible labels
  - lists and regions are labelled, progress bars are labelled `role="progressbar"`
  - tables have captions and row headers
  - the bars are decorative (`aria-hidden`), with their values as text

## Files

**New (server):**

- `models/Activity.js`
- services: `activity.service.js`, `analytics.service.js`, `review.service.js`, `student.service.js`, `report.service.js`, `submissionQueries.js`
- `controllers/trainer.controller.js`, `routes/report.routes.js`, `validators/admin.validators.js`
- tests: `review-queue.test.js`, `students-admin.test.js`, `trainer-dashboard.test.js`, `reports.test.js`, `activity.test.js`, `trainer-helpers.js`

**Changed (server):**

- models: `constants.js`, `index.js`, `User.js`, `Enrollment.js`, `Assignment.js` (indexes)
- routes: `admin.routes.js`, `me.routes.js`, `index.js`
- services:
  - `access.service.js`: shared visibility helper
  - `assignment.service.js`: shared aggregation
  - `progressRules.js`: `progressPercent`, `isCourseComplete`
  - `dashboard.service.js`: trainer dashboard
  - `course.service.js`: activity removed with a deleted course
  - activity recording in `auth.service.js`, `enrollment.service.js`, `progress.service.js`, `submission.service.js`
- seeds: `course.seed.js`, `progress.seed.js` (demo activity, reset)
- tests: `seed.test.js` (+1), `student-dashboard.test.js`. The latter asserted that `/dashboard/admin` didn't exist yet (404); it now asserts a student gets 403 there.

**New (client):**

- `components/ui/StatTile.jsx`
- `features/trainer/`:
  - `api.js`, `format.js`, `hooks.jsx`, `pages.js`, `test-fixtures.js`, `components/TrainerParts.jsx`
  - pages: `dashboard/`, `reviews/`, `students/`, `reports/`
  - tests: `ReviewQueue.test.jsx`, `Students.test.jsx`, `TrainerPages.test.jsx`

**Changed (client):** `components/Icon.jsx`, `layouts/navigation.js`, `routes/routes.jsx`, `features/dashboard/{DashboardPages,StudentDashboardPage}.jsx`, `features/assignments/{api.js,admin/SubmissionReviewPage.jsx}`, `features/courses/api.js`.

**Docs:** this report, `README.md` (status table, trainer workspace section), and the spec (status, §5 Activity and indexes as built, §6, §7 as built, §9).

## Tests executed (actual results, 2026-10-17)

| Check            | Command                   | Result                                                                                                                                                                                       |
| ---------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server tests     | `npm test -w server`      | **23 files, 424 tests passed** (380 from Phases 1–5 + 44 new; one Phase 5 assertion updated as described above)                                                                              |
| Client tests     | `npm test -w client`      | **18 files, 151 tests passed** (132 + 19 new)                                                                                                                                                |
| Lint             | `npm run lint`            | **0 errors, 0 warnings**                                                                                                                                                                     |
| Formatting       | `npm run format:check`    | **All files pass**                                                                                                                                                                           |
| Production build | `npm run build`           | **Succeeds.** Startup JS 616 kB (192 kB gzip), unchanged from Phase 5. The trainer chunk is 46 kB (10 kB gzip). The over-500 kB warning is still only for the lazily loaded CodeMirror chunk |
| Dependency audit | `npm audit`               | **0 vulnerabilities.** No new dependencies                                                                                                                                                   |
| Security review  | by hand, on the full diff | **No findings** at medium or high severity (details below)                                                                                                                                   |

The test, lint, format, build and audit results above come from the final run after the last code change (the page cap). The live and browser checks below ran before that change, which only adds a validation limit and its test.

**What the new server tests cover:**

- **Review queue (10):**
  - latest attempt per student and assignment, priority order, row fields, no work, notes or feedback in rows
  - every state tab with constant counts
  - filters (course, assignment, student, late) with counts that follow them
  - search on name, email and title, matched literally (`.*` finds nothing)
  - pagination, past the last page, newest/oldest
  - empty database
  - validation: limits, page, bad enums, a bad id, an operator-shaped id, `late=yes`, over-long and repeated `q`, a page past 10,000; brackets never become operators
  - 401/403
  - removed students' and archived assignments' work still listed and reviewable
  - a full workflow through the existing endpoints: marks cap, student 403, review, resubmission request, the new attempt as a resubmission, earlier attempts not reviewable
- **Students (12):**
  - list order and rows (enrollment tally, progress, pending, removed history, review and overdue counts, no password data)
  - search; every enrollment and learning filter, alone and with a course
  - pagination and sorting; an empty list; validation, brackets and the role filter; 401/403
  - detail:
    - profile, every enrollment, summary
    - assignment states equal to each student's own `/me/assignments` counts (4 students)
    - history kept after removal and course archiving, and restored on re-enrolling
    - the existing approve and direct-enroll endpoints reflected in the detail
    - 404 for unknown ids and the trainer, 400 for malformed ids
  - student report: module breakdown (draft lesson excluded), assignment states, submission history including a removed course, marks average, activity
- **Dashboard (8):**
  - summary figures against a known data set
  - equal to the queue's counts and to the sum of every student's own overdue count
  - course rows (averages, completed, not started, assignment and review counts, overdue)
  - queue, requests, upcoming and overdue lists with their statistics (a removed student isn't "expected")
  - an assignment in an unpublished module and an archived course are left out (and the student agrees)
  - activity feed without sign-ins, active-this-week count
  - all zeros on an empty install; 401/403
- **Reports (7):**
  - course list with totals, equal to the dashboard rows; status and title filters; validation
  - course report: distribution, module completion, per-assignment statistics (draft not open, average marks), students
  - sorting, search, pagination, pending and removed tabs
  - a course without lessons or students (0%, never "completed")
  - 404/400/403/401
  - **the seed fixtures** (see the acceptance table)
- **Activity (6):**
  - sign-ups and student-only sign-ins
  - enrollment events with the trainer as actor, and no event when nothing changes
  - lesson completion logged once (not on repeats or un-completing); submissions, reviews and resubmission requests with attempts
  - nothing secret stored (note, feedback, links, password; schema has no other fields)
  - a failing log write doesn't fail the action
  - the TTL and feed indexes exist
  - a deleted course removes its events; students can't read reports
- **Seed (1 new, 1 extended):** demo activity counts and dates, nothing added on reruns, reset clears the log.

**What the new client tests cover:**

- **Queue (5):**
  - rows, badges, links and tab counts; the exact request parameters for tabs, course, assignment, timing and order
  - debounced search; empty and error states with retry
  - opening the Phase 4 review page from the queue: the back link keeps the filters, saving marks the queue stale, and Back returns to it
- **Students (7):**
  - list rows and filters (exact parameters), empty states
  - detail page with removed and archived history, module bars, assignments, submissions and activity
  - approve, re-enroll and remove (with confirmation) through the existing endpoints; enrolling in a course they're not in (archived courses not offered)
  - a refused action; an unknown student
- **Dashboard and reports (7):**
  - figures, links and states from the server
  - approving a request from the dashboard; empty install and error/retry
  - reports table with totals and status filter
  - course report: bars, module bars, assignment table, students, tab and sort parameters, missing course

**Mutation check.** I broke each rule below on purpose, one at a time, ran the related tests, and restored the code (a script did each step). Every break failed at least one test:

| Rule removed                                     | Tests that failed |
| ------------------------------------------------ | ----------------- |
| Queue: late filter                               | 1                 |
| Queue: "resubmitted" needs attempt 2+            | 1                 |
| Queue: waiting work first                        | 2                 |
| Queue: search matched literally                  | 2                 |
| Overdue: active enrollments only                 | 3                 |
| Overdue: published modules and lessons only      | 1                 |
| Expected work: active students only              | 1                 |
| Progress rounds down                             | 2                 |
| Class progress: active students only             | 2                 |
| Student list: students only                      | 1                 |
| Student detail: not the trainer                  | 1                 |
| Students: "not enrolled" filter                  | 1                 |
| Reports: trainer only                            | 3                 |
| Queue and students: trainer only                 | 2                 |
| Dashboard: trainer only                          | 2                 |
| Activity: completion logged once                 | 1                 |
| Activity: student sign-ins only                  | 1                 |
| Activity: a failed write doesn't fail the action | 1                 |
| Feed leaves out sign-ins                         | 1                 |
| Client: reviews refresh the trainer views        | 1                 |
| Client: the review page links back to the queue  | 1                 |

**Security review (by hand).** Each new input path was traced against the usual checklist: injection, authorization, data exposure, XSS and secrets. No exploitable issue at medium or high confidence was found:

- **Authorization:** every new route is behind `authenticate` + `requireRole(ADMIN)` (router-level for `/admin` and `/reports`, per route for `/dashboard/admin`), using the role from the database. Students get 403, which is tested for all six endpoints.
- **NoSQL injection:** every query value is zod-validated (ObjectId pattern, enums, numbers, `true`/`false`). `trusted()` wraps only server-made values and the escaped search regex. Aggregation inputs are converted to ObjectIds. `sanitizeFilter` stayed on: my own explain script was refused when it left out `trusted()`.
- **Data exposure:** student rows are built field by field (no password hash, token version or sessions). Activity holds ids only. Queue rows leave out the work, notes and feedback.
- **XSS:** no new HTML rendering; activity sentences, names and titles are React text.
- **Return links:** the review page accepts a return link only from in-app navigation state, and only for `/admin/…` paths.

The `/security-review` skill asks for its analysis in sub-agents. This session doesn't start sub-agents unless you ask, so I did the same checks myself.

**Live check against a running API** (a freshly seeded throwaway database, `lms_phase6_check`; your development database and `server/.env` were not used). The production build was served by `vite preview`, which forwards `/api` like the Vercel rewrite. 25 checks over HTTP, all passed:

- **Seeded figures:**
  - 3 students, 2 enrolled; enrollments 2 active and 2 pending
  - reviews 1 reviewed, 1 sent back
  - MERN average 14%; Aarav 21% and Neha 7% in the report; the in-progress filter gives Aarav and Neha
- **Access:** Aarav got 403 on all six trainer endpoints; anonymous 401; an invalid filter 400.
- **Workflow:**
  - Aarav handed in the landing page; the queue showed 1 to review
  - 51 marks of 50 refused; 45 saved; the queue was empty with 2 reviewed
  - the activity feed's newest entry was the review

**Browser walkthrough** (Playwright, Chromium, the same build and database):

- **Dashboard (1280 px):** the seeded figures, the requests with Approve and Decline, course progress, the activity feed. Before the data arrived, the loading skeleton.
- **Queue:**
  - Neha's resubmission (sent through the API) under "To review 1 · Resubmissions 1"
  - filtered by course, opened it, 120 marks refused ("At most 100 marks"), 92 saved with Markdown feedback
  - "← Review queue" returned to the filtered queue, now "To review 0 · Reviewed 3", without a reload
- **Neha's student page:**
  - 3 of 38 lessons with the module breakdown, the 92/100 submission, her activity
  - **Approve** on the Java request turned it into an enrolled course (0 of 36) in place
  - **Remove** from MERN (with the confirmation) left MERN listed as "Removed" with 3/38 and the 92/100 submission, while her current assignments showed only Java
- **390 px:**
  - all six pages had **0 px** of horizontal overflow, after one fix: the student page and the course report first scrolled sideways (75 and 11 px), because a single-column grid grew with its content. This is the Phase 4 layout issue again; fixed with `grid-cols-1`.
  - I looked at the course report screenshot: the tiles wrap two per row, the bars and labels fit, long module names are truncated, and the assignment table scrolls inside its card
- **Console:** only the expected 401 from the silent refresh on the first anonymous page load.
- **Cleanup:** the servers were stopped, the throwaway databases (`lms_phase6_check`, and `lms_phase6_explain` from the index check) dropped, the upload folder and my screenshots deleted. The older screenshots in `.playwright-mcp/` (git-ignored) were left alone.

## Known issues and remaining work

1. **The activity log starts now.** An existing database has no events from before Phase 6. Re-running the seed doesn't add events for demo students who already exist (only newly created records get them). So "Recent activity" and "active this week" fill up as students use the app. Last sign-in still comes from the user record.
2. **Seeded activity order looks odd.** Demo sign-ups and enrollments are stamped with the seed time, while their completions and submissions carry earlier dates. On a fresh seed, "was enrolled" appears above lessons completed days before.
3. **"Signed in" is the last password sign-in** (`lastLoginAt`). A silent refresh doesn't update it, so a student who stays signed in for days may look less active than they are.
4. **Scale assumptions:**
   - the queue and the review counts group all submissions on each request (no stored "latest" flag)
   - the progress-based student filters read the active enrollments (user and course ids only)
   - the dashboard checks the 25 most recently due assignments for missing work

   All of this is fine for one trainer's classes, but not load-tested.

5. **Older list endpoints accept huge page numbers.** On the Phase 2–5 lists, a page beyond MongoDB's skip limit gives a 500 instead of a 400. The new endpoints cap it at 10,000. Worth applying to the shared `pageQuery` in the Phase 7 audit.
6. **Course report totals add up the page shown** (50 courses per page), as labelled.
7. **"Enroll in another course" and the course filters list the first 100 courses.**
8. **The course's Students tab still enrolls by email** (Phase 2 known issue 5). Enrolling from the student page covers the other direction; a picker on the course tab wasn't added, to avoid a second enrollment UI.
9. **Browser coverage is one engine** (Chromium, desktop and 390 px emulation). Safari, Firefox and a real phone weren't tried.
10. **Carried over:**
    - Phase 5: no seeded overdue demo; toasts cover the bottom-right corner for 3.5 s; courses with completions can only be archived; demo progress comes back after a full un-complete and reseed; the narrow lesson-deletion race; dashboards reflect the moment they were loaded
    - Phase 4: no virus scanning; links not checked for reachability; no per-student extensions; a penalty change doesn't recompute final marks; orphaned handouts
    - Phase 3: PDFs on iOS; local storage only until Phase 8
    - Phase 1: the `TRUST_PROXY` hop count and the Vercel rewrite URL (Phase 8); the expected 401 on anonymous page loads
    - Bundle size: the CodeMirror chunk is still over 500 kB; route-level splitting is planned for Phase 7
    - Tests: the occasional unmocked request in `AdminCourses.test.jsx` and the jsdom "navigation not implemented" message; neither fails a test
11. **Phase 7 not started:** notifications, the endpoint × role permission audit, the accessibility and responsive pass.

## Manual testing instructions

1. Run `npm run seed` (with `SEED_DEMO_STUDENT_PASSWORD` set), then `npm run dev`, and sign in as the trainer.
2. **Dashboard (`/admin`):**
   - the tiles show your students, enrollments, work to review and overdue work
   - on a new seed, MERN shows an average of 14% with 2 students
   - try **Approve** on a request; the tile and the list update at once
3. **Review a submission:**
   - sign in as Aarav, hand in "Responsive Landing Page", then go back to the trainer
   - **Reviews** shows it under "To review"; filter by course, open it
   - try marks above the maximum, then save a review
   - "← Review queue" brings you back to the same filter, with the counts updated
4. **Resubmission:**
   - open the "Waiting for student" tab (Neha's profile page)
   - as Neha, resubmit; as the trainer, it appears under "Resubmissions"
5. **Students:**
   - search "neha"; try the Enrollment and Learning filters (for example "Has overdue work" once a due date passes)
   - open Neha: courses, progress per module, assignments, submissions, activity
   - remove her from a course: it stays listed as "Removed" with her progress and submissions
   - re-enroll her; enroll her in another course
6. **Reports:**
   - the course table and its totals; open MERN
   - the distribution bars, completion per module, assignment statistics
   - the students list (sort by progress; switch to Requests or Removed)
7. **As a student**, open `/admin` or call `/api/v1/admin/students`: you're sent back to your dashboard, and the API answers 403.
8. **Mobile:** at about 390 px, none of the new pages scroll sideways; tables scroll inside their cards.

## Commit

Committed locally on `main` as `feat: Phase 6 review queue, student management and analytics`: the 31 modified files and 33 new files listed above (this report included). Not pushed. The approval only changed documentation (the status lines in this report, `README.md` and the spec), so the checks above were not rerun.

## Recommended next phase

**Phase 7: notifications and polish.** Notifications for the §5 events, the deadline-soon check, the endpoint × role permission audit, the accessibility and responsive pass, route-level splitting, and the page cap on the older lists.
