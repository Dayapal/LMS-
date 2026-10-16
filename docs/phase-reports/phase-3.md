# Phase 3 report: study materials

Date: 2026-10-14 · Status: **approved** (2026-10-16, with the known issues below recorded and accepted)

## Summary

Every lesson can now hold an ordered list of study materials: Markdown notes, code examples, files (PDF, DOCX, PPTX) and links. Each material has its own draft/published status.

- **Trainer:** a materials editor per lesson, with a live Markdown preview, a code editor with syntax highlighting, file uploads and a "Preview as student" view.
- **Student:** a lesson reader showing objectives, every published material in order, an inline PDF viewer, and previous/next navigation through the course.
- **Seed:** all 108 starter lessons now have a note, a code example and (for most) links to official docs. Each course also has a generated cheat-sheet PDF.

Files are private. They are only streamed through an endpoint that checks access on every request, and the app fetches them with the signed-in user's token. Uploads are trainer-only, and a file must match on extension, declared type and actual content (magic bytes).

Phase 1 and Phase 2 behaviour is unchanged. All of their tests still pass.

## Features completed

**Trainer:**

- **Materials link:** each lesson row in the course builder has a "Materials" link to `/admin/courses/:courseId/lessons/:lessonId`.
- **Materials editor:**
  - the list of materials with type, title, summary and status
  - reorder with up/down buttons
  - publish/unpublish, edit, and delete (with confirmation)
  - a warning when the lesson itself isn't published
- **Note form:** Markdown with a live preview, side by side on wide screens and Write/Preview tabs on small ones.
- **Code form:**
  - a CodeMirror editor that highlights JavaScript/JSX/TypeScript, Java, SQL, HTML, CSS, JSON and YAML
  - 12 selectable languages, including Bash and plain text, and a caption
  - the editor is loaded only when this form opens
- **File form:**
  - checks the type and size in the browser first, then uploads with a progress bar
  - the server's refusal reason is shown in the form
  - a "Allow students to download" switch
  - you can replace the file when editing
- **Link form:** https only, with an optional description.
- **Preview as student:** the real reader page, with drafts and archived items marked by a badge.

**Student:**

- On the course page, lessons become links once the enrollment is active, and a "Start with …" button opens the first lesson. Students who aren't enrolled still see the outline only.
- **Lesson reader** (`/app/courses/:courseId/lessons/:lessonId`):
  - breadcrumb, "Lesson 5 of 38", estimated time, summary, objectives and prerequisites
  - notes rendered from Markdown, with tables, lists and highlighted code fences
  - code blocks with a language label, caption and a Copy button
  - files: "View PDF" opens an inline viewer (with an "open in a new tab" fallback), and "Download" appears only when allowed
  - consecutive links grouped under "Further reading"
  - previous/next lesson cards that cross module boundaries and skip anything the student can't open
  - focus moves to the new lesson title on navigation
- **Unavailable lessons:** a clear "not available" message, the same for unpublished content and missing enrollment.

**Also:**

- Course descriptions are now rendered as Markdown (Phase 2 known issue 3).
- The form helpers from the Phase 2 forms (`useServerAwareForm`, `FormActions`, `StatusSelect`) are now shared modules, used by both the course and the materials forms.

## Decisions made in this phase

