# Phase 1 report: foundation and authentication

Date: 2026-10-14 · Status: **approved**

## Summary

Phase 1 sets up the monorepo (npm workspaces, ESLint, Prettier), a validated environment config, the MongoDB connection, security middleware, one consistent error and response format, and the full authentication system: registration, login, rotating refresh sessions, logout, profile and password changes, and role-based access. The client has a React app shell with role-guarded routes, auth pages, a responsive dashboard layout and a profile page.

## Features completed

- **Student registration.** The role is always `student`, and any role or privileged fields sent by the client are ignored. Emails are normalized. Passwords need 8–72 bytes with a letter and a number, and are hashed with bcrypt (cost 12).
- **Login.** Wrong password and unknown email get the same generic error, and an unknown email still runs a bcrypt compare so response timing doesn't reveal which accounts exist. Disabled accounts are refused.
- **Sessions:**
  - A 15-minute access JWT kept in memory.
  - A 7-day httpOnly refresh cookie (`Path=/api/v1/auth`, `SameSite=Lax`, `Secure` in production), stored hashed and rotated on every use.
  - Reusing an old refresh token revokes that login family. A 10 s grace window covers two tabs refreshing at once.
  - Logout revokes the server session, clears the cookie and signs out other tabs.
- **Role-based access.** `authenticate` + `requireRole` use the role stored in the database, re-checked on every request. Deactivation, role changes and password changes take effect immediately.
- **Profile.** Users can edit their name, bio and an https avatar URL. Changing the password requires the current password, signs out all other devices and keeps this one signed in.
- **Security:**
  - helmet headers
  - CORS limited to an allowlist, with credentials
  - an Origin check (CSRF guard) on the cookie endpoints
  - a 1 MB JSON body limit
  - rate limits: 10 per 15 min for credential endpoints, 60 for refresh, 300 overall
  - Mongoose `sanitizeFilter`
  - secrets kept out of the logs
- **Trainer account seed.** Idempotent: it never overwrites an existing account and refuses to promote an existing student.
- **Client:**
  - silent session restore on page load
  - an axios interceptor that runs a single shared refresh and retries the request
  - route guards for `/admin` (trainer) and `/app` (student)
  - post-login redirects that only go to pages the user's role can open
  - accessible forms with labels, `aria-invalid`, error text and server errors mapped onto the right fields
  - a responsive sidebar with a mobile drawer and a skip link
  - a 404 page

## Files

**Root:** `package.json` (workspaces and scripts), `package-lock.json`, `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`, `.gitattributes`, `.gitignore`, `README.md`, `CLAUDE.md`, and an update to the design spec (confirmed decisions, §11a auth design).

**Server (`server/`):**

- Config: `package.json`, `.env.example`, `vitest.config.js`
- `src/app.js`, `src/server.js`
- `src/config/`: `env.js`, `db.js`
- `src/models/`: `User.js`, `Session.js`, `index.js`
- `src/validators/`: `common.js`, `auth.validators.js`, `user.validators.js`
- `src/services/`: `token.service.js`, `auth.service.js`
- `src/middleware/`: `auth.js`, `validate.js`, `rateLimits.js`, `verifyOrigin.js`, `errorHandler.js`
- `src/controllers/`: `auth.controller.js`, `user.controller.js`
- `src/routes/`: `index.js`, `auth.routes.js`, `user.routes.js`
- `src/utils/`: `ApiError.js`, `respond.js`, `logger.js`
- `src/seeds/`: `seed.js`, `admin.seed.js`
- `tests/`: `setup.js`, `helpers.js`, `auth.test.js`, `users.test.js`, `rbac.test.js`, `app.test.js`

The empty placeholder `server/app.js` was removed; the app entry point is now `server/src/app.js`.

**Client (`client/`):**

- Config: `package.json`, `index.html`, `vite.config.js`, `vercel.json`, `public/favicon.svg`
- `src/main.jsx`, `src/index.css`
- `src/services/`: `http.js`, `queryClient.js`
- `src/context/`: `AuthContext.jsx`, `authContextObject.js`; `src/hooks/useAuth.js`
- `src/routes/`: `routes.jsx`, `guards.jsx`, `paths.js`
- `src/layouts/`: `AuthLayout.jsx`, `DashboardLayout.jsx`, `navigation.js`
- `src/components/`: `Logo.jsx`, `Icon.jsx`; `ui/` `Button`, `FormField`, `Alert`, `Card`, `Avatar`, `Spinner`
- `src/features/auth/`: `api.js`, `schemas.js`, `LoginPage.jsx`, `RegisterPage.jsx`
- Other pages: `src/features/profile/ProfilePage.jsx`, `src/features/dashboard/DashboardPages.jsx`, `src/pages/NotFoundPage.jsx`
- `src/utils/apiErrors.js`
- Tests: `src/test/setup.js`, `src/test/renderWithAuth.jsx`, `src/services/http.test.js`, `src/routes/guards.test.jsx`, `src/features/auth/AuthPages.test.jsx`

## Database models

| Model     | Purpose                                                                                                        | Indexes                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `User`    | name, email, passwordHash (not returned by default), role, avatarUrl, bio, isActive, lastLoginAt, tokenVersion | unique `email`, `role`                                   |
| `Session` | one refresh token: user, family, tokenHash, expiresAt, revokedAt, replacedAt, userAgent, ip                    | unique `tokenHash`, `user`, `family`, TTL on `expiresAt` |

