# Phase 5 report: student progress and learning tracking

Date: 2026-10-17 · Status: **approved** (2026-10-17, with the final verification results and the known issues below accepted)

Final results: 380 server tests and 132 client tests passed; lint and formatting clean; production build successful; `npm audit` 0 vulnerabilities; 34 of 34 browser smoke checks passed. Committed as `feat: Phase 5 student progress and learning tracking`.

## Summary

Students can now track their learning, and see where they stand across their courses.

- **Lesson completion:** "Mark as complete" (and "Mark as not completed") at the bottom of each lesson.
- **Course progress:** worked out by the server from the lessons that are published right now. It is never stored and never taken from the browser.
- **Course page:** a progress bar, a check mark on each completed lesson, "x of y done" per module, and a Start / Continue / Up next button.
- **Student dashboard** (`/app`): courses with progress, where to continue, assignments to hand in, recent feedback and pending enrollment requests.
- **My assignments** (`/app/assignments`): every assignment across the student's courses, filtered by state (Not submitted, Overdue, Resubmission requested, Submitted, Reviewed), with a course filter and pagination.
- **Deletion guards:** lessons, modules and courses with completions can't be deleted; the trainer archives them instead.
- **Seed:** demo progress and demo submissions for the demo students.

Everything is enforced on the server. A student only ever reads or changes their own progress, and only for lessons they may open: published lesson, module and course, plus an active enrollment. Anything else is a 404, and the trainer gets 403 on these student endpoints. Phase 1–4 behaviour is unchanged, and all of their tests still pass.

Not built (Phase 6): the trainer's view of student progress, the review queue across courses, the trainer dashboard and reports.

## How this matches the approved plan

Spec §7 lists four Phase 5 endpoints and §10 lists the scope "Lesson completion, progress aggregation, continue-learning, my-assignments with derived statuses, student dashboard". All of that is built. Your list for this phase is covered as follows:

| Your item                                                 | Where                                                                                                                |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Mark lessons complete / incomplete                        | `POST`/`DELETE /lessons/:id/complete`, the completion panel in the reader                                            |
| Course and roadmap progress from published lessons        | `services/progressRules.js`; `progress` on the roadmap, `/me/courses` and the dashboard                              |
| Dashboard with progress and continue-learning links       | `GET /dashboard/student`, `StudentDashboardPage`                                                                     |
| Assignment states (pending … resubmission requested)      | Reuses the Phase 4 rules (`studentStatus`, `toStudentState`); `GET /me/assignments` adds the state filter and counts |
| Progress and completion states in course and lesson views | Course page and lesson reader                                                                                        |
| Deletion/archive rules for submissions and progress       | `assertNoProgress` in the lesson, module and course delete paths; the Phase 4 submission guards are unchanged        |

No existing feature was duplicated. `GET /assignments` (Phase 4) is unchanged. `GET /me/assignments` reuses its visibility filter and derived states, but returns compact rows (no instructions or handouts), filters by state and counts each state.

## Decisions made in this phase

1. **What counts towards progress:** exactly what the student sees on the roadmap, meaning published lessons inside published modules. It's the same set as the lesson count on the course card. The percentage is rounded **down**, so 2 of 3 is 66% and 100% always means everything is done. A course with no published lessons is 0% and not complete.
2. **Completions are history, never deleted by content changes.** If a lesson is unpublished or archived, or its module is unpublished, the record stays but leaves both numbers. It counts again when the content returns. The same applies to an archived course and a removed enrollment. Adding a lesson lowers the percentage, as the acceptance criterion requires.
3. **Deletion:** a lesson anyone completed, a module containing one, and a course with any completion can't be deleted. That includes completions from students who were later removed. The response is 409 "Archive it instead of deleting, so their progress is kept." The Phase 4 rules (submissions, assignments) are unchanged.
4. **Continue learning is recorded only by explicit requests** (changed in the final review). Reading stays read-only: `GET /lessons/:id` and every other GET change nothing (tested by comparing the whole database before and after).
   - Once a lesson has loaded, the reader sends `POST /lessons/:id/visit` (student only, no body). That runs the same access check as reading the lesson (published lesson, module and course, plus an active enrollment), then sets `lastLesson` and `lastAccessedAt` on that student's active enrollment for that course. The student comes from the token, the course from the lesson and the time from the server.
   - Refused requests (unpublished, not enrolled, pending, removed, unknown or malformed id, trainer) change nothing.
   - Completing or un-completing a lesson also moves the continue point, because those are explicit POST/DELETE requests too.

   The next lesson is:
   - **resume:** that lesson, while it's incomplete
   - **next:** otherwise the first incomplete lesson after it, wrapping round to the start
   - **start:** the first lesson, while nothing is completed

   The trainer's preview is never recorded. The dashboard's "Continue learning" is the most recently studied course that still has a lesson left.