1. **Files are fetched as Blobs, not through public or signed URLs.** The access token lives only in memory (D4), so a plain `<a href>` or `<iframe src>` to the API can't authenticate. The client requests `GET /files/:id` with the bearer token and shows the result from a local `blob:` URL. The PDF viewer always treats the result as `application/pdf`. When the S3 driver arrives in Phase 8, the same endpoint can redirect to a short-lived signed URL.
2. **Requests without a token get 404 on `GET /files/:id`,** as §10's acceptance criterion says ("anonymous users get 404 on files"). A request with an expired or invalid token still gets 401, so the client can refresh and retry. Every other endpoint keeps returning 401 without a token.
3. **`downloadable: false` is a convenience, not protection.** It removes the download button and the `attachment` header. Anyone who can view a PDF can still save it, and the form says so.
4. **Published materials can't be deleted** (409, unpublish first). This matches the Phase 2 rules for lessons and modules. Deleting a lesson, module or course deletes its materials, and each file is deleted with its stored bytes once nothing uses it.
5. **Material files belong to a course.** An upload names its course, and a file can only be attached to materials in that course. This keeps the access rule simple: a file is visible to a student only through a published file material in a lesson they can open.
6. **Seed content is Markdown, not JavaScript.** The notes contain backticks and `${...}`, which are fragile inside JS template literals. `server/src/seeds/content/<course slug>.md` is plain Markdown with HTML-comment markers, readable on GitHub. It is excluded from Prettier so the code examples stay exactly as written.
7. **Seed rule for materials:** a starter lesson receives its starter materials only while it has **no** materials. This means the Phase 2 database got its notes on the next `npm run seed`, and reruns never duplicate or edit anything. The trade-off: if you delete _every_ material of a starter lesson, the next seed run adds the starter set back.
8. **Link materials are included.** They're in the §5 data model and the §9 seed plan ("some lessons also link to official docs"), and the reader shows them as "Further reading".
9. **Uploaded course thumbnails are not included.** Your Phase 3 scope list doesn't mention them, so `Course.thumbnailUrl` stays an https URL. Thumbnails would need a different access rule (visible in the catalogue without enrollment), so they're better done deliberately later.
10. **Local storage only.** The `StorageProvider` interface is in place with a `local` driver. The S3-compatible driver, and the "production refuses `STORAGE_DRIVER=local`" check, arrive together in Phase 8; adding the check now would stop production from starting at all. The spec (§12 risk 3) is updated.
11. **In the code editor, Tab moves focus instead of indenting.** CodeMirror's Tab-to-indent plus Escape-to-leave would clash with the dialog's Escape-to-close and trap keyboard users. Enter still keeps the current indentation.
12. **Lazy loading.** The lesson pages, the Markdown renderer and CodeMirror load on first use. Without this, the main bundle would have grown by about 90 kB gzip; with it, the main bundle is the same size as in Phase 2 (see the results below).
13. **Tests now run with the server's global Mongoose settings.** `tests/setup.js` loads `config/db.js`, so `sanitizeFilter` is on in tests, as in production. Before this change, a missing `mongoose.trusted()` wouldn't have been caught by any test. All Phase 1–2 tests still pass with it on.

## Database changes

| Model             | Fields                                                                                                                                                                                                                   | Indexes                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| `Material` (new)  | lesson, course (copied from the lesson for access checks), type (`note`/`code`/`file`/`link`), title, order, status, plus by type: `body`; `language`, `source`, `caption`; `file`, `downloadable`; `url`, `description` | `{lesson, order}`, `{course}`, `{file}` (sparse) |
| `FileAsset` (new) | provider, storageKey (random), originalName, mimeType, size, checksum (SHA-256), purpose (`material` for now), course, uploadedBy                                                                                        | unique `storageKey`, `{course, purpose}`         |

No existing model changed. Uploaded bytes are stored in `server/uploads/` (git-ignored), or in `UPLOAD_DIR`.

## API endpoints added (`/api/v1`)

