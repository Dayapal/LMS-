# Phase 2 report: course and roadmap management

Date: 2026-10-14 · Status: **approved**

## Summary

The trainer can now create and manage courses, modules and lessons. Each level has its own draft/published/archived status and its own ordering, and enrollment requests can be approved or declined. Students get a course catalogue and a course page with a roadmap timeline, and can request enrollment.

The server enforces every rule:

- Students see only published content and get 404 for anything else.
- Lesson detail also requires an active enrollment.
- Every content write is trainer-only.

The seed now creates the three starter courses: 38 modules and 108 lessons with real summaries, objectives and time estimates. Re-running it never overwrites trainer edits. Phase 1 authentication is unchanged, and all of its tests still pass.

## Features completed

**Trainer (`/admin/courses`):**

- **Course list:** status tabs (all, published, drafts, archived), search, pagination, plus loading, empty and error states.
- **New course:** a validated form (title, summary, description, level, hours, tags, thumbnail URL). New courses start as drafts.
- **Course builder (`/admin/courses/:id`):**
  - edit course details
  - status actions that depend on the current state: Publish, Unpublish, Archive, Restore as draft
  - delete, behind a confirmation dialog; only offered when the course isn't published
- **Roadmap editor:**
  - add, edit, publish/unpublish and delete modules
  - add, edit and delete lessons, with objectives and prerequisites entered one per line, an estimated time and a status
  - move a lesson to another module
  - reorder modules and lessons with up/down buttons that are keyboard-accessible and have specific screen-reader labels
  - confirmation dialogs before deleting; the server's refusal messages are shown as toasts
- **Students tab:**
  - approve or decline enrollment requests
  - remove enrolled students (with confirmation) and re-enroll them
  - enroll an existing student directly by email

**Student (`/app/courses`):**

- **Catalogue:** published courses with level, enrollment badge, module/lesson counts and total time; search and level filter; loading, empty and error states.
- **Course page:** cover, summary, stats, an enrollment action (Request enrollment, Request pending, Enrolled, or Request to re-join), the description, tags, and a numbered roadmap timeline of published modules and lessons.

**Shared UI:**

- modal with focus trap, Escape to close, and focus returned to the opener
- confirm dialog
- toast notifications, announced to screen readers
- status badges, skeletons, empty and error states, pagination, page header, select field

**Seeds:**

- Course data files for MERN (11 modules), Java Full-Stack (13) and DSA with JavaScript (14).
- Optional demo students (`SEED_DEMO_STUDENT_PASSWORD`) with active and pending enrollments.
- `npm run seed -- --reset` for development only; it is refused when `NODE_ENV=production`.

## Decisions made in this phase

1. **Lesson notes are deferred to Phase 3.** The spec placed seeded notes in Phase 2, but notes are stored as Material documents, which you excluded from this phase. Phase 2 seeds each lesson's structure, summary, objectives, prerequisites and estimated time instead. The spec (§9) is updated.
2. **New `Lesson.summary` field.** A short blurb of up to 300 characters, so the roadmap is informative before materials exist. The spec (§5) is updated.
3. **`Course.thumbnailUrl` (https) for now.** Uploaded thumbnails (FileAsset) come with Phase 3's storage work.
4. **Deletion rules.** These spell out "archive instead of delete", and the spec (§6) is updated. Anything else gets a 409 telling the trainer to unpublish or archive first.

   | Item   | Can be deleted when                                    |
   | ------ | ------------------------------------------------------ |
   | Course | Not published, and no active or pending enrollments    |
   | Module | Neither the module nor any of its lessons is published |
   | Lesson | Not published                                          |

5. **Enrollment (D5) is included.** It's in the Phase 2 API plan and is needed so students can join courses. Lesson detail requires an active enrollment, while the roadmap outline of a published course is visible to every signed-in student.
6. **Reordering uses up/down buttons** instead of drag-and-drop. They work by keyboard and need no new dependency.
7. **The course description is shown as plain paragraphs.** Markdown rendering arrives with the Phase 3 notes renderer.

## Database changes