5. **Completing is manual and independent.** It doesn't require handing in the lesson's assignments or opening every material, and a student can undo it, as the permissions matrix allows ("mark/unmark own").
6. **Nothing about progress comes from the browser.** The visit, complete and uncomplete endpoints read no body. The student comes from the token, the course from the lesson, and the date from the server clock. Repeating "complete" keeps the first completion date. Concurrent requests are absorbed by the unique `{user, lesson}` index.
7. **The dashboard's "To do"** lists the assignments the student can hand in **now** (first attempts and requested resubmissions), due date first, at most 5. An overdue assignment whose window has closed isn't actionable, so it is left out of To do but still counted in the "Overdue" tile and the Overdue filter.
8. **"Recent feedback"** lists the latest 5 reviewed or resubmission-requested attempts, newest review first. This needed `reviewedAt` on the student's own `mySubmission.latest` (an added field; nothing removed).
9. **`GET /me/courses` isn't paginated.** A student has only a few enrollments. It returns active enrollments (most recently studied first), then pending requests. Removed enrollments and courses that aren't published are left out, and their progress is kept.
10. **The `Activity` model (spec §5) is not built.** Nothing in Phase 5 reads it: the dashboard uses completion dates and submissions. It belongs with the activity reports in Phase 6. The spec notes this.
11. **No seeded "overdue" demo.** Spec §9 asks for one overdue demo student. That would need a seeded assignment with a past due date, which would be overdue for every student, including real ones. Overdue shows up once a seeded due date passes. Reviewed and resubmission-requested demos are seeded.
12. **Query brackets are never operators.** Express 5 keeps `?status[$ne]=x` as a plain key name, which validation drops, so the list is just unfiltered (tested).

## Database changes

| Model                    | Change                                                                                                                                                  | Indexes                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `LessonProgress` (new)   | user, course (copied from the lesson), lesson, completedAt, timestamps                                                                                  | unique `{user, lesson}`, `{user, course}`, `{lesson}`, `{course}` |
| `Enrollment` (unchanged) | `lastLesson` and `lastAccessedAt` (in the model since Phase 2) are now written by `POST /lessons/:id/visit` and by completing or un-completing a lesson | —                                                                 |
| constants                | `STUDENT_ASSIGNMENT_STATUS` (`pending`, `overdue` + the three submission statuses), now used by `studentStatus` and the `/me/assignments` filter        | —                                                                 |

No migration is needed: there were no progress records before. A live `explain` on a seeded database showed every new query using an index and examining only the documents it returned:

- a student's progress in a course: `user_1_course_1`
- one lesson's completion: `user_1_lesson_1`
- the lesson and course deletion guards: `lesson_1` and `course_1`
- the student's enrollments: `user_1_course_1`

## API changes (`/api/v1`, bearer token required)

