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
npm run seed           # idempotent seed (trainer account for now)
```

- The server tests need a MongoDB at `127.0.0.1:27017`, or one set in `TEST_MONGODB_URI`. `server/tests/setup.js` gives each test file its own throwaway database and empties every collection before each test.
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
- `bcrypt` uses only the first 72 bytes of a password, so password validators cap passwords at 72 bytes on both client and server.
