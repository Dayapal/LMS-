# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow rules

- The design, data model, permissions matrix, API plan and per-phase acceptance criteria are in `docs/superpowers/specs/2026-10-14-training-lms-design.md`. Read the sections that matter before changing anything.
- Build **one phase at a time**. Implement only the approved phase, then stop for the trainer's review. Each phase ends with:
  - an updated `README.md` status table
  - a report in `docs/phase-reports/phase-N.md`
  - one commit
- Video lessons are out of scope. This is a single-trainer app: don't add tenants or organizations.

## Commands (run from the repository root)

```bash
npm run dev            # API :5000 (node --watch) + Vite :5173 (proxies /api -> :5000)
npm test               # server tests, then client tests
npm test -w server -- tests/auth.test.js -t "rotates"   # single file / single test
npm test -w client -- src/routes/guards.test.jsx
npm run lint           # ESLint for both workspaces (root eslint.config.js)
npm run format:check   # Prettier
npm run build          # client production build
npm run seed           # idempotent: trainer, 3 starter courses, optional demo students
npm run seed -- --reset  # dev only: wipe course data + demo students, then reseed
```

- The server tests need a MongoDB at `127.0.0.1:27017`, or one set in `TEST_MONGODB_URI`. `server/tests/setup.js` gives each test file its own throwaway database and upload directory (in the OS temp folder), empties both before each test, and loads `config/db.js` so `sanitizeFilter` is on in tests too.
- The server reads `server/.env` through `node --env-file-if-exists`; there is no dotenv. `server/src/config/env.js` validates the environment with zod at import time and exports a single mutable `config` object. Tests change `config` (rate limits, refresh grace) and then call `createApp()`.

## Architecture

- **npm workspaces:** `server/` (Express 5, Mongoose 8, ESM) and `client/` (React 19, Vite 8, Tailwind 4, React Router 7 data router, TanStack Query, react-hook-form + zod). Both use JavaScript, not TypeScript.
- **Server layering:** `routes/` → `middleware/` (authenticate, requireRole, validate, verifyOrigin) → thin `controllers/` → `services/` (business rules) → `models/`.
  - `app.js` builds the app without listening; it's used by Supertest. `server.js` connects to the database and listens.
  - Routers are factories that receive the rate limiters, so each `createApp()` gets fresh ones.
- **Responses:** always `{ success, data, meta? }` or `{ success: false, error: { code, message, details? } }`.
  - Throw `ApiError` (from `utils/ApiError.js`). Express 5 forwards async errors to `middleware/errorHandler.js` without any wrapper.
  - Validation errors use `details: [{ path, message }]`. The client's `applyFieldErrors` maps these onto form fields.
- **Validation:** `validate({ body, params, query })` replaces `req.body` with the parsed (stripped) data and puts all parsed parts on `req.valid`. Express 5's `req.query` is read-only, so read query values from `req.valid.query`. Zod objects strip unknown keys, which is how `role`, `isActive` and similar fields from clients are dropped.
- **Auth model (spec §11a):**
  - A 15-minute HS256 access JWT `{ sub, role, tv }` is sent as a bearer header and held in memory on the client (`client/src/services/http.js`).
  - The refresh token is the `lms_rt` httpOnly cookie, scoped to `Path=/api/v1/auth`. It's stored hashed in `Session` and rotated on each `/auth/refresh`. Reusing a rotated token outside a 10 s grace window revokes the whole family.
  - `authenticate` reloads the user on every request. Use `req.user.role`, never the role in the token. A password change bumps `tokenVersion`, which kills every existing access token.
  - Cookie endpoints use `verifyOrigin` (the `CLIENT_ORIGINS` allowlist) as CSRF protection.
- **Course content:**
  - The hierarchy is Course → Module → Lesson, and each level has its own `status` (`draft`, `published` or `archived`).
  - `services/access.service.js` is the only place that decides visibility. Use `getCourseForViewer`, `getModuleForViewer`, `getLessonForViewer` and `visibleTo(user)` instead of writing status checks in other services.
  - Students get 404 for anything unpublished. Lesson detail also requires an active enrollment. The roadmap (titles and summaries) of a published course is visible without enrolling.
  - Writes are admin-only through `requireRole`.
  - Ordering uses an integer `order`. `services/ordering.js` (`nextOrder`, `applyOrder`) appends new items and rewrites the order from a full id list.
  - The deletion guards are in `course.service.js` and `roadmap.service.js`. They reject deleting published content.
