# Phase 4 report: assignments and submissions

Date: 2026-10-16 · Status: **awaiting review**

## Summary

The trainer can now set assignments and review the work students hand in.

- **Trainer:** an Assignments tab in each course. Assignments can be set for the whole course, a module or a lesson, with Markdown instructions, a due date, marks, an attempt limit, the accepted submission types, an optional late policy and handouts.
- **Trainer review:** the submissions of each assignment, one row per student, and a review page with the student's work, their attempt history, marks, feedback and "Request resubmission".
- **Student:** assignments appear on the course page and under the lesson they belong to. The assignment page has the instructions, the deadline in the student's time zone, a submission form, editing until review, resubmission after a request, and every attempt with its feedback and marks.
- **Submission types:** GitHub repository, deployed project and Google Drive links, a PDF upload and a code snippet.
- **Seed:** five starter assignments across the three courses.

Everything is enforced on the server. A student can only see their own submissions and PDFs: anything else is a 404, including another student's submission id. Phase 1–3 behaviour is unchanged, and all of their tests still pass.

**One scope decision to check first (decision 1):** the approved plan puts grading in Phase 6. I brought the per-submission review forward (marks, feedback, request resubmission), because the Phase 4 acceptance criteria ("editing is blocked after review", "penalties are computed correctly") and the resubmission workflow can't work without it. Phase 6 keeps the cross-course review queue, student management, dashboards and reports.

## Features completed

**Trainer:**

- **Assignments tab** in the course builder: each assignment with its place in the course, its due date, how many students submitted, how many are waiting for review, and its status. A "New assignment" button.
- **Assignment editor** (`/admin/courses/:courseId/assignments/new` and `…/:assignmentId/edit`):
  - Title and status.
  - "Belongs to": the whole course, a module, or a lesson.
  - Due date and time, in the trainer's time zone (the form names it).
  - Maximum marks, and the number of attempts (empty means unlimited).
  - Late work: off, or on with a cutoff date and a penalty percentage.
  - Accepted submission types (at least one).
  - Objectives, one per line.
  - Markdown instructions with a live preview: side by side on wide screens, Write/Preview tabs on small ones.
  - Handouts (PDF, DOCX, PPTX up to 20 MB), uploaded on save. Retrying after a failed save doesn't upload them again.
  - The form checks everything before sending, including "late cutoff after the due date". Server errors appear on the right field.