| Method | Path                    | Who     | Notes                                                                                                                                                                                                                                                                                      |
| ------ | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/lessons/:id/visit`    | student | 200 `{ lessonId, courseId, visitedAt }`. Records the continue-learning point on the caller's active enrollment; body ignored. Same 404/400 rules as completing, and a refusal changes nothing                                                                                              |
| POST   | `/lessons/:id/complete` | student | 200 `{ lessonId, courseId, completed: true, completedAt, courseProgress }`. Idempotent; keeps the first date; body ignored. 404 unless the lesson, module and course are published and the enrollment is active; 400 for a malformed id                                                    |
| DELETE | `/lessons/:id/complete` | student | 200, same shape with `completed: false`. Idempotent. Same 404 rules                                                                                                                                                                                                                        |
| GET    | `/me/courses`           | student | Active enrollments (most recent activity first), then pending requests, in published courses. Each has `course` (card fields), `enrollment` and `progress` (`null` while pending)                                                                                                          |
| GET    | `/me/assignments`       | student | `status` (`pending`/`overdue`/`submitted`/`reviewed`/`resubmit_requested`), `course`, `page`, `limit` (1–100, default 20). Rows have `course`, `module` and `lesson` titles, dates, `maxMarks` and `mySubmission`. `meta.counts` has `all` plus one count per state, for the course filter |
| GET    | `/dashboard/student`    | student | `summary` (`activeCourses`, `completedCourses`, `pendingRequests`, `lessonsCompleted`, `assignments` counts), `continueLearning`, `courses`, `upcoming` (≤ 5), `recentFeedback` (≤ 5)                                                                                                      |

`progress` is `{ completedLessons, totalLessons, percent, completed, lastCompletedAt, nextLesson: { id, title, moduleId, moduleTitle, kind } | null }`, where `kind` is `start`, `resume` or `next`.

**Changed:**

- `GET /courses/:id/roadmap`: a student with an active enrollment also gets `progress` and `completed` on each lesson. Other students get `progress: null`, and the trainer's response is unchanged.
- `GET /lessons/:id`: a student also gets `completion: { completed, completedAt }`. It stays read-only.
- `DELETE /lessons/:id`, `/modules/:id` and `/courses/:id`: 409 when students have completed lessons there.
- `mySubmission.latest` gains `reviewedAt`.

## Client changes

- **Student dashboard** (`features/dashboard/StudentDashboardPage.jsx`):
  - stat tiles: active courses, lessons completed, overdue (red when > 0), awaiting review
  - a Continue learning card
  - My courses with progress bars and next-lesson links, plus pending requests
  - To do and Recent feedback
  - a loading skeleton, an error state with retry, and empty states: no courses yet, no lessons published, everything completed
- **My assignments** (`features/assignments/student/MyAssignmentsPage.jsx`, in the lazy assignment chunk; new "Assignments" sidebar entry):
  - state filter buttons with counts (`aria-pressed`) and a course filter when there are several courses
  - each row shows its place in the course, due date with time zone, marks, late, archived and attempt badges, and "Late work is still accepted"
  - loading, error, empty and per-filter empty states, and pagination
- **Course page:** the progress bar and "x% · n of m lessons completed", a Start / Continue / Up next button, "You've completed every lesson in this course", a check mark (and "(completed)" for screen readers) on completed lessons, and "x of y done" per module.
- **Lesson reader:**
  - a completion panel (not in the trainer preview) with the completion date, and a "Completed" badge by the title
  - a toast reports the new course progress, and refusals from the server are shown
  - once an enrolled student's lesson has loaded, the reader sends `POST /lessons/:id/visit` once per lesson (`useRecordLessonVisit`). It sends nothing in the preview or for a lesson that failed to load, and ignores failures (it's bookkeeping)
- **Shared code:** `components/ui/ProgressBar.jsx` (`role="progressbar"`, labelled), and `features/progress/` (API hooks, formatting).
- **Cache:** the server's answer updates the lesson at once, and the roadmap and `['me']` queries refresh. Assignment and enrollment mutations also refresh `['me']`.
- **Time zones:** the client shows the state the server worked out and never recomputes "overdue" from the browser clock (tested).

## Files

**New (server):** `models/LessonProgress.js`, `services/progressRules.js`, `services/progress.service.js`, `services/dashboard.service.js`, `controllers/progress.controller.js`, `routes/me.routes.js`, `validators/progress.validators.js`, `seeds/progress.seed.js`, `seeds/data/demoProgress.js`; tests `progress-rules.test.js`, `progress.test.js`, `student-dashboard.test.js`.

**Changed (server):** `models/constants.js` and `models/index.js`; `routes/index.js` and `routes/course.routes.js`; the services `assignment.service.js` (`/me/assignments`, `reviewedAt`), `course.service.js` (roadmap progress, course guard), `roadmap.service.js` (read-only lesson completion, lesson and module guards), `serializers.js` (`toCourseSummary`) and `submissionRules.js` (constants); `seeds/seed.js` and `seeds/course.seed.js` (reset clears progress); `tests/seed.test.js`.

**New (client):** `components/ui/ProgressBar.jsx`, `features/progress/{api,format,test-fixtures}.js`, `features/dashboard/StudentDashboardPage.jsx`, `features/assignments/student/MyAssignmentsPage.jsx`; tests `StudentDashboard.test.jsx`, `MyAssignments.test.jsx`.

**Changed (client):** `components/Icon.jsx` (check, clipboard), `layouts/navigation.js`, `routes/routes.jsx`, `features/dashboard/DashboardPages.jsx` (trainer page only now), `features/courses/student/CourseDetailPage.jsx`, `features/lessons/LessonReaderPage.jsx`, `features/assignments/{api,pages}.js`, `features/courses/api.js`; tests `StudentCourses.test.jsx`, `LessonReader.test.jsx`, `courses/test-fixtures.js`.

**Docs:** this report, `README.md`, and the spec (§5 as built, the Activity note, §6 Phase 5 deletion rules, §7 and §9).

## Tests executed (actual results, 2026-10-17)

| Check            | Command                                     | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server tests     | `npm test -w server`                        | **18 files, 380 tests passed** (303 from Phases 1–4 + 77 new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Client tests     | `npm test -w client`                        | **15 files, 132 tests passed** (113 + 19 new)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Lint             | `npm run lint`                              | **0 errors, 0 warnings**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Formatting       | `npm run format:check`                      | **All files pass**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Production build | `npm run build`                             | **Succeeds.** The JS loaded at startup is 616 kB (191 kB gzip) across `index` (424 kB), a shared chunk (183 kB) and `jsx-runtime` (9 kB), up from 605/188 kB. The assignment chunk is 43 kB (12 kB gzip) with the new page. The over-500 kB warning now concerns only the lazily loaded CodeMirror chunk                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Dependency audit | `npm audit`                                 | **0 vulnerabilities.** No new dependencies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Security review  | `/security-review` on the full Phase 5 diff | **No findings** at high or medium severity. (The review ran before the visit endpoint was added in the final review. That endpoint reuses the same access check, reads no body and filters its update on owner, course and active status; this was checked by hand and by the tests below.) Checked: role gates on every new route; completion only for lessons the student may open; ownership from the token for every read and write; no body read on completion; NoSQL injection (zod-validated query, `trusted()` only around ids loaded from the database); no unpublished titles or other students' data in responses; `lastLesson` writes limited to the student's own enrollment and lessons they may open; no unsafe HTML in the client; seed input |

**What the new server tests cover:**

- **Rules (unit, 11):** counting and rounding down; complete only at 100%; ignoring completions of hidden lessons; the percentage falling when lessons are added; an empty course; start, resume, next, wrap-around, a missing last lesson, and nothing left.
- **Completion, continue learning and read-only GETs (`progress.test.js`, 41):**
  - completes and returns course progress; idempotent with the first date kept; injected `user`, `course`, `completedAt`, `percent` and `completedLessons` ignored
  - concurrency: 2 concurrent completes, and 6 mixed complete/uncomplete requests, never leave a duplicate; the unique index and the other three indexes exist, and a direct duplicate insert is rejected
  - 404 when not enrolled, pending or removed; 404 for draft or archived lessons, draft modules and archived courses; 403 for the trainer, 401 anonymous, 400 for a malformed id, 404 for an unknown id
  - uncomplete is idempotent, never touches another student's record, and is 404 after removal while keeping the record
  - progress follows content: lessons added (including drafts), a lesson unpublished, archived and republished, a module unpublished; 100% then a bonus lesson; removal and re-enrollment
  - the roadmap, `/me/courses`, the dashboard and the completion response all give the same numbers
  - roadmap flags only for the enrolled student and only their own; none for visitors or the trainer
  - **GETs are read-only:** a snapshot of every collection is identical after 18 student GETs (lesson detail, materials and navigation for 4 lessons, course, roadmap, `/me/courses`, `/me/assignments`, `/dashboard/student`, `/assignments`) and a trainer preview. Lesson detail shows only the caller's own completion
  - **`POST /lessons/:id/visit`:**
    - records the continue point, with `lastAccessedAt` equal to the returned `visitedAt`; "resume" follows
    - updates only the caller's enrollment, while another student's in the same course stays identical; injected `user`, `lessonId`, `courseId` and `lastAccessedAt` are ignored
    - refused, without changing anything: draft and archived lessons, a draft module, another course's lesson, an unknown id (404), a malformed id (400), pending or removed enrollments (404)
    - 403 for the trainer, 401 anonymous
    - after completing the visited lesson, "next" follows
  - `/me/courses`: order, pending requests, archived and removed courses left out, the course card has no description, own progress only, a course with no lessons, empty for a new student, 403/401
  - deletion: a lesson (even after archiving), a module and a course (even after the student's removal) are refused; archiving keeps progress and submissions, and republishing restores them; a course without progress still deletes
- **My assignments and dashboard (`student-dashboard.test.js`, 19):**
  - every derived state with counts and due-date order; state and course filters; pagination; past the last page
  - another student's work never changes the caller's states; hidden assignments left out (draft, archived without a submission, draft lesson, not enrolled, pending enrollment); archived with a submission included
  - query validation (`status`, `course`, `limit` 0 and 500, `page` 0 and `two`); brackets never become operators
  - a course the student isn't in; a student with no enrollments (zero counts)
  - time zones: pending to overdue exactly at the due instant, written in `+05:30` and `-04:00`; the server clock a minute either side; an offset due date stored as UTC; overdue still open during the late window
  - dashboard summary, To do, feedback order and continue learning; empty for a new student; no other student's data; 403/401 (and no `/dashboard/admin` yet); a newly published assignment is counted
- **Seed (6):** demo links are valid; the first N lessons in roadmap order and the continue point; one reviewed and one resubmission-requested submission; reruns change nothing; students without an active enrollment are skipped; reset removes progress.

**What the new client tests cover:**

- **Dashboard (6):** stats, continue link, progress bars, pending request, To do, feedback with marks; the no-courses invitation; everything completed; a course with no lessons yet; showing the server's state without recomputing dates; error and retry.
- **My assignments (3):** rows with place, time zone, marks, archived and late-work note; state filters with counts and `aria-pressed`, the exact request parameters, and a course filter listing active courses only; empty and per-filter empty states.
- **Course page (3 new, 1 updated):** progress bar values, "Continue: …", check marks with "(completed)", "1 of 2 done", the completed message, and no progress for visitors.
- **Lesson reader (7):**
  - completing with the exact lesson id and the progress toast, undoing, a server refusal leaving the lesson incomplete, and no panel in the trainer preview
  - the visit is POSTed exactly once with the lesson id after loading, again for the next lesson when the student moves on, and never in the trainer preview or for a lesson that failed to load

**Mutation check.** I broke each rule below on purpose, one at a time, and ran the related tests. Each break failed at least one test, and the code was restored after each run:

| Rule removed                                    | Tests that failed                           |
| ----------------------------------------------- | ------------------------------------------- |
| Students see only their own completions         | 3                                           |
| Unmarking touches only the caller's record      | 1                                           |
| Completing needs a lesson the student may open  | 5                                           |
| Completing is student-only                      | 1                                           |
| The first completion date is kept               | 1                                           |
| Only published lessons count                    | 11                                          |
| Only lessons in published modules count         | 1 (0 at first; a test was added, see below) |
| The percentage is rounded down                  | 1                                           |
| Archived courses are left out of my courses     | 1                                           |
| A lesson with progress can't be deleted         | 1                                           |
| A module with progress can't be deleted         | 1                                           |
| A course with progress can't be deleted         | 1                                           |
| The state filter on my assignments              | 2                                           |
| Overdue only strictly after the due instant     | 2                                           |
| To do lists only work that can be handed in     | 1                                           |
| Roadmap progress only with an active enrollment | 3                                           |
| GET /lessons/:id stays read-only (final review) | 1                                           |

The module rule first failed no test, because the module test only checked the roadmap, which has its own query. I added the "same numbers everywhere" test, which now catches it.

**Live check against a running API** (before the final review). I seeded a separate, throwaway database (`lms_phase5_check`; your development database and `server/.env` were not used), started the API and ran 25 checks over HTTP. All passed:

- **Seed:** the first run added the demo progress and submissions. Later runs reported everything as "kept".
- **Aarav:**
  - dashboard: 1 active course, 8 lessons completed, "Continue: Functions, Scope and Closures" (resume) at 21%
  - feedback: Personal Profile Page, 86; To do had only Responsive Landing Page
  - roadmap: 8 of 38 flags
- **Completing:**
  - the lesson detail showed it as not completed
  - completing it, with injected `percent`, `user` and `completedAt`, gave 9 of 38 (23%) with today's date
  - repeating it kept the date
  - 5 concurrent requests on another lesson counted once (10); undoing it went back to 9
- **Scoping:**
  - Neha saw only her own 3 completions, and her resubmission request under its filter, where she can submit
  - Kabir (pending DSA) had no active course, 1 pending request and no assignments; he got 404 completing a MERN lesson
- **Roles and validation:**
  - the trainer got 403 on complete, `/me/courses` and `/dashboard/student`
  - anonymous got 401; an invalid filter and an invalid id got 400
  - Aarav's reviewed filter matched its count
- **Trainer changes:**
  - unpublishing a completed lesson made Aarav's progress 8 of 37
  - deleting it was refused (409, with the archive message)
  - republishing it restored 9 of 38
- **Indexes:** `explain` confirmed the index use described in the database section.
- **Cleanup:** the server was stopped, and the throwaway database and its upload folder were deleted.

**Browser smoke test (final review, 34 of 34 passed).**

The Playwright browser tool still failed to connect, so I drove the installed Google Chrome 129 (headless) directly through the Chrome DevTools Protocol from a Node script, with no new dependencies. It used real mouse clicks and typing.

**Setup:**

- the production build (`npm run build`), served by a small Node server that forwards `/api` to the API like the Vercel rewrite
- a freshly seeded throwaway database; your development database and `server/.env` were not used
- extra data created through the proxy: Aarav also enrolled in DSA (so the course filter appears), 22 more MERN assignments (6 already past due, for pagination and Overdue), and a new student, Zoe, with no enrollments

**Aarav (1280 px):**

- **Dashboard:** 2 active courses, 8 lessons completed, 6 overdue. "Continue: Functions, Scope and Closures" at 21% · 8 of 38. DSA at 0% with "Start: Big-O Notation". Feedback "Marks: 86 / 100".
- **Continue:**
  - clicking Continue opened that lesson
  - the browser sent `GET` for the lesson, its materials and its navigation, then one `POST …/visit`, and no other write
- **Mark as complete:**
  - toast "Lesson completed. 23% · 9 of 38 lessons completed."
  - the panel switched to "Completed on …" with an undo button
- **Course page:** progress bar 23, 9 lessons marked "(completed)", "Up next: Arrays and Objects".
- **Dashboard again:** 23% with the same "Up next: Arrays and Objects", and the tile showed 9. The dashboard, roadmap and reader agree.
- **Undo after a full page reload** (silent refresh restored the session):
  - toast "Lesson marked as not completed."
  - the course page was back to 21% with "Continue: Functions, Scope and Closures"
- **Assignments:**
  - counts All 26, Not submitted 19, Overdue 6, Resubmission requested 0, Submitted 0, Reviewed 1
  - "Page 1 of 2 · 26 total", 20 rows, then 6 on page 2
  - Overdue gave exactly 6 rows, each Overdue, on one page
  - course filter DSA with Overdue gave "Nothing is overdue. Well done."; with All, the 2 DSA assignments

**390 px (mobile emulation):**

- dashboard, Assignments, the course page and a lesson (Aarav) and Zoe's dashboard all had **0 px** of horizontal overflow
- I looked at the screenshots: the tiles wrap two per row, badges move below the text, long course paths are truncated, the completion panel stacks with a full-width button, and code scrolls inside its own box

**Other students:**

- **Zoe (no enrollments):** "Find your next course" on the dashboard, and "No assignments yet" with All 0.
- **Kabir (pending DSA):** "Request pending", no Continue card, "Nothing to hand in right now."
- **Neha:** 3 lessons completed, "Your trainer asked for a new attempt" under Recent feedback, and the Resubmission requested filter showed Personal Profile Page.

**Errors:**

- no console errors
- the only API response at or above 400 was the expected `401 /auth/refresh` (the silent-refresh attempt on the login page after cookies were cleared)

**Harness notes:**

- early runs failed because of my script, not the app: a backslash path bug in the file server, `innerText` applying the CSS `uppercase`, and stale text and slow-load timing
- one click was blocked by a success toast still covering the bottom-right "Next" button; toasts close after 3.5 s (Phase 1 behaviour), so the script now waits as a person would

The screenshots are in the session's scratchpad (`shots/`), and the server, browser, database and Chrome profile were removed afterwards.

## Known issues and remaining work

1. **Browser coverage is one engine.** The smoke test used headless Chrome 129 (desktop and 390 px emulation). Safari, Firefox and a real phone weren't tried; the manual steps below cover them.
2. **No seeded overdue demo** (decision 11). The Overdue state appears once a seeded due date passes; the tests cover it.
3. **Toasts cover the bottom-right corner for 3.5 s.** After "Mark as not completed", the toast briefly covered the Assignments page's "Next" button. This is existing Phase 1 behaviour with a Dismiss button; consider it in the Phase 7 accessibility pass.
4. **Courses with any completions can only be archived,** even if every student who studied it has been removed. This is intended (spec §6), but it means a test course a student worked through can't be deleted.
5. **Demo progress comes back** if a demo student un-completes every lesson of the course and the seed runs again. This is the same trade-off as the starter materials (Phase 3 decision 7).
6. **A narrow race on lesson deletion.** If the trainer deletes an unpublished lesson in the same instant a request that already passed the access check completes it, a stray record could remain. It never counts (the lesson is gone) and blocks nothing except deleting that course. Not worth a transaction now.
7. **The dashboard reflects the moment it was loaded.** States are worked out at request time and refreshed on navigation (30 s stale time). A page left open past a due date shows the change on the next refresh.
8. **Bundle size:** +11 kB at startup (+3 kB gzip). Route-level splitting is still planned for Phase 7.
9. **Carried over:**
   - the occasional unmocked request in `AdminCourses.test.jsx` (Phase 2)
   - a jsdom "navigation not implemented" message in a Phase 3 reader test

   Neither fails a test.

10. **Phase 6 items not built:** the trainer's view of student progress, the review queue across courses (`GET /admin/submissions`), student management, the trainer dashboard, reports, and the `Activity` model.

## Manual testing instructions

1. Add `SEED_DEMO_STUDENT_PASSWORD` to `server/.env` if it isn't there.
2. Run `npm run seed`. The first time, it reports "Demo progress for aarav… 8 lessons completed", "neha… 3", and two demo submissions "added". Run it again: every line says "kept".
3. Run `npm run dev`. Sign in as **Aarav** (`aarav.demo@example.com`).
4. **Dashboard (`/app`):**
   - the tiles show 1 active course and 8 lessons completed
   - Continue learning shows MERN at 21% with "Continue: …"
   - To do lists Responsive Landing Page; Recent feedback shows Personal Profile Page with 86 / 100
5. **Continue and complete:**
   - click Continue; at the bottom, click **Mark as complete**
   - the toast says "Lesson completed. 23% · 9 of 38 lessons completed."; the panel turns green with the date, and the title gets a Completed badge
   - click **Mark as not completed** and back again
6. **Course page:** open MERN.
   - the progress bar and "x of y done" per module
   - check marks on completed lessons
   - the button says Continue or Up next
7. **Assignments (sidebar):**
   - try each filter; the counts match the rows
   - each row shows the due date in your time zone
8. **As Neha:**
   - she sees only her own 3 completions
   - the Resubmission requested filter shows the profile page, and the assignment page offers "Resubmit (attempt 2)"
9. **As Kabir** (pending DSA):
   - the dashboard shows the pending request and no progress
   - the Assignments page is empty
10. **As the trainer:**
    - unpublish one of Aarav's completed lessons; as Aarav, the course shows one lesson fewer in both numbers
    - try to delete that lesson: the toast says to archive it instead
    - publish it again; Aarav's progress is back
11. **Overdue:**
    - edit an assignment's due date to a minute from now and wait; as a student who hasn't submitted, it changes from Not submitted to Overdue
    - with late work allowed, it still appears under To do
12. **Mobile:** at about 390 px, the dashboard, My assignments and the course page have no sideways scrolling.

## Recommended next phase

**Phase 6: review and analytics.** The review queue across courses, student list and detail pages (including each student's progress, built on this phase's services), the trainer dashboard, course and student reports, and the `Activity` model.