| Model                                    | Fields                                                                                               | Indexes                                                        |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `Course` (new)                           | title, slug, summary, description, thumbnailUrl, level, estimatedHours, status, tags, createdBy      | unique `slug`; `{status, createdAt}`                           |
| `Module` (new; JS export `CourseModule`) | course, title, description, order, status                                                            | `{course, order}`                                              |
| `Lesson` (new)                           | course, module, title, slug, summary, objectives[], prerequisites[], estimatedMinutes, order, status | `{module, order}`, `{course, status}`, unique `{course, slug}` |
| `Enrollment` (new)                       | user, course, status (pending/active/removed), enrolledBy, enrolledAt, lastLesson, lastAccessedAt    | unique `{user, course}`, `{course, status}`                    |

User and Session are unchanged.

## API endpoints added (`/api/v1`, all require a bearer token)

| Method         | Path                           | Who         | Notes                                                                                                                          |
| -------------- | ------------------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GET            | `/courses`                     | any         | `page`, `limit` (≤ 100), `q`, `level`; `status` (admin only). Students only get published courses, plus their own `enrollment` |
| POST           | `/courses`                     | admin       | 201; draft; unique slug                                                                                                        |
| GET            | `/courses/:id`                 | any         | Includes `stats` (counting only what the viewer can see). 404 for students on unpublished courses                              |
| PATCH          | `/courses/:id`                 | admin       | Partial update; `thumbnailUrl: ""` clears the thumbnail                                                                        |
| PATCH          | `/courses/:id/status`          | admin       | `{ status }`                                                                                                                   |
| DELETE         | `/courses/:id`                 | admin       | 204, or 409 under the deletion rules                                                                                           |
| GET            | `/courses/:id/roadmap`         | any         | The course with its ordered modules and lessons, filtered by role                                                              |
| GET / POST     | `/courses/:id/modules`         | any / admin | POST appends a module (default status draft)                                                                                   |
| PATCH          | `/courses/:id/modules/reorder` | admin       | `{ ids }` must list every module of the course exactly once                                                                    |
| POST           | `/courses/:id/enroll`          | student     | Creates or reopens a pending request; idempotent; 409 if already enrolled                                                      |
| PATCH / DELETE | `/modules/:id`                 | admin       | DELETE also deletes the module's lessons; 409 if published content is inside                                                   |
| GET / POST     | `/modules/:id/lessons`         | any / admin | POST appends a lesson with a slug unique within the course                                                                     |
| PATCH          | `/modules/:id/lessons/reorder` | admin       | `{ ids }` must list every lesson of the module exactly once                                                                    |
| GET            | `/lessons/:id`                 | any         | Students need the lesson, module and course published and an active enrollment                                                 |
| PATCH / DELETE | `/lessons/:id`                 | admin       | PATCH with `moduleId` moves the lesson to the end of another module in the same course                                         |
| GET / POST     | `/admin/enrollments`           | admin       | GET filters by `course` and `status`; POST `{ courseId, email }` enrolls a student directly                                    |
| PATCH          | `/admin/enrollments/:id`       | admin       | `{ status: 'active' \| 'removed' }` approves or removes                                                                        |

## Tests executed (actual results)

| Check            | Command                | Result                                                                       |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------- |
| Server tests     | `npm test -w server`   | **9 files, 115 tests passed** (54 from Phase 1 + 61 new)                     |
| Client tests     | `npm test -w client`   | **6 files, 41 tests passed** (21 from Phase 1 + 20 new)                      |
| Lint             | `npm run lint`         | **0 errors, 0 warnings**                                                     |
| Formatting       | `npm run format:check` | **All files pass**                                                           |
| Production build | `npm run build`        | **Succeeds** (588 kB JS / 182 kB gzip, chunk-size warning; see known issues) |
| Dependency audit | `npm audit`            | **0 vulnerabilities** (no new dependencies added)                            |

**What the new server tests cover:**

- Course CRUD and validation
- Ignoring a client-supplied `status` or `createdBy`
- Literal (regex-safe) search, and pagination
- Stats counted from what each viewer can see
- Status transitions
- Deletion rules for courses, modules and lessons
- Module and lesson creation order and unique slugs
- Reordering, including rejection of missing, duplicate and foreign ids
- Moving lessons, including refusing a move into another course
- Roadmap filtering by role
- 404s for students on every read of draft or archived content
- Lesson access with no, pending or removed enrollment
- 403 on all eight content write endpoints for students
- The enrollment request, approve, remove and direct-enroll flows
- Seed shape, idempotency, preservation of trainer edits, and reset