## API endpoints (`/api/v1`)

| Method | Path                 | Auth                            | Notes                                                         |
| ------ | -------------------- | ------------------------------- | ------------------------------------------------------------- |
| GET    | `/health`            | none                            | 200 when the database is up, 503 otherwise                    |
| POST   | `/auth/register`     | none                            | 201, sets the refresh cookie, returns `{ user, accessToken }` |
| POST   | `/auth/login`        | none                            | Sets the refresh cookie, returns `{ user, accessToken }`      |
| POST   | `/auth/refresh`      | refresh cookie + allowed Origin | Rotates the refresh token, returns `{ user, accessToken }`    |
| POST   | `/auth/logout`       | refresh cookie + allowed Origin | 204, revokes the session family, clears the cookie            |
| GET    | `/auth/me`           | bearer                          | The current user                                              |
| PATCH  | `/users/me`          | bearer                          | Updates name, bio, avatarUrl                                  |
| PATCH  | `/users/me/password` | bearer                          | Re-issues the session and revokes all others                  |

## Tests executed (actual results)

| Check            | Command                | Result                                                               |
| ---------------- | ---------------------- | -------------------------------------------------------------------- |
| Server API tests | `npm test -w server`   | **4 files, 54 tests passed**                                         |
| Client tests     | `npm test -w client`   | **3 files, 21 tests passed**                                         |
| Lint             | `npm run lint`         | **0 errors, 0 warnings**                                             |
| Formatting       | `npm run format:check` | **All files pass**                                                   |
| Production build | `npm run build`        | **Succeeds.** Note: 528 kB JS bundle (167 kB gzip); see known issues |
| Dependency audit | `npm audit`            | **0 vulnerabilities**                                                |

**Mutation check.** I broke three security checks on purpose, one at a time, to confirm the tests catch them. Each break failed tests, and the full suite passed again after restoring the code:

| Check removed                                      | Tests that failed |
| -------------------------------------------------- | ----------------- |
| Revoking the family when a refresh token is reused | 1                 |
| The `requireRole` check                            | 4                 |
| The `tokenVersion` check                           | 1                 |

**Manual end-to-end check** in a real browser (Playwright), with the client on :5173 proxying to the API on :5000, the same setup as the production Vercel rewrite:

- An anonymous visit to `/app/profile` redirects to `/login`.
- Registering a student lands on `/app`.
- A full page reload keeps the session.
- A student visiting `/admin` is redirected to `/app`.
- Logout returns to `/login`, and reloading `/app` afterwards stays on `/login`.
- The trainer logs in at 390 px width and lands on `/admin`. The mobile drawer opens and navigates.
- On the profile page, a wrong current password shows the server error under that field.
- Through the proxy, the cookie headers were `HttpOnly; SameSite=Lax; Path=/api/v1/auth` with no `Domain`. Refresh returned 200, logout 204, and refresh after logout 401.

## Known issues and remaining work

1. **Proxy hop count.** `TRUST_PROXY` must be set to the real number of proxy hops for Vercel → Render. This can only be checked on the live deployment (Phase 8). Until then, rate limiting uses whatever IP Express sees.
2. **Bundle size.** The single 528 kB JS bundle should be split by route (lazy-loaded admin and student areas). This is planned for the Phase 7 performance pass.
3. **Vercel rewrite URL.** `client/vercel.json` has a placeholder Render URL to fill in at deployment time (Phase 8).
4. **Expected console error.** An anonymous page load logs one expected 401 for `/auth/refresh` in the browser console. The app handles it correctly.
5. **Not in Phase 1 by design:** email change, password reset by email, and trainer-side student management (Phase 6).
6. **Dependency versions.** Pinned majors: Mongoose 8, React Router 7, ESLint 9, express-rate-limit 7, pino 9. Vite 8 and Vitest 5 are used because every Vitest version up to 4.1.10 has a critical advisory. Newer majors of the pinned packages can be adopted later.

## Manual testing instructions

1. Make sure MongoDB is running. In `server/.env` (from `.env.example`), set `JWT_ACCESS_SECRET`, `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
2. `npm install`, then `npm run seed` (run it twice: the second run should say "already exists"), then `npm run dev`.
3. Open http://localhost:5173. You should be redirected to `/login`.
4. Choose **Create a student account** and try:
   - mismatched passwords and a password without a digit → inline errors
   - an existing email → "already exists"
   - valid details → you land on the student dashboard
5. Reload the page: you should stay signed in. Visit `/admin`: you should be sent back to `/app`.
6. On the **Profile** page, update your name and bio. Try a wrong current password, then a valid password change.
7. Open a second tab, log out in the first, then click anything in the second: it should end up on the login page.
8. Sign in with the trainer credentials. You should land on `/admin`. Narrow the window to check the mobile drawer.
9. In DevTools → Application → Cookies, `lms_rt` should be `HttpOnly`, with path `/api/v1/auth`.

## Recommended next phase

**Phase 2: courses and roadmaps.** Course, Module and Lesson models with CRUD, publishing and ordering, enrollment requests with trainer approval (D5), the seeded structure and notes for the three courses, an admin course builder and the student roadmap view.