| Method | Path                             | Who   | Notes                                                                                                                                                                                           |
| ------ | -------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/lessons/:id/materials`         | any   | Admin: all. Student: published materials only, and only when the lesson, module and course are published and the enrollment is active (404 otherwise)                                           |
| POST   | `/lessons/:id/materials`         | admin | 201. Body depends on `type`; new materials start as drafts and are appended. A `fileId` must be a material file of the same course                                                              |
| PATCH  | `/lessons/:id/materials/reorder` | admin | `{ ids }` must list every material of the lesson exactly once                                                                                                                                   |
| PATCH  | `/materials/:id`                 | admin | Title, status and the fields of the material's own type (fields of other types → 400). Replacing a file deletes the old one if unused                                                           |
| DELETE | `/materials/:id`                 | admin | 204, or 409 when published                                                                                                                                                                      |
| GET    | `/lessons/:id/navigation`        | any   | `{ previous, next, position, total }` across modules, counting only lessons the viewer can open                                                                                                 |
| POST   | `/files`                         | admin | Multipart: `file`, `purpose=material`, `courseId`. 201 with the file's metadata. 400/413 `FILE_REJECTED` with the reason. 30 uploads per trainer per hour                                       |
| GET    | `/files/:id`                     | any   | Streams the file after the access check. `?download=1` gives an `attachment` header when downloads are allowed. `Cache-Control: private, no-store`, `nosniff`, a sandboxing CSP. No token → 404 |

**Upload checks**, in order: trainer role → rate limit → one `file` part of at most 20 MB (multer, in memory) → valid `purpose` and `courseId` → not empty → extension in the allowlist (`pdf`, `docx`, `pptx`) → declared MIME type matches the extension → the content's magic bytes (`file-type`) match too. The client's file name is cleaned (no path, control or reserved characters, at most 200 characters) and kept only as metadata.

## Tests executed (actual results)

| Check            | Command                | Result                                                                                                                                                                                                                                          |
| ---------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server tests     | `npm test -w server`   | **11 files, 190 tests passed** (115 from Phases 1–2 + 75 new)                                                                                                                                                                                   |
| Client tests     | `npm test -w client`   | **10 files, 79 tests passed** (41 from Phases 1–2, one of them reworded; 38 new). Three consecutive runs were all green                                                                                                                         |
| Lint             | `npm run lint`         | **0 errors, 0 warnings**                                                                                                                                                                                                                        |
| Formatting       | `npm run format:check` | **All files pass**                                                                                                                                                                                                                              |
| Production build | `npm run build`        | **Succeeds.** Main bundle 595 kB (184 kB gzip; Phase 2 was 588/182). Lazy chunks: Markdown + Prism 258 kB (80 kB gzip), CodeMirror 650 kB (229 kB gzip), lesson pages 10 kB and 15 kB. The over-500 kB chunk warning remains (see known issues) |
| Dependency audit | `npm audit`            | **0 vulnerabilities**                                                                                                                                                                                                                           |

**New dependencies:**

- server: `multer` 2, `file-type` 22
- client: `react-markdown`, `remark-gfm`, `rehype-sanitize`, `prism-react-renderer`, `prismjs` (for the Java and Bash grammars), `@uiw/react-codemirror` with the JavaScript, Java, SQL, HTML, CSS, JSON and YAML language packages

**What the new server tests cover:**

- **Uploads:**
  - PDF, DOCX and PPTX accepted; stored under a random key with a checksum
  - rejected: HTML disguised as a PDF, a PNG renamed `.pdf`, a PDF renamed `.docx`, a DOCX renamed `.pptx`, a mismatched declared type (`text/html`, `octet-stream`), `.exe`, no extension, an image, an empty file, and over 20 MB (413). Nothing is written to disk for any of them
  - two files, or the wrong field name; an unknown purpose or course
  - students get 403, anonymous users 401; the per-trainer rate limit (429)
  - file name cleaning, including non-ASCII names
- **File access:**
  - an enrolled student gets the PDF inline, uncached and `nosniff`
  - the attachment header follows `downloadable`; UTF-8 file names are encoded in the header
  - 404 for: no token, unknown id, no/pending/removed enrollment, an unpublished material, lesson or module, an archived course, another course's enrollment, unattached files, and another student
  - 401 for an invalid token; 404 when the stored bytes are missing; 400 for a bad id
- **Materials:**
  - create each type; validation of each type (unknown type, empty note, unsupported language, whitespace-only code, http and `javascript:` links, short title, missing `fileId`)
  - only same-course files can be attached; client-supplied lesson, course and order are ignored
  - type-specific updates; other types' fields rejected; the type never changes; replacing a file deletes the old one
  - students see only published materials in order; 404 without access
  - reorder; 409 when deleting a published material; file cleanup on delete, except for files still in use
  - deleting a lesson, module or course cascades to materials and files
  - students get 403 on all four write endpoints
- **Navigation:** skips draft lessons and draft modules, crosses modules, follows module order, includes everything for the trainer, and returns 404 without access.
- **Seed:**
  - the content covers every starter lesson exactly once, each with a note (120–450 words) and a valid code example
  - each cheat sheet points at a real lesson; parser cases
  - all 108 lessons get published materials; three valid PDFs are stored
  - reruns change nothing; Phase 2 databases and renamed lessons are filled; reset removes materials and files

**What the new client tests cover:**

- **Markdown:**
  - GFM tables and nested headings
  - **`<script>`, `<img onerror>`, `<iframe>`, `onclick`, raw and Markdown `javascript:` links all render inert**
  - external links open in a new tab with `noopener`
  - highlighted code fences
- **Code blocks:** Java, Bash, SQL and YAML highlighting; code rendered as text, never HTML; Copy button.
- **Reader:**
  - materials in order, the heading outline, "Further reading"
  - prev/next links; moving to the next lesson and focusing its title
  - the PDF viewer always gets an `application/pdf` blob; download; view-only files
  - file errors, the empty state, the unavailable state, and the trainer preview (badges and preview links)
- **Materials editor:**
  - the list and its summaries; the unpublished-lesson warning; reorder; publish
  - a note with a live preview; required note body
  - code in a chosen language
  - upload then attach, with `downloadable` set
  - client-side rejection of `.exe` and over-20 MB files; the server's rejection reason
  - link validation; server field errors on the right field; editing; delete confirmation with the server's refusal; unknown lesson
- **Files API:** Blob fetch through the bearer client, Blob error bodies turned back into messages, the multipart upload with progress.
- **Course pages:** lesson links only when enrolled, "Start with …", the Markdown description is safe, and the builder's Materials link.

**Mutation check.** I broke each rule below on purpose, one at a time, to confirm the tests catch it. Each break failed tests, and the full suite passed again after restoring the code:

| Rule removed                                     | Tests that failed |
| ------------------------------------------------ | ----------------- |
| Magic-byte (content) check on uploads            | 4                 |
| Lesson/enrollment check for material files       | 6                 |
| "Material must be published" for files           | 1                 |
| Status filter when students list materials       | 1                 |
| Lesson access check when listing materials       | 5                 |
| Trainer-only uploads                             | 1                 |
| 404 for file requests without a token            | 1                 |
| `downloadable` controlling the attachment header | 1                 |
| "Same course" rule when attaching a file         | 1                 |

The Markdown `<script>` test would still pass without `rehype-sanitize`: react-markdown never renders raw HTML on its own. The sanitizer is a second layer.

**Code examples.** I ran every DSA code example and the pure-JavaScript MERN examples in Node, and each printed exactly what its comments claim. One fix came out of this: `fib(90)` exceeds JavaScript's safe-integer range, so the example now uses `fib(70)`. The Java, SQL, Spring and browser/DOM examples were reviewed but **not** compiled or run.

**Manual check in a real browser** (Playwright, `npm run dev`, through the Vite proxy):

- `npm run seed` on the existing Phase 2 database: "added to 38 / 36 / 34 lessons", plus 3 PDFs in `server/uploads/material/`. A second run: "added to 0 lessons".
- Live permission checks against the seeded data, through the proxy, all as expected:
  - Aarav (enrolled in MERN): MERN cheat sheet 200 (`application/pdf`, `private, no-store`, inline), materials 200, navigation 200
  - Aarav: Java cheat sheet and Java materials 404
  - Kabir (not in MERN): MERN cheat sheet 404; anonymous: 404
  - Aarav uploading: 403; the trainer uploading HTML named `.pdf`: 400 "The file content is not a valid .pdf file"
- **As the trainer**, in Flexbox Layouts:
  - typed a note containing `<script>`, a `javascript:` link and a Java fence. The live preview showed formatted text, no script element, the link without an `href`, and Java tokens highlighted (which confirms the Prism setup works under Vite, not just in tests)
  - uploading the fake PDF showed the server's rejection in the form; a real PDF uploaded as view-only
  - "Preview as student" showed the Draft badge, the inline PDF (Chrome rendered the generated cheat sheet, so the PDF writer's output is valid) and "Lesson 5 of 38"
- **As a newly registered student:**
  - the lesson URL showed "not available" before enrollment
  - after enrollment, the roadmap linked each lesson
  - the reader hid the draft note, showed the PDF without a Download button, and focused the title
  - "Next lesson" moved to CSS Grid Layouts (6 of 38)
  - at 390 px width there was no horizontal scrolling
- **Two fixes came out of the browser check:**
  - Markdown headings were visually larger than the material titles above them. They're now one size smaller.
  - Opening a lazy lesson page directly showed React Router's "No HydrateFallback" warning. Those routes now show a loading spinner, and the warning is gone.
- **Cleanup:** I deleted my test materials afterwards. Deleting the published PDF returned 409; after unpublishing it returned 204 and the file left the disk (back to the 3 seeded PDFs).

## Known issues and remaining work

1. **Review the starter content.** I wrote the 108 notes and code examples (about 25,000 words). They're checked for structure, and the JavaScript examples were executed, but please skim the topics you care most about. Everything can be edited in the materials editor.
2. **Orphaned uploads.** The client uploads a file only when the form is saved. If the material save itself then fails, the uploaded file stays stored but unattached: invisible to students and removed when the course is deleted. There's no "unused files" cleanup screen yet.
3. **View-only is not DRM** (decision 3).
4. **PDFs on iPhone/iPad.** Mobile Safari often shows only the first page of a PDF inside a frame. The reader offers "Open it in a new tab" for that case. This was not tested on a real iOS device.
5. **Local storage only until Phase 8.** Production hosting needs the S3-compatible driver; uploads on a PaaS disk would be lost on redeploy.
6. **Bundle size.** The main bundle is back to Phase 2 size, but it and the CodeMirror chunk are still over Vite's 500 kB warning. Route-level splitting is planned for Phase 7.
7. **Seed re-adds content to emptied starter lessons** (decision 7).
8. **No virus scanning.** Uploads are type-checked but not scanned. That's acceptable while only the trainer can upload, but worth revisiting before students upload files (Phase 4).
9. **No material counts in the course builder.** The trainer opens each lesson to see its materials.
10. **Dev-server restarts.** While testing, `node --watch` restarted the API right after my helper script read `server/.env`, and again while Vite re-optimised the new dependencies. It recovered within seconds. This affects development only, and is noted in CLAUDE.md.
11. **Leftover test account.** `phase3.tester@example.com`, a student created during the browser check and enrolled in MERN, still exists in the local dev database.

## Manual testing instructions

1. Run `npm install`, then `npm run seed`. It should report "added to 38 / 36 / 34 lessons" the first time and "added to 0 lessons" when run again. The PDFs appear in `server/uploads/material/`.
2. Run `npm run dev` and sign in as the trainer. Open **Courses → Full-Stack MERN Development**, and click **Materials** next to any lesson.
3. **Add note:** type some Markdown and watch the preview update. Try `<script>alert(1)</script>`: nothing runs, and it doesn't appear in the preview.
4. **Add code:** pick Java or SQL and check the highlighting.
5. **Add file:**
   - try a `.txt` or `.exe` file (refused in the browser)
   - try a text file renamed to `.pdf` (refused by the server, with the reason shown)
   - then upload a real PDF and untick "Allow students to download"
6. Reorder with the arrows, publish your new materials, then click **Preview as student**. Use **View PDF** and the previous/next cards.
7. **As a demo student** (set `SEED_DEMO_STUDENT_PASSWORD` in `server/.env`, then sign in as `aarav.demo@example.com`):
   - open MERN; lesson titles are links
   - open the lesson you edited: drafts are hidden, and the view-only PDF has no Download button
   - use **Next lesson** across a module boundary
8. **Still as Aarav,** paste the URL of a Java lesson (copy it from the trainer's preview and change `/admin/courses/` to `/app/courses/`, dropping `/preview`). You should see "This lesson is not available".
9. **Files without signing in:** while signed in as Aarav, copy a file id from the Network tab (the `/api/v1/files/<id>` request when viewing a PDF). Then open `http://localhost:5173/api/v1/files/<id>` in a private window: the response is a 404 JSON error, not the file.
10. **Cleanup rules:** delete a published material (refused, unpublish first). Then unpublish it and delete it: if it was a file, it disappears from `server/uploads/material/`.

## Recommended next phase

**Phase 4: assignments.** Assignment and Submission models, link validation, PDF and code submissions (reusing this phase's upload pipeline with a `submission` purpose and owner-only access), editing and attempt rules, late policy, an admin assignment editor, and the student submission page with history.