**What the new client tests cover:**

- Format helpers
- Catalogue loading, empty, error/retry and filter states
- Course page roadmap and enrollment request/pending/enrolled/not-found states
- Admin create-course validation and navigation, and status tabs
- Builder status actions, module and lesson reordering, delete confirmation with the server refusal, and adding a lesson

**Mutation check.** I removed four rules one at a time to confirm the tests catch them. Each removal failed tests, and the full suite passed again after restoring the code:

| Rule removed                        | Tests that failed |
| ----------------------------------- | ----------------- |
| Student check for published courses | 3                 |
| Enrollment requirement for lessons  | 3                 |
| Status filter in `visibleTo`        | 4                 |
| Exact id-set check for reordering   | 1                 |

**Manual browser check** (Playwright against `npm run dev`, through the Vite proxy):

- The trainer's course list shows the 3 seeded courses with their counts.
- In the MERN builder, the trainer added a draft module ("Testing with Jest") and a lesson with two objectives entered one per line, then moved the module up. The new order showed correctly.
- As demo student Kabir:
  - the catalogue showed MERN with **11 modules and 38 lessons**, so the trainer's draft module and lesson were hidden;
  - DSA showed "Request pending";
  - requesting MERN enrollment showed a toast and the "Request sent" state.
- As the trainer, the Students tab listed Kabir's request. Approving it moved him to Enrolled, with a toast.
- At 390 px width the builder wraps correctly.
- `npm run seed -- --reset` recreated the courses and demo students and removed my manual-test edits. With `NODE_ENV=production` it refused to run.

## Known issues and remaining work

1. **Bundle size.** The JS bundle grew to 588 kB (182 kB gzip). Route-level code splitting is planned for Phase 7.
2. **No lesson reader yet.** Students see lesson titles and summaries on the roadmap, but lessons aren't clickable. `GET /lessons/:id` and its enrollment rule exist and are tested; the reader page comes with study materials in Phase 3.
3. **Plain-text descriptions.** Course descriptions are shown as plain paragraphs until the Phase 3 Markdown renderer.
4. **No cancel for requests.** Students can't cancel their own pending request; the trainer can decline it.
5. **Direct enrollment needs an email.** The trainer enrolls by typing an email; a student picker comes with student management in Phase 6.
6. **Deletion checks are incomplete until later phases.** The guards don't yet check submissions or progress, because those models arrive in Phases 4–5. They will be added there.
7. **Demo password is for local use only.** Demo students share one password from `SEED_DEMO_STUDENT_PASSWORD`. Leave it unset in production.
8. **Leftover Phase 1 test account.** `riya.demo@example.com`, created during Phase 1 browser testing, still exists in the local dev database. It has no enrollments.

## Manual testing instructions

1. Optionally add `SEED_DEMO_STUDENT_PASSWORD=<a password with a letter and a number>` to `server/.env`. Then run `npm run seed`, and run it a second time: every line should say "already exists".
2. Run `npm run dev` and sign in as the trainer.
3. **Courses page:** the 3 courses should appear. Try the Drafts tab (empty), search for "java", then click **New course**. Submit it empty to see validation, then create one; you should land on its builder as a draft.
4. **Builder:**
   - add a module and a lesson
   - reorder with the arrows
   - publish the module and the course
   - try deleting a published lesson: a toast explains why it's refused
   - unpublish the lesson, then delete it
5. **Archive and delete:** archive the course. Click Delete: this succeeds if no students are enrolled.
6. **As a student** (register a new one, or use a demo student):
   - the catalogue shows only published courses
   - open a course and request enrollment
   - try opening the URL of the course you archived: "This course is not available"
7. **As the trainer:** open the course's Students tab, approve the request, then remove the student (with confirmation) and re-enroll them.
8. **Enroll by email:** try enrolling a student by email, including an unknown email (inline error) and the trainer's own email (rejected).

## Recommended next phase

**Phase 3: study materials.** Material and FileAsset models; the local storage provider and upload checks; a Markdown notes editor with preview; code snippets with syntax highlighting; PDF resources; the student lesson reader with previous/next navigation; and the seeded notes and code for the three courses.