- **Assignment page** (`/admin/courses/:courseId/assignments/:assignmentId`):
  - Instructions, details and handouts.
  - Publish, unpublish, archive and delete (with confirmation; the server's refusal is shown).
  - The latest attempt of each student, with attempt number, submission time, a late badge, status and final marks. Filters: all, to review, resubmission requested, reviewed. Paginated.
- **Review page** (`…/submissions/:submissionId`):
  - The work: links that open in a new tab, PDFs in the inline viewer, highlighted code, and the student's note.
  - Marks and Markdown feedback, with a live "after the 20% penalty the student gets …" hint for late work. "Save review" (later "Update review").
  - "Request resubmission", which requires feedback (marks optional). It is disabled once the attempt limit is used, and the page says why.
  - The attempt history. Earlier attempts open read-only.

**Student:**

- **Course page:** once enrolled, an Assignments list with due dates and the student's own state (Not submitted, Overdue, Submitted, Reviewed, Resubmission requested).
- **Lesson reader:** "Practice assignments" under the materials when the lesson has any. It also appears in the trainer's preview.
- **Assignment page** (`/app/courses/:courseId/assignments/:assignmentId`):
  - A breadcrumb and the state badge.
  - Instructions rendered as safe Markdown, objectives and handouts.
  - Due date with time zone and "in 3 days", the late policy in words, marks, attempts and accepted types.
- **Submit form:**
  - One field per accepted type, of which at least one must be filled in.
  - Links are checked in the browser first (https, the right host, a real repository path, no localhost or private addresses).
  - PDFs are checked for type and size (10 MB), then uploaded with a progress bar when the form is sent.
  - Code goes in the code editor with a language choice, up to 100 KB.
  - An optional note for the trainer.
- **After submitting:** the attempt is shown with an "Edit submission" button until the trainer reviews it, or until the window closes for a first attempt.
- **After a resubmission request:** the trainer's feedback is shown above a new "Resubmit (attempt 2)" form.
- **History:** every attempt with its items, late badge, marks (with "before the late penalty" when it applies) and feedback.
- **Blocked states:** a clear reason, for example "The submission window has closed." Unavailable assignments get "This assignment is not available".

**Also:**

- **Seed:** two MERN, one Java and two DSA assignments in the first modules. Between them they use all five submission types, with and without late work. A course only gets them while it has no assignments at all.
- **Deletion rules** now include assignments and submissions (see the database section).
- **Code editor fix (Phase 3 component):** typing in the code box while the editor was still loading could lose characters when it swapped in. This was found in the browser check (only `funct` of a function was saved). The editor now starts loading as soon as a form with a code field opens, and keeps focus and the cursor when it replaces the plain text box. It affects the trainer's code materials too.

## Decisions made in this phase

1. **Per-submission grading is in Phase 4** (see the summary). Built: `POST /submissions/:id/review`, `POST /submissions/:id/request-resubmission`, and a per-assignment submissions list. Not built (Phase 6): `GET /admin/submissions` across courses, student management, dashboards and reports.
2. **When the window closes.** It closes at the due date, or at the late cutoff when late work is allowed. A late cutoff is required when late work is on, and must be after the due date. With late work off, the penalty is stored as 0.
3. **Editing after the due date makes a first attempt late.** Otherwise a student could submit a placeholder on time and swap in the real work later. `submittedAt` stays the original time; `editedAt` records the last change.
4. **A requested resubmission works after the deadline,** and can be edited until it is reviewed. Trainers mostly review after the deadline, so the request itself is the permission. The new attempt keeps the late flag of the work it replaces, so a late first attempt stays late and an on-time one stays on time.
5. **Only the latest attempt can be reviewed.** Earlier attempts are history. Re-reviewing the latest attempt is allowed, to correct a mistake.
6. **Marks:** 0 up to the maximum, two decimals at most. `finalMarks` is stored at review time and is not recalculated if the penalty changes later. Lowering `maxMarks` below marks already awarded is refused.
7. **Student PDFs have their own upload route,** `POST /assignments/:id/files`. The role check, the rate limit, the visibility check and the "may submit or edit now" check all run before the body is read, with a 10 MB limit instead of the trainer's 20 MB. An uploaded PDF belongs to that student and that assignment, and can only be attached by them. The same PDF can be kept across attempts.
8. **Unsubmitted student uploads are removed** when the same student uploads again for the same assignment, once they are more than an hour old. This keeps abandoned uploads from piling up without risking a file in an open form.
9. **Modules and lessons with assignments can't be deleted.** The trainer moves or deletes the assignments first (409 with a count). Alternatives, such as silently deleting the assignments or moving them to course level, could delete work or make hidden assignments visible. Moving a lesson to another module moves its assignments with it.
10. **"Overdue"** means past the due date with nothing handed in, even if late work is still accepted. The student page then says the work will be marked late.
11. **Links are only checked, never fetched.** There is no server-side request to the submitted URL, so no SSRF risk. The private-address check keeps out links the trainer couldn't open: localhost, private and link-local ranges (including odd spellings such as `0x7f.1`), single-label and `.local` names, and URLs with credentials.
12. **One field per link type in the form.** The API accepts up to 5 items of any mix of allowed types; the form offers one of each.

## Database changes

| Model                 | Fields                                                                                                                                                                                                                                                  | Indexes                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Assignment` (new)    | course, module, lesson, title, instructions (Markdown), objectives[], dueAt, maxMarks, allowedSubmissionTypes[], attachments[] (FileAsset), latePolicy {allowLate, lateUntil, penaltyPercent}, maxAttempts (null = unlimited), status, createdBy        | `{course, status, dueAt}`, `{module}`, `{lesson}`, `{attachments}`                                    |
| `Submission` (new)    | assignment, course, student, attempt, items[] ({type, url \| file \| code {language, source}}), note, submittedAt, editedAt, isLate, status (`submitted`/`reviewed`/`resubmit_requested`), review {marks, finalMarks, feedback, reviewedBy, reviewedAt} | unique `{assignment, student, attempt}`, `{course, status}`, `{student, submittedAt}`, `{items.file}` |
| `FileAsset` (changed) | new purposes `assignment` and `submission`; new field `assignment` (the assignment a submission file belongs to)                                                                                                                                        | new `{assignment, uploadedBy}`                                                                        |

Deletion rules added:

| Item       | Can be deleted when                                                                |
| ---------- | ---------------------------------------------------------------------------------- |
| Assignment | Not published, and no submissions. Its unused handouts are deleted with it         |
| Module     | As before, and no assignments point at it or its lessons                           |
| Lesson     | As before, and no assignments point at it                                          |
| Course     | As before, and no submissions. Its assignments and their files are deleted with it |

No existing data needs migrating. The spec (§5, §6, §7, §9) is updated with the rules as built.

## API endpoints added (`/api/v1`, all require a bearer token)

| Method | Path                                    | Who     | Notes                                                                                                                                                                                                                                                                 |
| ------ | --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/assignments`                          | any     | Filters `course`, `module`, `lesson`, `status` (admin only), `page`, `limit` (≤ 100). Sorted by due date. Students only get assignments they can see, each with `mySubmission` (derived state, attempts, `canSubmit`, `canEdit`, `blockedReason`). Admins get `stats` |
| POST   | `/assignments`                          | admin   | 201, draft by default. `courseId` is required; `moduleId`/`lessonId` must belong to it; `attachmentIds` must be `assignment` files of the same course                                                                                                                 |
| GET    | `/assignments/:id`                      | any     | Adds course/module/lesson titles. 404 for students who can't see it                                                                                                                                                                                                   |
| PATCH  | `/assignments/:id`                      | admin   | Any field except the course, including `status`. Removed handouts are deleted once unused                                                                                                                                                                             |
| DELETE | `/assignments/:id`                      | admin   | 204, or 409 when published or when there are submissions                                                                                                                                                                                                              |
| GET    | `/assignments/:id/submissions`          | admin   | The latest attempt per student with `attempts`, newest first; `status` filters on the latest attempt; paginated. Code sources, notes and feedback are left out                                                                                                        |
| GET    | `/assignments/:id/submissions/me`       | student | Every attempt of the caller, newest first                                                                                                                                                                                                                             |
| POST   | `/assignments/:id/submissions`          | student | 201. A new attempt (`items`, `note`). 409 when the window has closed, an attempt is waiting for review, it has been reviewed, or no attempts are left. 400 for disallowed types and invalid items                                                                     |
| POST   | `/assignments/:id/files`                | student | Multipart `file`: a PDF of at most 10 MB for the caller's own submission. 400/413 `FILE_REJECTED`, 409 when they can't submit now. Shares the 30-per-hour upload limit                                                                                                |
| GET    | `/submissions/:id`                      | any     | Students: only their own (404 otherwise). The trainer also gets `assignment` and the student's `history`                                                                                                                                                              |
| PATCH  | `/submissions/:id`                      | student | Edits `items` and/or `note` of the caller's latest unreviewed attempt (and, for a first attempt, while the window is open). 409 otherwise                                                                                                                             |
| POST   | `/submissions/:id/review`               | admin   | `{ marks, feedback }`. Latest attempt only (409 otherwise); marks above `maxMarks` → 400. Sets `reviewed` and `finalMarks`                                                                                                                                            |
| POST   | `/submissions/:id/request-resubmission` | admin   | `{ feedback, marks? }`. Latest attempt only; 409 when the attempt limit is used. Sets `resubmit_requested`                                                                                                                                                            |

Changed: `POST /files` now also takes `purpose=assignment`, and `GET /files/:id` serves assignment handouts (same rule as their assignment) and submission PDFs (uploader and trainer only).

**Submission item rules:**

| Type          | Rule                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `drive_url`   | https, host `drive.google.com` or `docs.google.com`                                                                                     |
| `github_url`  | https, host `github.com` (or `www.`), path `/owner/repo[/…]` with valid names; GitHub pages such as `/settings` refused                 |
| `project_url` | https, a public host: no localhost, private, link-local, reserved or mapped IP addresses, no single-label or `.local`/`.internal` names |
| `pdf`         | `fileId` of the caller's own `submission` upload for this assignment                                                                    |
| `code`        | `language` from the code allowlist, `source` non-blank, at most 100 KB (UTF-8 bytes)                                                    |

All links: at most 2048 characters, no `user:password@`. `javascript:`, `data:`, `http:` and other schemes are refused. At most 5 items per attempt, and the note is at most 2000 characters.

## Tests executed (actual results)

| Check            | Command                                     | Result                                                                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server tests     | `npm test -w server`                        | **14 files, 294 tests passed** (190 from Phases 1–3 + 104 new)                                                                                                                                                                                                                                              |
| Client tests     | `npm test -w client`                        | **13 files, 111 tests passed** (79 from Phases 1–3 + 32 new)                                                                                                                                                                                                                                                |
| Lint             | `npm run lint`                              | **0 errors, 0 warnings**                                                                                                                                                                                                                                                                                    |
| Formatting       | `npm run format:check`                      | **All files pass**                                                                                                                                                                                                                                                                                          |
| Production build | `npm run build`                             | **Succeeds.** The JS loaded at startup is 605 kB (188 kB gzip), up from 595/184 kB. The assignment pages are a separate 38 kB (11 kB gzip) chunk. The over-500 kB warning remains for the main bundle and CodeMirror (known issue 8)                                                                        |
| Dependency audit | `npm audit`                                 | **0 vulnerabilities.** No new dependencies                                                                                                                                                                                                                                                                  |
| Security review  | `/security-review` on the full Phase 4 diff | **No findings** at medium or high severity. Checked: role gates on every route, assignment visibility, submission ownership, attaching another student's file, file access by purpose, protected fields, grading, upload ordering, NoSQL injection, data exposure, XSS through links and Markdown, and SSRF |

**What the new server tests cover:**

- **Rules (unit tests):**
  - the window closes at the due date or the late cutoff, inclusive
  - late flags for first attempts, resubmissions and edits after the due date
  - attempt and edit permissions
  - penalty arithmetic with rounding
  - derived states
  - 33 link cases, including `javascript:`/`data:` schemes, look-alike hosts, credentials, `0x7f.1`, `2130706433`, `[::1]`, `[::ffff:127.0.0.1]`, `169.254.169.254`, and GitHub pages that aren't repositories
- **Assignments:**
  - create with defaults; dates stored in UTC whatever offset was sent
  - a lesson implies its module; refused: a module or lesson from another course, and a mismatched module and lesson
  - field validation; the late-cutoff rules; no penalty without late work
  - handouts from the same course only; client-supplied `createdBy` ignored; admin-only
  - updates keep the course; the cutoff is checked against a changed due date; `maxMarks` can't drop below awarded marks; removed handouts are deleted
  - delete rules
- **Visibility:**
  - students see only published assignments of published modules and lessons in courses with an active enrollment; all others are 404
  - a student's `status` filter is ignored; the cross-course list
  - derived states, including overdue
  - the trainer's filters and stats
  - handouts follow their assignment; students can't upload handouts; the trainer route refuses the `submission` purpose
- **Submissions:**
  - attempt 1 with every link type and code; injected `student`, `status`, `isLate`, `attempt` and `review` are ignored
  - disallowed types; 11 validation cases; code exactly at 100 KB is accepted
  - a second attempt while one is waiting is refused
  - the window: closed, late within the cutoff, on time, after the cutoff
  - 404 for hidden assignments, 403 for the trainer, 401 anonymous
  - two concurrent first attempts: only one is created
- **Editing:**
  - edits keep the attempt; blocked after review or a resubmission request, after the window closes, and on older attempts
  - an edit after the due date makes the attempt late
  - edits follow the current allowed types
- **Privacy:**
  - another student's submission is 404 for both read and edit
  - a student's history contains only their own attempts, without `reviewedBy`
  - the role gates on all endpoints
- **PDFs:**
  - upload and attach; a stored random key; the owner and the trainer can open it, other students and anonymous users get 404
  - refused: another student's upload, a file from another assignment, HTML disguised as a PDF, a PDF named `.docx`, a wrong declared type, more than 10 MB (413). Nothing is stored for any of them
  - checks before the body is read: PDFs not accepted, window closed, already reviewed, hidden, trainer
  - the per-user rate limit
  - replaced and stale files are deleted, and a file an earlier attempt still uses is kept
- **Review:**
  - the late penalty (45.5 → 36.4 at 20%)
  - the marks cap and validation (negative, text, three decimals)
  - the full resubmission workflow to `maxAttempts`, including a resubmission after the deadline and editing it
  - older attempts can't be reviewed
  - the late flag carries over to a resubmission
  - the trainer's list: latest attempt per student, summaries without code or feedback, status filter, pagination
- **Deletion:** a module or lesson with assignments is refused; a course with submissions is refused; otherwise a course deletes its assignments and files; a moved lesson takes its assignments along.
- **Seed:** 1–2 valid assignments per course in the first modules, covering all types and both late policies; placement, due dates and late cutoffs; reruns change nothing; reset removes assignments and submissions.

**What the new client tests cover:**

- **Helpers:** dates round-trip between UTC and local input; the time zone is shown; relative times; the late-policy text; marks; the client copies of the link, PDF and code-size checks.
- **Student assignment page:**
  - instructions as safe Markdown (a `<script>` doesn't run), deadline, policy and handouts
  - a submission of links and code; at least one item required; link checks before sending
  - only the accepted types are offered
  - a server field error (`items.1.url`) lands on the right field
  - PDF type check, upload, then submit; the server's upload refusal is shown
  - editing; feedback shown with a resubmission request; marks after review with the pre-penalty value; the window-closed message; unavailable assignments
- **Trainer:**
  - the builder's Assignments tab
  - editor validation, including the late cutoff
  - the exact create payload (UTC dates, lesson placement, late policy, unlimited attempts, objectives)
  - server errors on the "Belongs to" field; handouts uploaded first and not re-uploaded on retry; editing an existing assignment
  - the assignment page with per-student rows and filters; publish; delete refusal
  - the review page: links open safely, code is shown as text, the marks cap, the penalty preview, the exact review payload, feedback required for a resubmission, the no-attempts-left state, earlier attempts read-only
- **Course page and reader:** the enrolled student's assignment list with their state; no assignment request before enrollment; the lesson's practice assignments.

**Mutation check.** I broke each rule below on purpose, one at a time. Each break failed tests, and the full suite passed again after restoring the code:

| Rule removed                                  | Tests that failed |
| --------------------------------------------- | ----------------- |
| Students see only their own submissions       | 1                 |
| Active enrollment needed to see an assignment | 3                 |
| Module and lesson must be published           | 1                 |
| Submission files: uploader (and trainer) only | 1                 |
| No editing after review                       | 4                 |
| No editing after the window closes            | 2                 |
| No first attempt after the window closes      | 4                 |
| Late flag after the due date                  | 5                 |
| Late penalty in the final marks               | 3                 |
| `maxAttempts` limit                           | 1                 |
| Disallowed submission types rejected          | 2                 |
| A PDF must be the student's own upload        | 1                 |
| Marks capped at `maxMarks`                    | 1                 |
| Only the latest attempt can be reviewed       | 1                 |

**Manual check in a real browser** (Playwright, `npm run dev`, through the Vite proxy, against the local database):

- `npm run seed` on the Phase 3 database: "added 2 / 1 / 2" assignments. A second run: "the course already has assignments, kept".
- **Live permission checks through the proxy, all as expected:**
  - Aarav (enrolled in MERN) lists the two MERN assignments
  - Kabir (not in MERN) gets 404 on a MERN assignment; Aarav gets 404 on a DSA assignment
  - anonymous users get 401; a student creating an assignment gets 403
  - refused with the right message: a PDF upload to a links-only assignment, a `https://127.0.0.1` project link, and code for a links-only assignment
  - an injected `status: reviewed` and `review` were ignored
  - Neha got 404 reading and editing Aarav's submission; Aarav got 403 reviewing his own
- **As Aarav:**
  - the course page listed both assignments with dates in GMT+5:30; the form offered only the three accepted link types
  - a localhost project link was refused in the form; links and a note were submitted, then shown with "Edit submission"
- **As the trainer:**
  - created an assignment in "Flexbox Layouts" with PDF and code types and late work
  - a late cutoff before the due date was refused; the instructions preview rendered **bold** and dropped a `<script>`
- **As Aarav again:**
  - the lesson reader showed it under "Practice assignments"
  - an HTML file named `.pdf` was refused by the server ("The file content is not a valid .pdf file")
  - a real PDF and code were submitted; the PDF opened in the inline viewer from a `blob:` URL
- **Code editor bug found here:** only `funct` of the code was saved, because CodeMirror replaced the stand-in text box mid-typing. After the fix, I delayed the editor download by 1.5 s and typed a whole line across the swap; the full line was saved.
- **As the trainer:**
  - opened the landing-page submission: links have `rel="noopener noreferrer nofollow"`
  - "Request resubmission" required feedback, then succeeded; the row changed to "Resubmission requested"
  - graded the PDF/code submission: 120 was refused ("At most 100 marks"), 88.5 was saved
- **As Aarav at 390 px:**
  - the feedback (Markdown) was shown above "Resubmit (attempt 2)"; the new attempt was submitted; attempt 1 was in the history with the feedback
  - the reviewed PDF/code assignment showed "Marks: 88.5 / 100"
  - no horizontal scrolling
- **Layout fix found here:** at 390 px the trainer's review page scrolled sideways by 187 px, because a long code line widened the page's single column. The three assignment pages now constrain that column; the code scrolls inside its own box and the page fits.
- The only console error during the session was the expected 400 for the fake PDF.
- **Cleanup:** I deleted my test assignment, Aarav's four test submissions and his uploaded PDFs. The local database is back to the five seeded assignments with no submissions or submission files.

## Known issues and remaining work

1. **Grading arrived early** (decision 1). Please confirm you're happy with it in Phase 4, or I can hide the review endpoints until Phase 6.
2. **No virus scanning.** Students can now upload PDFs. Each one must really be a PDF (magic bytes), is at most 10 MB, is stored under a random key, and is served only to its owner and you, with `nosniff` and a sandboxing CSP, and the app shows it from a `blob:` URL. A malicious but valid PDF could still target a PDF reader. Consider a scanning step before production (Phase 8).
3. **Links are not checked for reachability.** A Drive link may still be private to the student; the form asks them to make sure you can open it.
4. **Archiving hides the assignment from students, including their own past submissions** (404, like other archived content). You still see everything.
5. **No per-student extensions.** A resubmission request works after the deadline (decision 4), but there's no way to give one student a later first deadline. Moving the due date affects everyone.
6. **Changing the penalty after grading** doesn't recompute existing final marks (decision 6). Re-review to apply it.
7. **Orphaned handouts.** As with Phase 3 materials, handouts uploaded for a save that then fails stay stored but unattached until the course is deleted. Student uploads are cleaned up (decision 8).
8. **Bundle size.** The startup JS grew by 10 kB (4 kB gzip), and the over-500 kB warning remains. Route-level splitting is still planned for Phase 7.
9. **Phase 5/6 items not built:** students have no cross-course "my assignments" list or dashboard (Phase 5), and there is no review queue across courses (Phase 6). Demo students have no seeded submissions yet; they arrive with the Phase 5 demo progress.
10. **Flaky stray request in an old client test.** `AdminCourses.test.jsx` (Phase 2) sometimes logs one unmocked network error (1 in 8 runs, before and after this phase). It never fails a test. The new tests unmount before restoring their stubs, so they don't do this.
11. **Seeded due dates depend on when you seed.** They are 7–28 days after the run, at 18:30 UTC (midnight India time). On your current database they count from today, 2026-10-16.
12. **Local sessions from the browser check.** Signing in for the check created refresh sessions for the trainer and the three demo students in the local database. They expire on their own within 7 days; logging out or changing the password ends them sooner. An empty `server/uploads/submission/` folder (git-ignored) also remains.

## Manual testing instructions

1. Run `npm run seed`. It should report "Assignments for … added 2 / 1 / 2" the first time, and "the course already has assignments, kept" after that.
2. Run `npm run dev` and sign in as the trainer. Open **Courses → Full-Stack MERN Development → Assignments**.
3. **New assignment:**
   - submit it empty to see the validation
   - choose a lesson under "Belongs to"; tick **PDF upload** and **Code snippet**; turn on late work with a cutoff before the due date (refused), then after it
   - type some Markdown with `<script>alert(1)</script>` and watch the preview; add a handout
   - publish it
4. **As a demo student** (`aarav.demo@example.com`, using `SEED_DEMO_STUDENT_PASSWORD`):
   - open MERN; the Assignments list is in the right column
   - open the lesson you chose: "Practice assignments" lists yours
   - open the assignment: the due date shows your time zone
5. **Submit:**
   - press Submit with nothing filled in (refused); try `https://localhost:3000` as a project link (refused)
   - try a text file renamed to `.pdf` (refused by the server, with the reason shown)
   - submit a real PDF and some code; open the PDF; use **Edit submission** to change the code
6. **As Neha** (`neha.demo@example.com`, also in MERN): open the same assignment. You see only your own state and none of Aarav's work. The API answers 404 to her token for Aarav's submission id; this is covered by the automated tests and the live check above.
7. **As the trainer**, open the assignment, then Aarav's row:
   - enter marks above the maximum (refused)
   - write feedback and click **Request resubmission**
8. **As Aarav:** the feedback is shown above "Resubmit (attempt 2)". Submit attempt 2 and check that attempt 1 is in the history.
9. **As the trainer:** review attempt 2 with marks. Aarav now sees the marks and feedback, and no submit form.
10. **Late work:** edit an assignment so its due date is in the past and its late cutoff in the future, then submit as a student. The attempt is marked **Late**, and when you grade it the hint shows the marks after the penalty.
11. **Deletion rules:**
    - deleting a published assignment is refused
    - an archived assignment with submissions can't be deleted
    - a module or lesson with assignments can't be deleted until you move the assignments

## Recommended next phase

**Phase 5: student portal.** Lesson completion and progress, continue-learning, a cross-course "my assignments" list built on this phase's derived states, the student dashboard, and demo progress and submissions for the demo students.
