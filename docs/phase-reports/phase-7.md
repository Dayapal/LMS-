# Phase 7 report: notifications, performance, accessibility and polish

Date: 2026-10-17 · Status: **approved** (2026-10-17, with the verification results, the decisions under "Decisions recorded at approval" and the known issues below accepted)

Final results: 530 server tests and 203 client tests passed; lint and formatting clean; production build successful with no chunk over 500 kB; `npm audit` 0 vulnerabilities. Live API checks: 17 of 18 passed on the first run. The 18th expected a "due soon" reminder immediately and failed because of the 5-minute check interval; the delayed reminder was verified about 5 minutes later (see "Tests executed"). A browser walkthrough at 1280 px and 390 px passed. See "Tests executed" for the exact runs.

## Summary

- **Notifications.** A bell with the unread count in the sidebar (and in the phone top bar) opens the latest six; a full page per role lists them all with an Unread filter. Students hear about newly published materials and assignments, reviews and resubmission requests of their work, and assignments due within 24 hours. The trainer hears about every new attempt. The count is polled once a minute, as decision D6 says.
- **Permission audit.** A test suite calls all 68 endpoints as an anonymous visitor, a student and the trainer, and fails when a new endpoint has no row in it.
- **Performance.** Every page is now lazily loaded. The JavaScript loaded at startup fell from 617 kB to 435 kB (192 kB → 140 kB gzip); the 650 kB CodeMirror chunk is gone (the editor's grammars load per language). Course list rows no longer carry the course's Markdown description. The notification queries read their indexes in order.
- **Accessibility and responsive layout.** Focus management on navigation, in the mobile menu, the bell and dialogs; real keyboard tabs; tab titles per page; reduced motion; error boundaries for pages that fail to load; contrast fixes; no sideways scrolling on any of the 21 pages at 390 px.
- **The reported toast issue is fixed.** Marking a lesson complete reports the result inside the completion panel instead of a toast, and toasts moved to the top of the screen, where they can't cover the bottom-of-page controls (lesson navigation, pagination, form buttons).

## How this matches the approved plan

Spec §10 lists Phase 7 as "Notification model, triggers, bell + list, deadline-soon job (on-request check or a daily `node-cron` task); permission audit; accessibility pass (labels, focus, contrast, keyboard); responsive review; skeletons, empty states and error states everywhere; index review". §7 lists the four notification endpoints and D6 the 60-second poll.

| §10 acceptance criterion                                       | Where it is shown                                                                                                                                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notifications fire for every event in §5                       | `notifications.test.js`: one block per type (`material_published`, `assignment_published`, `submission_reviewed`, `resubmit_requested`, `deadline_soon`, `submission_received`), each also checked live |
| The permission-audit test suite (every endpoint × role) passes | `permission-audit.test.js`: 68 endpoints × 3 callers, plus the route-file completeness check                                                                                                            |
| No obvious accessibility issues on key pages                   | The fixes below, their tests, and the keyboard and 390 px browser checks. No screen reader or automated (axe) audit was run; see known issues                                                           |

Your list for this phase:

| Your item                                   | Where                                                                                                                         |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A. Bundle warnings, route splitting         | `routes/routes.jsx` (every page lazy), page-group modules, `CodeEditor.jsx` grammars per language; measurements below         |
| A. Loading boundaries and errors            | `hydrateFallbackElement` per page, a loading bar during client navigation, `RouteErrorPage` boundaries                        |
| A. Requests, renders, queries, responses    | One poll per tab, cache updates instead of refetches, list rows without descriptions, `_id` added to the notification indexes |
| B. Accessibility audit and fixes            | See "Accessibility changes"                                                                                                   |
| B. Toast over the lesson reader's Next link | Inline completion result; toasts at the top, paused on hover and focus                                                        |
| B. Desktop and 390 px                       | Browser walkthrough; a dashboard overflow found and fixed for every single-column grid                                        |
| C. Notifications                            | New model, service, routes, client bell and page                                                                              |
| D. Phase 7 known issues and access recheck  | Page cap on the older lists (Phase 6 #5), permission audit, bundle size (Phases 1–6), toast (Phase 5 #3)                      |

There was no Notification model yet (the spec described it; nothing was built before this phase), so it is new. Nothing that already worked was rebuilt: notifications reuse the authentication middleware, the access service's visibility rules, the student's own assignment rows (for deadlines), the Phase 6 filter buttons and the existing UI components.

## Decisions made in this phase

1. **One notification per event and person.** A `key` names the event and `{user, key}` is unique, so publishing again, double clicks and concurrent requests never duplicate.
2. **Content notifications need visibility at publish time.** A material or assignment notifies when it moves to published and students can already see it. Publishing a lesson, module or course later (which reveals content that was published inside it) sends nothing. The spec lists no lesson/course event; see known issues.
3. **Reviews keep one notification per attempt.** A review and a resubmission request on the same attempt share a key: the latest decision replaces the earlier one and becomes unread again. The text names the assignment and attempt, never marks or feedback.
4. **"Due soon" is checked on request,** one of the two options in §10, not with a `node-cron` job (no new dependency, nothing to run when nobody is signed in). It runs when a student reads their count or list, at most every 5 minutes per student, for published assignments due within 24 hours that they haven't handed in and can still submit. A requested resubmission has no deadline, so no reminder. Moving a due date reminds again.
5. **The trainer is told about every new attempt,** not about edits.
6. **Polling** (D6): once per tab, only while it's visible, also on returning to the tab. Marking read updates the badge from the response, so it needs no extra request. When a poll finds more unread than before, an open list refreshes.
7. **Notifications never fail the action,** like the activity log. Seeding sends none; `seed --reset` deletes them.
8. **Toasts moved to the top** (below the phone top bar). Bottom-of-page controls are what people use right after an action; the result of marking a lesson complete is shown next to the button.
9. **Filter buttons are not tabs.** The course list's and the Students tab's status filters were `role="tab"` without tab panels; they now use the Phase 6 filter buttons (`aria-pressed`). Only the course builder's sections are real tabs.
10. **Course list rows leave out `description`** (up to 10,000 characters of Markdown each). No list showed it; the trainer's course filters fetch 100 courses at a time. The single-course endpoints still return it.
11. **Every page is lazy,** including sign-in and the student dashboard, so returning signed-in users don't download the form libraries (zod and react-hook-form, 128 kB) until a form page needs them.

## Decisions recorded at approval (2026-10-17)

1. **Notifications stay limited to the six event types of spec §5.** No course, module or lesson publishing notifications and no enrollment request or approval notifications in this phase (known issues 1 and 2).
2. **Axios stays.** The token-refresh flow is not refactored only to make the startup bundle smaller (known issue 5).
3. **Phase 8 work:** a screen reader pass and an axe scan, and checks in Safari, Firefox and on real devices (known issues 6 and 8).
4. **The 5-minute reminder-check interval is accepted,** with the delivery delay described below.

## "Due soon" reminder-check interval and delivery delay

- **How it works:** reminders are worked out when a student's app asks for the unread count (every 60 s while the tab is visible, and on returning to the tab) or opens the list. For each student this runs at most once every 5 minutes (`config.notifications.deadlineCheckIntervalMs`, 300,000 ms; tests set it to 0).
- **Why:** the check reads all of the student's visible assignments and their latest attempts, about six database queries. Running it on every 60-second poll would multiply the cost of polling for no practical gain.
- **Delay to expect:**
  - a reminder appears up to about 5 minutes (plus up to one 60-second poll) after an assignment comes within 24 hours of its due date, or after a newly published assignment is already that close, provided the student has the app open;
  - a student who isn't using the app gets the reminder the next time they open it, as long as the assignment is still due in the future and not handed in. If they first open the app after the due date, there is no "due soon" reminder (the assignment then shows as overdue on their pages);
  - there is no email or push delivery.
- **Seen in the live check:** right after the assignment was published, Aarav's reminder was held back because his check had run seconds earlier; about 5 minutes later Neha's reminder was there.
- **Several API instances:** the interval is remembered per server process, so each instance may check on its own. The unique key still prevents duplicates.

## Database changes

| Model                | Change                                                | Indexes                                                                                                  |
| -------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Notification` (new) | user, type, key, title, body, link, readAt, createdAt | unique `{user, key}`; `{user, readAt, createdAt, _id}`; `{user, createdAt, _id}`; TTL `{readAt}` 90 days |
| constants            | `NOTIFICATION_TYPES` (the six types of spec §5)       | —                                                                                                        |

No migration is needed: the collection starts empty and Mongoose creates the indexes.

**Index check** (live `explain` on the seeded check database): the unread count, the full list and the unread list all use their index in sort order. The first run showed an in-memory sort for both lists (the `_id` tie-breaker wasn't in the index, and the full list even picked the dedupe index); adding `_id` fixed it.

## API changes (`/api/v1`, bearer token, any role, own notifications only)

| Method | Path                          | Notes                                                                                                 |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| GET    | `/notifications`              | `status` (`all`/`unread`), `page` (1–10,000), `limit` (1–50, default 20). Newest first. `meta.unread` |
| GET    | `/notifications/unread-count` | `{ count }`. For students, also runs the "due soon" check (at most every 5 minutes)                   |
| PATCH  | `/notifications/:id/read`     | Marks one read (the first read time is kept). Someone else's or unknown id: 404. `meta.unread`        |
| PATCH  | `/notifications/read-all`     | `{ updated }`, `meta.unread: 0`. The body is ignored                                                  |

Notification: `{ id, type, title, body, link, read, readAt, createdAt }` (no user id or key).

**Changed:**

- every list endpoint now refuses `page` above 10,000 with a 400 (before: a 500 from MongoDB on the Phase 2–5 lists)
- `GET /courses` rows no longer include `description`

The existing actions also send notifications: material create/update, assignment create/update, submission create, review and resubmission request.

## Performance measurements

Production build (`npm run build`), sizes as reported by Vite:

| What                                   | Before (Phase 6)                | After (Phase 7)                                                                          |
| -------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| JavaScript at startup (signed-in user) | 617 kB (192 kB gzip), 3 files   | **435 kB (140 kB gzip)**, 3 files                                                        |
| Largest chunk                          | 650 kB (CodeMirror, everything) | 425 kB (startup)                                                                         |
| Chunks over 500 kB (Vite warning)      | 1                               | **0**                                                                                    |
| CodeMirror when a code field opens     | 650 kB in one chunk             | 102 kB editor + 308 kB core + 85 kB JavaScript grammar; others on demand (Java 48 kB, …) |
| Forms (zod, react-hook-form)           | in the startup bundle           | 128 kB chunk, with the first form page                                                   |

What's left at startup (source maps): react-dom 207 kB, react-router 95 kB, axios 50 kB, TanStack Query 35 kB, and 37 kB of app shell (layouts, guards, contexts, the bell).

**Seen in the browser:**

- the anonymous sign-in page loads the shell plus the sign-in chunk and the form libraries
- a client navigation to Courses fetched that page's chunks once; going back to Reports fetched nothing
- opening "Add code" loaded the editor and the JavaScript grammar; choosing Java loaded only the Java grammar
- over 62 s on one page: exactly 2 unread-count requests (at load and at 60 s), although the layout has two bells

**Payload:** on the seeded data, `GET /courses?limit=100` is 1,582 bytes instead of 3,138. With 100 courses of 10,000-character descriptions it would be about 1 MB smaller.

**Not done:** React render profiling (no slowness was seen); see known issues for axios.

## Client changes

- **Routing** (`routes/routes.jsx`): every page lazy with a tab title and a loading fallback; `RouteErrorPage` boundaries per area and inside the layout, so the sidebar stays usable when a page fails. A page whose file can't be fetched offers **Reload**.
- **Page groups:** `features/auth/pages.js`, `features/courses/admin/pages.js`, `features/courses/student/pages.js` (with the student dashboard), plus the existing assignment, lesson and trainer groups.
- **Layout** (`DashboardLayout.jsx`):
  - the bell in the sidebar and the phone top bar, fed by one poll
  - focus moves to `main` after each navigation (not on the first load)
  - `main` is focusable for the skip link and `aria-busy` while a page loads
  - a loading bar and a polite "Loading page" announcement during client navigation
  - new notifications announced politely
  - the mobile menu keeps focus inside and returns it
  - `ScrollRestoration`
- **Notifications** (`features/notifications/`): `api.js`, `NotificationBell`, `NotificationItem`, `NotificationsPage`, `format.js`.
- **Shared:** `hooks/useFocusTrap.js` (also used by `Modal`), `hooks/useDocumentTitle.js`, `components/ui/Tabs.jsx`, `components/ui/FilterPills.jsx` (moved from the trainer pages, re-exported there), `pages/RouteErrorPage.jsx`.

## Accessibility changes

- **Focus:** after navigation, in the mobile menu (it had no trap or focus return), in the bell's panel (Escape and outside click close it and return focus), after "Mark as read" removes its button (focus moves to the row).
- **Keyboard:** course builder tabs follow the tabs pattern (arrow keys, Home/End, one tab stop, focusable panel).
- **Names and roles:** the bell's name includes the count ("Notifications, 2 unread"); unread items say "(unread)"; status filters are labelled toggle groups instead of tabs without panels; the toast's "Dismiss notification" became "Dismiss message" to avoid confusion with notifications.
- **Announcements:** toasts announce successes politely (one status region) and errors as alerts, instead of nesting live regions; the lesson completion result is a status inside its panel; new notifications and page loading are announced.
- **Timing:** toasts pause while hovered or focused.
- **Forms:** a field keeps its hint visible next to an error, and is described by both (error first); text areas and selects now say when they're required.
- **Contrast:** lesson and module numbers on the roadmap, the course page and the materials editor were `slate-400` on white (about 2.6:1); now `slate-500` (about 4.8:1).
- **Page titles:** every page names the browser tab ("Course builder · Training LMS").
- **Motion:** with "reduce motion", spinners, skeleton pulses and transitions stop.
- **Layout:** every grid that has one column on phones now says so (`grid-cols-1`). Without it, a long truncated title widened the student dashboard by 22 px at 390 px.

## Files

**New (server):** `models/Notification.js`, `services/notification.service.js`, `services/deadlineReminders.js`, `controllers/notification.controller.js`, `routes/notification.routes.js`, `validators/notification.validators.js`; tests `notifications.test.js`, `permission-audit.test.js`.

**Changed (server):**

- `config/env.js` (`notifications` settings), `models/constants.js`, `models/index.js`, `routes/index.js`
- services: `access.service.js` (`lessonOpenToEnrolledStudents`), `material.service.js`, `assignment.service.js`, `submission.service.js` (notification calls), `course.service.js` and `serializers.js` (list rows)
- validators: `content.validators.js` (page cap), `admin.validators.js` (uses it)
- `seeds/course.seed.js` (reset clears notifications)
- tests: `courses.test.js` (+1)

**New (client):** `features/notifications/*`, `components/ui/{FilterPills,Tabs}.jsx`, `hooks/{useFocusTrap,useDocumentTitle}.js`, `pages/RouteErrorPage.jsx`, three `pages.js` groups; tests `Notifications.test.jsx`, `DashboardLayout.test.jsx`, `routes.test.jsx`, `A11yComponents.test.jsx`.

**Changed (client):** `routes/routes.jsx`, `layouts/{DashboardLayout,AuthLayout}.jsx`, `context/ToastContext.jsx`, `components/ui/{Modal,FormField}.jsx`, `components/content/CodeEditor.jsx`, `components/Icon.jsx`, `index.css`, `pages/NotFoundPage.jsx`, `features/lessons/LessonReaderPage.jsx`, `features/progress/format.js`, `features/courses/admin/{AdminCoursesPage,CourseBuilderPage,EnrollmentsPanel,RoadmapEditor,ContentForms,CourseFormModal}.jsx`, `features/trainer/components/TrainerParts.jsx`; grid columns or contrast in `features/courses/student/{CourseCatalogPage,CourseDetailPage}.jsx`, `features/dashboard/StudentDashboardPage.jsx`, `features/assignments/admin/{AssignmentEditorPage,SubmissionReviewPage}.jsx` and `features/lessons/{admin/LessonMaterialsPage,admin/MaterialForms,components/MaterialBlock}.jsx`.

**Changed tests (intended):**

- `AdminCourses.test.jsx` clicks the "Drafts" filter as a button instead of a tab (decision 9)
- `LessonReader.test.jsx` now also checks that the completion result is inside the panel and appears once

**Docs:** this report, `README.md` (status, notifications, performance and accessibility), the spec (status, §4, §5 Notification as built, §7, §10), `CLAUDE.md` (notifications, audit, routes and accessibility conventions, two gotchas).

## Tests executed (actual results, 2026-10-17)

| Check            | Command                | Result                                          |
| ---------------- | ---------------------- | ----------------------------------------------- |
| Server tests     | `npm test -w server`   | **25 files, 530 tests passed** (424 + 106 new)  |
| Client tests     | `npm test -w client`   | **22 files, 203 tests passed** (151 + 52 new)   |
| Lint             | `npm run lint`         | **0 errors, 0 warnings**                        |
| Formatting       | `npm run format:check` | **All files pass**                              |
| Production build | `npm run build`        | **Succeeds, no chunk over 500 kB.** Sizes above |
| Dependency audit | `npm audit`            | **0 vulnerabilities.** No new dependencies      |

**New server tests:**

- **Notifications (26):**
  - every event type with its recipients: active enrollments only (not pending, removed, inactive, other courses or the trainer)
  - no notification for content students can't see (draft lesson, module or course)
  - no duplicates on republishing or edits
  - one notification per attempt for reviews, refreshed and unread again; no marks or feedback in the text
  - the trainer told about new attempts, not edits; inactive trainers skipped
  - "due soon": not for submitted, resubmission-requested, later, past, draft or other-course work; not repeated; again after the due date moves; at most once per interval; never for the trainer
  - endpoints: own list only, newest first, filters, paging and `meta.unread`; mark read (first read time kept, someone else's or the trainer's attempt 404, unknown 404, malformed 400); read-all only the caller's; 401 without a token; invalid parameters 400; brackets never become operators; empty list
  - a failing write doesn't fail the review or submission; the indexes exist
- **Permission audit (79):**
  - the matrix equals the routes declared in the route files (68)
  - each endpoint as anonymous, student and trainer (401 / 403 / allowed, never a 500)
  - a deactivated account is treated as no account
  - one student gets 404 for another's submission (read and edit), its PDF and their notifications, and sees none of them in their own lists
  - all eight paginated lists refuse page 10,001 and `1e15` with a 400 and accept 10,000
- **Courses (+1):** list rows without `description`; the course itself has it.

**New client tests:**

- **Notifications (13):** bell label and badge cap; only in-app links; one poll for two bells, again after 60 s, with the polite announcement; the panel (focus on open, Escape returns focus, outside click closes); opening an item marks it read and navigates; mark all; error with retry; a poll that finds more refreshes the open list; the page (filters, paging, mark one with focus kept, mark all, empty and error states).
- **Layout (4):** tab title and focus after navigation (not on first load); skip link target; loading state during a slow page; mobile menu focus trap and return.
- **Routes (30):** all 26 pages are lazy, resolve to a component, have a title and a fallback; every area has an error boundary; the "couldn't be loaded" and "something went wrong" screens inside the layout.
- **Components (5):** toasts (polite vs alert, pause on hover, dismiss), tabs keyboard pattern, form field hint and error description.

**Mutation check.** I broke each rule below on purpose, one at a time, ran the related tests, and restored the code (a script did each step). Every break failed at least one test:

| Rule removed                                     | Tests that failed |
| ------------------------------------------------ | ----------------- |
| Recipients: active enrollments only              | 4                 |
| Material: only when students can open the lesson | 3                 |
| Publish events notify once (no refresh)          | 1                 |
| Mark read: own notifications only                | 1                 |
| Read all: own only                               | 1                 |
| Trainers must be active                          | 1                 |
| Due soon: not handed in only                     | 2                 |
| Due soon: throttled                              | 1                 |
| Due soon: students only                          | 1                 |
| Audit: `POST /courses` trainer-only              | 2                 |
| Audit: a new route without a row                 | 1                 |
| Page cap on the older lists                      | 8                 |
| Course list rows without description             | 1                 |
| Client: poll every 60 s                          | 1                 |
| Client: only in-app links                        | 2                 |
| Client: Escape returns focus to the bell         | 1                 |
| Client: reader shows the result in the panel     | 2                 |
| Client: focus moves to the page after navigation | 1                 |
| Client: mobile menu focus trap                   | 1                 |
| Client: tab arrow keys                           | 1                 |
| Client: toast pauses on hover                    | 1                 |

"Due soon: not handed in only" first survived: submitted work was already excluded by another condition. The case where the rule matters (a requested resubmission) is now in the test. My first probe of the reader change didn't really remove the message; a second probe that did failed 2 tests.

**Live check against a running API** (a freshly seeded throwaway database, `lms_phase7_check`, with its own environment file; your development database and `server/.env` were not used). The production build was served by `vite preview`, which forwards `/api` like the Vercel rewrite. Checks over HTTP:

- the fresh seed has no notifications
- a published material reached Aarav and Neha, not Kabir (not enrolled in MERN); republishing added none
- a published assignment reached them; Aarav's submission reached the trainer with the review link; the review reached Aarav without marks or feedback in the text
- Aarav got 404 marking Neha's notification; anonymous 401; a student 403 on the review queue
- mark one, read-all (Aarav only), the unread filter, and the page cap on `/courses`
- **Result: 17 of 18 passed on the first run.** The failure: I expected Aarav's "due soon" reminder right after publishing an assignment due in 6 hours. His reminders had been worked out a few seconds earlier, so the 5-minute check interval (decision 4) held it back. The check's expectation was wrong, not the code. **Verified afterwards:** about 5 minutes later, Neha (who hadn't handed in) had the reminder, and Aarav (who had) had none.

**Browser walkthrough** (Playwright, Chromium, the same build and database):

- **1280 px, Neha:** the bell read "Notifications, 2 unread"; the panel opened with focus on its heading; Escape closed it and focus was back on the bell. By keyboard only (Enter, Tab, Enter) she opened the material notification: the lesson loaded, the badge went to 1, focus was on the lesson title.
- **Toast fix:** "Mark as not completed" and "Mark as complete" showed the result in the panel ("Lesson completed. 7% · 3 of 38 lessons completed."), no toast appeared, and four points of the "Next lesson" link were all clickable.
- **390 px:** 8 student and 13 trainer pages, each with its tab title. The student dashboard first scrolled sideways by 22 px (a long "Up next" title); after the grid fix, **all 21 had 0 px**. The trainer's bell panel fit on screen (352 px); following "New submission" opened the review page and cleared the badge. Signing out through the mobile menu worked.
- **Found and fixed during the walkthrough:**
  - Playwright couldn't click a notification link: the hidden "Unread:" text sat a pixel outside the link and was its first piece. People could click it, but the Phase 8 end-to-end tests would trip over it, so the hidden text now comes after the title ("… (unread)").
  - The dashboard overflow and the index sort described above.
- **Keyboard and motion:** course builder tabs (ArrowRight selected Assignments, End selected Students, Tab moved into the panel); with reduced motion, animations last 0.01 ms instead of 1 s.
- **Requests:** see "Performance measurements".
- **Console:** only the expected 401 from the silent refresh on the first anonymous page load.
- **Cleanup:** both servers stopped, the throwaway database dropped, its upload folder, my screenshots and this session's Playwright files deleted. Older files in `.playwright-mcp/` (git-ignored) were left alone.

## Known issues and remaining work

**New in this phase:**

1. **Publishing a lesson, module or course doesn't notify** (decision 2). Content published inside a draft lesson reaches students silently when the lesson is published. **Decided at approval:** not added in this phase; notifications stay with the spec's six types.
2. **Enrollment decisions don't notify.** Students aren't told when a request is approved or declined, and the trainer isn't told about new requests (the dashboard shows them). **Decided at approval:** not added in this phase.
3. **"Due soon" depends on the student using the app** and can arrive about 5 minutes late. See "Due soon reminder-check interval and delivery delay".
4. **Notifications are snapshots.** Titles are copied when sent. A notification whose content was later unpublished, or whose course was deleted, opens that page's normal "not available" state; it isn't removed.
5. **The startup bundle is now almost all libraries.** Replacing axios with `fetch` would save about 50 kB, but it would change the token-refresh interceptor that every request depends on. **Decided at approval:** axios stays; the token-refresh flow isn't refactored only for bundle size.
6. **No screen reader or automated accessibility audit.** Checks used the accessibility tree, keyboard tests and contrast arithmetic for the changed colours. **Outstanding Phase 8 work:** an NVDA or VoiceOver pass and an axe scan.
7. **Toasts at the top of a phone screen** cover the page title area for 3.5 s, which is better than covering controls but still covers text. On desktop they are centred over the content area; by the layout's widths that keeps them clear of the page actions on the right, but I didn't measure that in the browser.
8. **Browser coverage is one engine** (Chromium, 1280 px and 390 px emulation). Safari, Firefox and a real phone weren't tried. **Outstanding Phase 8 work.**

**Resolved from earlier phases:**

- Bundle size and the over-500 kB warning (Phases 1–6)
- toasts covering the bottom-right controls for 3.5 s (Phase 5 #3)
- older lists accepting huge page numbers (Phase 6 #5)
- "Phase 7 not started" (Phase 6 #11)

**Carried over (unchanged):**

- Phase 6: the activity log starts at Phase 6; seeded activity order; "signed in" is the last password sign-in; scale assumptions (queue grouping, filters, 25 recent assignments); course report totals per page; the first 100 courses in the course filters; enrolling by email on the course's Students tab
- Phase 5: no seeded overdue demo; courses with completions can only be archived; demo progress comes back after a full un-complete and reseed; the narrow lesson-deletion race; dashboards reflect the moment they were loaded
- Phase 4: no virus scanning; links not checked for reachability; no per-student extensions; a penalty change doesn't recompute final marks; orphaned handouts
- Phase 3: PDFs on iOS; local storage only until Phase 8
- Phase 1: the `TRUST_PROXY` hop count and the Vercel rewrite URL (Phase 8); the expected 401 on anonymous page loads
- Tests: the occasional unmocked request in `AdminCourses.test.jsx` and the jsdom "navigation not implemented" message; neither fails a test

## Manual testing instructions

1. Run `npm run seed` (with `SEED_DEMO_STUDENT_PASSWORD` set), then `npm run dev`.
2. **Content notifications:** as the trainer, add a published note to a published MERN lesson, and a published MERN assignment due in a few hours. Sign in as Aarav: the bell shows 2; open it, then open the material (it's marked read and the lesson opens).
3. **Due soon:** as Neha, wait up to 5 minutes and reload: "Due soon" appears for the new assignment.
4. **Submissions and reviews:** as Aarav, hand in the assignment; as the trainer, the bell shows "New submission" and opens the review page. Review it; Aarav sees "Feedback on …". Request another attempt on it: his notification changes to "New attempt requested" and is unread again.
5. **Notifications page:** **View all notifications**, the Unread filter, **Mark as read** and **Mark all as read**.
6. **Lesson reader:** mark a lesson complete; the result appears in the completion panel, and **Next lesson** is never covered.
7. **Keyboard:** Tab from the top of a page: the first stop is "Skip to content". In the course builder, use the arrow keys on the Roadmap / Assignments / Students tabs. On a phone-sized window, open the menu: Tab stays inside, Escape closes it.
8. **Mobile:** at about 390 px, no page scrolls sideways; the bell is in the top bar.
9. **Performance:** `npm run build` shows no chunk over 500 kB; in the browser's network tab, the code editor and each grammar load only when a code field opens.
10. **Permissions:** `npm test -w server -- tests/permission-audit.test.js`.

## Commit

Committed locally on `main` as `feat: Phase 7 performance accessibility notifications polish`, on top of `3a77bf1`. Not pushed. The approval changed documentation only (this report, `README.md` and the spec), so the checks above were not rerun.

## Recommended next phase

**Phase 8: testing and deployment.** Playwright end-to-end tests of the critical flows against a production build, the S3-compatible storage driver, environment and deployment documentation, the `TRUST_PROXY` hop count, plus a screen reader pass and an axe scan.