- **Materials and files (Phase 3):**
  - A `Material` is one ordered block in a lesson (`note` | `code` | `file` | `link`) with its own status. `material.service.js` rejects payload fields that don't belong to the material's type; the type never changes.
  - Uploads go through `middleware/upload.js` (multer, memory, one `file` part) and then `inspectUpload` in `services/fileRules.js`: extension, declared MIME and magic bytes (`file-type`) must agree. Add new upload purposes to `UPLOAD_RULES` there.
  - Bytes are stored by `services/storage/` (`getStorage()`; only the `local` driver until Phase 8) under random keys. Nothing is served statically: `GET /files/:id` calls `getFileForViewer` in `access.service.js`. Requests without a token get 404 there.
  - Delete files with `deleteFilesIfUnused` / `deleteFilesWhere` (`file.service.js`), never by hand; deleting a course, module or lesson cascades through `deleteMaterialsWhere`.
  - The client fetches files as Blobs (`filesApi.fetch`) because the access token lives in memory; never link to `/api/v1/files/:id` directly.
- **Rendering untrusted content (client):** use `components/content/MarkdownView.jsx` (react-markdown + remark-gfm + rehype-sanitize; raw HTML is never rendered) and `CodeBlock.jsx` (prism-react-renderer). Java and Bash grammars are registered through `languages.js`, which must keep importing `prismGlobal.js` first. `MarkdownView`, the lesson pages and CodeMirror are lazy-loaded to keep the main bundle small.
- **Enrollment (D5):** a student `POST /courses/:id/enroll` creates a `pending` request. The trainer approves it or sets it to `removed` through `/admin/enrollments`, or enrolls a student directly by email.
- **Seeds:** the course roadmaps are data files in `server/src/seeds/data/{mern,java,dsa}.js`. A course is created only when its slug is absent, so reseeding never overwrites trainer edits.
  - Starter materials are Markdown in `server/src/seeds/content/<course slug>.md`, split by `<!-- lesson: -->`, `<!-- code: -->` and `<!-- link: -->` markers (see `materials.seed.js`). That folder is excluded from Prettier so the code examples stay verbatim. A lesson only receives starter materials while it has none.
  - Cheat-sheet PDFs are generated by `seeds/pdf.js` from `seeds/data/cheatsheets.js` and pass through the same `inspectUpload` checks as real uploads.
- **Same-origin API:** the client always calls the relative `/api/v1`. The Vite proxy (dev) and `client/vercel.json` rewrites (prod) forward to the API. Don't hard-code an API host in the client, and don't switch the cookie to `SameSite=None`.
- **Client auth flow:**
  - `AuthProvider` does a silent refresh on load. Its `status` is `loading`, `authenticated` or `anonymous`.
  - The axios interceptor retries once after a single-flight refresh.
  - `RequireAuth roles={[...]}` and `GuestOnly` in `routes/guards.jsx` are UX guards only; the server enforces permissions.
  - Role homes are `/admin` (trainer) and `/app` (student).
  - Sidebar entries come from `layouts/navigation.js`.

## Gotchas

- `mongoose.set('sanitizeFilter', true)` is global. Query operators you write in a filter (`$gt`, `$in`, `$exists`, …) are neutralized unless you wrap them: `{ expiresAt: mongoose.trusted({ $gt: now }) }`. Prefer `field: null` over `{ $exists: false }`. Update operators (`$set`) aren't affected.
- Vitest 5 depends on Vite 8, so the client stays on Vite 8 and `@vitejs/plugin-react` 6. Mixing Vite majors breaks the dev server ("Missing field `moduleType`").
- Bash heredocs on this Windows machine can mangle backslashes in regex literals. Write such files with the editor tools instead.
- TanStack Query passes a context object as the second argument to `mutationFn`. In tests, assert on `mock.calls[0][0]` rather than using `toHaveBeenCalledWith(arg)`.
- Client tests stub the API with `vi.spyOn(coursesApi, 'list')` and so on. Hooks call `coursesApi.*` at run time, so spies work without module mocks. `src/test/renderWithProviders.jsx` provides the query client, router, auth and toast context.
- `bcrypt` uses only the first 72 bytes of a password, so password validators cap passwords at 72 bytes on both client and server.
- On Windows, `node --watch` (used by `npm run dev`) was seen restarting the API right after a helper script read `server/.env` (it watches the `--env-file`). Scripts that need those values while the dev server runs should read a copy.
- jsdom's `Blob` has no `.text()`; read Blobs with `FileReader` in client code that tests exercise (see `features/lessons/api.js`).
