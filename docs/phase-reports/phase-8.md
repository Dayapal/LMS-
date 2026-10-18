# Phase 8 report: production readiness, deployment and final verification

Date: 2026-10-17, revised 2026-10-18 after review · Status: **approved for the local implementation** (2026-10-18; committed locally, not pushed, not deployed). The production deployment has **not** been verified; the release gates below are still open.

Final results (2026-10-18, after the review follow-up below): the end-to-end suite passed (48 passed, 13 skipped, 0 failed; 61 runs of 21 tests, 6.4 min) in Chromium, Firefox, WebKit and two phone emulations against the production build. 601 server tests and 215 client tests passed; lint and formatting clean; production build successful (startup JavaScript unchanged at 435 kB), including the new post-build secret scan; `npm audit` 0 vulnerabilities. Nothing was deployed, and no hosted database, bucket, DNS record or Vercel/Render setting was touched. See "Tests executed" for the exact runs and "Manual verification still needed" for what only you can check.

## Summary

- **Production file storage.** A private S3-compatible driver for Cloudflare R2 (works with any S3 API), next to the local driver. Credentials stay on the server; files are still only streamed by the API after its access check, never through bucket or pre-signed URLs. Production refuses to start with local disk storage.
- **Storage safety.** Failed uploads leave no bytes behind; deletes can't leave records pointing at missing bytes; a storage outage is a clean 503. Operator commands to check storage, clean up orphans and migrate files between providers (dry run by default, verified copies, source never deleted, reversible).
- **Production configuration.** Stricter startup validation (no default `TRUST_PROXY`, https-only origins and storage, secure cookies), secret-free error messages and masked startup logs, `no-store` on every API response, page security headers including a CSP, a Render Blueprint, and a build check that stops a Vercel deploy with the placeholder API URL.
- **`TRUST_PROXY` is measured, not guessed.** An opt-in diagnostic endpoint shows which value yields the visitor's real IP on the live deployment; the guide walks through it.
- **End-to-end tests.** 18 Playwright tests (52 runs across browsers) against the production build (HTTPS, production CSP, API in production mode with S3 storage), in Chromium, Firefox and WebKit, plus phone emulation. They and the full test runs found ten real problems, all fixed (see "Problems found in this phase").
- **Accessibility.** An axe scan (WCAG 2.2 A and AA) of 27 pages and a dialog, in three engines: 0 violations after fixes.
- **Only the Vercel proxy can reach the API (review follow-up).** The Vercel `/api` route adds a secret header at the edge; the API requires it in production and refuses everything else, including direct calls to the Render URL, before reading any body. See "Review follow-up".
- **Docs.** `docs/deployment.md` (step-by-step deployment, rollback, migration, operations), `e2e/README.md`, updated README, spec and `.env.example`.

## How this matches the approved plan

Spec §10 lists Phase 8 as "Playwright E2E for the critical flows, bug fixes, production build, S3 storage driver verified, env docs, deployment guide", accepted when "the E2E suite passes against a production build" and "the README has full setup and deployment instructions". Phase 7's approval added the screen reader pass, the axe scan, and Safari, Firefox and real-device checks.

| Requirement                                       | Where                                                                                                                                                                                                                        |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E2E for critical flows against a production build | `e2e/*.spec.js`, `playwright.config.js`; results below                                                                                                                                                                       |
| S3 storage driver verified                        | `services/storage/{s3,sigv4}.js`; AWS's published signature examples; a signature-checking fake S3 endpoint for the API and E2E. **Not yet run against a real R2 bucket** (needs your credentials: `npm run files -- check`) |
| Env docs, deployment guide                        | `server/.env.example`, `docs/deployment.md`, `render.yaml`, README "Deployment"                                                                                                                                              |
| Axe scan; Firefox and Safari checks               | `e2e/accessibility.spec.js` in Chromium, Firefox, WebKit; all other specs in all three                                                                                                                                       |
| Screen reader, real devices                       | **Not available here**; manual checklist below                                                                                                                                                                               |
| Known issues assigned to Phase 8                  | Phase 1 #1 and #3 (TRUST_PROXY, Vercel URL), Phase 3 #2/#5 and Phase 4 #6 (orphans, local storage), Phase 4 #1 (virus scanning), Phase 7 #6 and #8 (axe, browsers)                                                           |

## Decisions made in this phase

1. **No AWS SDK.** The S3 driver signs requests with a short (about 90 lines) SigV4 implementation (`sigv4.js`) on Node's `fetch`. It matches all four of AWS's published S3 signature examples, and the fake endpoint re-signs every request it receives and rejects mismatches. The SDK would have added about 100 packages for five operations.
2. **Files keep streaming through the API.** No pre-signed URLs: the access token lives in memory (D4), a cross-origin redirect would need bucket CORS and loses the bearer header, and streaming keeps every access decision in `access.service.js`. Cost: file bytes pass through Render.
3. **`TRUST_PROXY` has no production default** and is measured with `PROXY_DIAGNOSTICS` (off by default, 404 when off). Vercel documents that it sets `X-Forwarded-For` to the visitor's IP; neither Vercel nor Render documents how many proxies follow, so the code doesn't assume a number.
4. **Delete records before bytes.** A storage failure then leaves invisible bytes (found by `files cleanup`) rather than records whose download 404s, and the trainer's delete succeeds.
5. **Orphan cleanup is an operator command, not a background job.** `files cleanup` (dry run by default; `--apply` deletes only items older than 24 hours, rechecking each). A timer would sleep with Render's free plan, and nothing user-facing depends on it. The material form now reuses its upload when a save is retried (the assignment editor already did), which removes the common cause.
6. **No virus scanning.** There's no scanning service in the approved stack (ClamAV needs its own host and signature updates; hosted scanners send student work to a third party). The limitation is recorded, the trainer's review page says "Checked to be a real PDF, but not scanned for viruses", and nothing calls a file scanned or safe. Existing mitigations stay: type and magic-byte checks, `nosniff`, a sandboxing CSP on file responses, `blob:` display.
7. **Page security headers live in `client/vercel.json`** (CSP without `unsafe-eval`, `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`, `nosniff`, referrer and permissions policies, HSTS). `vite preview` sends the same headers, so the E2E suite runs under the real policy. `style-src` allows `'unsafe-inline'` (CodeMirror and React style attributes); `img-src` allows any `https:` image (course thumbnails and Markdown images are external URLs).
8. **API responses are `no-store`, and Vercel's rewrite caching is off for `/api`.** Vercel now caches external-rewrite responses that carry cache headers (projects created after 2026-04-06); every API response is per user.
9. **E2E runs the API in production mode over HTTPS.** WebKit doesn't keep `Secure` cookies on `http://localhost`, and production refuses insecure cookies, so the preview server uses a throwaway self-signed certificate (OpenSSL) rather than weakening the cookie.
10. **`ORIGIN_SECRET` is required and wired end to end** (changed at review; the first version left it optional with no Vercel side). See "Review follow-up".

## Production architecture and storage configuration

```
Browser ──https://<app>.vercel.app──▶ Vercel ──/api/* route + x-origin-secret──▶ Render (Express, NODE_ENV=production)
                                                                   ├──▶ MongoDB Atlas
                                                                   └──▶ Cloudflare R2 (private, S3 API)
```

| Storage setting  | Development                                                                                                                                | Production                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `STORAGE_DRIVER` | `local`                                                                                                                                    | `s3` (`local` refused)                                                                  |
| Where bytes live | `server/uploads/` or `UPLOAD_DIR`                                                                                                          | private R2 bucket, keys `<purpose>/<uuid>.<ext>`                                        |
| Credentials      | none                                                                                                                                       | `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` on Render only                               |
| Endpoint         | —                                                                                                                                          | `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`, `S3_BUCKET` |
| Public access    | none                                                                                                                                       | none: no `r2.dev`, no custom domain, no CORS                                            |
| Upload limits    | trainer PDF/DOCX/PPTX ≤ 20 MB; student PDF ≤ 10 MB; 30 uploads per user per hour; extension, declared MIME type and magic bytes must agree | same                                                                                    |

**Driver behaviour:** requests time out after 30 s waiting for a response; network errors, 429 and 5xx are retried twice (200 ms, 400 ms); other refusals fail at once. Errors say `Storage <operation> failed (<status> <code>)` and never include keys, URLs or credentials.

## Required environment variables

The complete list with comments is `server/.env.example`; the production values are tabulated in `docs/deployment.md` step 3. New in this phase:

| Variable                                   | Default   | Notes                                                                                     |
| ------------------------------------------ | --------- | ----------------------------------------------------------------------------------------- |
| `STORAGE_DRIVER`                           | `local`   | now `local` or `s3`; `local` refused in production                                        |
| `S3_ENDPOINT`                              | —         | https (http only for localhost), no path                                                  |
| `S3_REGION`                                | `auto`    |                                                                                           |
| `S3_BUCKET`                                | —         |                                                                                           |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | —         | all four S3 values are required once any is set                                           |
| `S3_FORCE_PATH_STYLE`                      | `true`    | `false` for virtual-hosted buckets                                                        |
| `TRUST_PROXY`                              | `0` (dev) | **no default in production**; 0–10                                                        |
| `PROXY_DIAGNOSTICS`                        | `false`   | exposes `GET /api/v1/health/proxy` while measuring                                        |
| `ORIGIN_SECRET`                            | unset     | **required in production**; 32+ characters; the same value as the Vercel project variable |
| `ORIGIN_SECRET_PREVIOUS`                   | unset     | only during a rotation; must differ                                                       |
| Vercel project: `ORIGIN_SECRET`            | —         | Production environment, marked Sensitive; never `VITE_`-prefixed                          |
| Client: `PROXY_ORIGIN_SECRET`              | unset     | local dev/preview proxy only (E2E), read by `vite.config.js` in Node                      |

Also stricter now: `MONGODB_URI` must start with `mongodb://` or `mongodb+srv://`; `CLIENT_ORIGINS` entries must be bare origins (https in production); blank values (`S3_BUCKET=`) count as unset. Your current `server/.env` still validates (checked without printing it).

## Hosting and routing configuration

- **Vercel** (`client/vercel.json`): a `routes` entry proxies `/api/(.*)` → `https://<render>.onrender.com/api/$1` and sets `x-origin-secret` from `$ORIGIN_SECRET` (placeholder URL until you fill it in; Vercel builds fail while it's there or while the variable is missing), SPA fallback to `index.html` for every path except `/api/`, page security headers, `x-vercel-enable-rewrite-caching: 0` on `/api/*`, a year's cache for hashed `/assets/*`.
- **Render** (`render.yaml`): root of the repository, `npm ci --omit=dev --workspace server`, `npm start --workspace server`, health check `/api/v1/health`, Node 22. I ran that install in a scratch copy: 146 packages, no test or build tools, 0 vulnerabilities.
- **Cookies and CSRF:** unchanged design (§11a): `lms_rt`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/api/v1/auth`, host-only on the Vercel origin, rotated on every refresh, family revoked on reuse after 10 s; `/auth/refresh` and `/auth/logout` refuse origins outside `CLIENT_ORIGINS`. Verified through the proxy in all three engines.
- **Start-up and shutdown:** indexes are checked at start (`Indexes checked {built, failed}`); MongoDB disconnects and reconnects are logged; `SIGTERM` gives requests 10 seconds; unhandled rejections are logged with secrets masked.

## Deployment and rollback steps

In `docs/deployment.md`: Atlas → R2 → Render → Vercel → first data (seed against Atlas and R2, after `files check`) → measure `TRUST_PROXY` → smoke test, plus rollback (Vercel promote, Render rollback; don't roll the API back to a pre-Phase 8 build once files are in R2) and operations (logs, cleanup, secret rotation, backups).

## Database and file-storage migration

- **Database:** no schema change and no migration. `FileAsset.provider` already existed (every record says `local` today). Mongoose builds the indexes on Atlas at startup and never drops any.
- **Files:** a fresh production database needs nothing (the seed stores its PDFs in R2). To move a database with local files: back up (`mongodump`, copy the upload folder), then `npm run files -- migrate --to=s3` (dry run) and `--apply`. Each file is read, checked against its SHA-256, uploaded under the same key, read back and checked again before its record changes. Missing or mismatching files are listed and left alone; nothing is overwritten or deleted. **Rollback:** `migrate --to=local --apply`. Both directions are tested (`file-maintenance.test.js`), including a storage failure in the middle.

## Security review

| Area                   | Finding and result                                                                                                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private files          | Unchanged access rules, now also proven on the S3 path: owner and trainer 200, another student and anonymous 404, refused requests never reach the bucket (API tests and E2E through the proxy) |
| Credentials            | Only on the server; not in any response, error or log line (tests check error text for keys, endpoint, bucket and secrets)                                                                      |
| Caching                | **Fixed:** API responses had no `Cache-Control`, and Vercel now caches rewrites that send cache headers. All API responses are `no-store`; rewrite caching is off for `/api`                    |
| Page headers           | **Added:** the client had no CSP or framing protection in production                                                                                                                            |
| Direct origin access   | **Fixed at review:** the Render URL answered every request. Now only requests carrying the proxy's secret are served (details in "Review follow-up")                                            |
| Proxy trust            | **Fixed:** production defaulted to `TRUST_PROXY=0` (every visitor would share one rate limit); now required and measured                                                                        |
| Env validation         | Production refuses local storage, http origins or storage, insecure cookies; messages never contain values (tested)                                                                             |
| Logs                   | Authorization, cookies, `Set-Cookie` and now `x-origin-secret` redacted; storage errors carry operation and status only; start-up failures mask URI credentials and secrets                     |
| Orphans                | Bytes removed when the record fails; delete order changed; cleanup command; form retry reuses the upload                                                                                        |
| Request limits         | Unchanged and still tested: JSON 1 MB, uploads 20/10 MB, multipart field limits, rate limits                                                                                                    |
| Refresh-token rotation | **Fixed:** a race could refuse the second of two simultaneous refreshes (problem 8 below); reuse after logout, theft or a password change is still refused (tested)                             |
| Retention              | Unchanged; re-verified by the existing tests (progress through enrollment removal, history after removal or archiving, archived assignments)                                                    |
| Virus scanning         | Not available (decision 6)                                                                                                                                                                      |
| Dependencies           | `npm audit`: 0. New dev dependencies only: `@playwright/test`, `@axe-core/playwright`. No new runtime dependency                                                                                |

## Review follow-up (2026-10-18): direct access to the Render origin

**The gap.** The API is public at `https://<api>.onrender.com`. Anyone calling it directly skipped Vercel and, having one proxy fewer in front of them, could pick the IP the rate limiter sees. CORS and the `Origin` check don't help: browsers enforce them, scripts and `curl` don't.

**Options considered** (from the providers' current documentation):

| Option                                                                                                                                                | Verdict                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel `routes` entry with a `request.headers` transform that sets a secret header from a project environment variable at the edge; the API checks it | **Chosen.** Vercel documents it for exactly this ("Restricting your origin to Vercel traffic"); `op: set` replaces any visitor-supplied value; the value comes from an `env` allowlist at request time, so it's never in `vercel.json` or the build. It's the same edge proxy as the rewrite (no Function), so no 4.5 MB body limit |
| Allow only Vercel's IPs on Render                                                                                                                     | Not possible: Vercel's Static IPs apply to Functions' outbound traffic only (not the CDN proxy) and are shared with other customers; Render's inbound IP rules need a Scale or Enterprise plan                                                                                                                                      |
| Proxy through a Vercel Function that adds the header                                                                                                  | Rejected: Functions cap request bodies at 4.5 MB, below the 10 MB and 20 MB uploads                                                                                                                                                                                                                                                 |
| Mutual TLS between Vercel and Render                                                                                                                  | Not offered by the documented route/rewrite properties (no client-certificate option), so not usable here                                                                                                                                                                                                                           |
| Put the API behind another gateway (e.g. Cloudflare with access tokens)                                                                               | Works, but adds a provider and changes the approved architecture (D7)                                                                                                                                                                                                                                                               |

**What was built:**

- `client/vercel.json`: the `/api` proxy moved from `rewrites` to a `routes` entry with the header transform (`args: "$ORIGIN_SECRET"`, `env: ["ORIGIN_SECRET"]`). The SPA fallback became `/:path((?!api/).*)`, so no other rule can reach `/api` without the header, whatever order Vercel applies routes and rewrites in. Headers, caching and the cookie model are unchanged.
- `server/src/middleware/proxy.js` → `requireOriginSecret`, mounted app-wide right after `helmet`, before CORS, body parsers, multipart uploads and every route (a test asserts this order). Constant-time comparison of SHA-256 digests against `ORIGIN_SECRET` and, during a rotation, `ORIGIN_SECRET_PREVIOUS`. Refusal: `403 FORBIDDEN "Requests must go through the application URL"`, `Cache-Control: no-store`, connection closed without reading the body. Only `GET /api/v1/health` is open (Render's health checks call the service directly; it returns status only). The `TRUST_PROXY` diagnostic sits behind the check, so it measures the real path through Vercel.
- `config/env.js`: production refuses to start without `ORIGIN_SECRET` (32+ characters); rotation rules; the values are masked by `redactSecrets`. `utils/logger.js` redacts `x-origin-secret`.
- Build guards: `check-deploy-config.js` (now testable) stops a Vercel build if the route lacks the transform, isn't https, still has the placeholder, if another rewrite could match `/api`, if `ORIGIN_SECRET` isn't set for the build (Vercel would send the literal `$ORIGIN_SECRET`), or if a `VITE_` variable holds a secret. `check-build-secrets.js` runs after `vite build` and fails if the secret appears in any output file.
- The local dev/preview proxy adds the header from `PROXY_ORIGIN_SECRET` (Node-side only), which is how E2E runs the real check.

**How each review requirement is met:**

| #   | Requirement                                                             | Evidence                                                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Secret never in browser JS, public config or responses                  | Not in `vercel.json` (only `$ORIGIN_SECRET`); not a `VITE_` variable (build fails if one is); post-build scan of every output file; E2E reads every file of the served build and the page, a script and an API response; server tests check refused and served responses; log redaction test |
| 2   | First-party cookie and refresh behaviour preserved                      | Same origin, same cookie flags; server test runs register → refresh → me → foreign-origin refusal → logout through the proxy; the full E2E auth suite passes in three engines; a refused direct refresh doesn't use up the token                                                             |
| 3   | 10 MB and 20 MB uploads preserved                                       | Server test and E2E upload a 20 MB − 1 KB trainer file and a 10 MB − 1 KB student PDF through the proxy and read them back. **Through Vercel itself: smoke test step 7.4**                                                                                                                   |
| 4   | Not relying on CORS or `Origin`                                         | The check runs before CORS and needs no browser behaviour; direct `curl`-style requests (Playwright API client, Supertest) are refused                                                                                                                                                       |
| 5   | No Function proxy                                                       | The edge route proxies; no Function exists in this project                                                                                                                                                                                                                                   |
| 6   | Tests: direct refused, trusted forwarded succeeds, workflows still work | `origin-secret.test.js` (10), config tests (+3), `deployChecks.test.js` (6), E2E `security.spec.js` (+3); the full server, client and E2E suites run with the check on in E2E                                                                                                                |
| 7   | Documented without inventing credentials                                | `docs/deployment.md` steps 3, 4, 7, 8 and rollback; `.env.example` and `render.yaml` with placeholders and a generator command; test values are labelled as such                                                                                                                             |
| 8   | No deployment or hosted changes                                         | None made                                                                                                                                                                                                                                                                                    |

**What only the real deployment can confirm** (in the smoke test): that Vercel applies the transform (step 7.6: direct `403`, through Vercel `401`), that the route forwards query strings (step 7.7), and the upload sizes through Vercel (step 7.4).

## Problems found in this phase (all fixed)

1. **WebKit couldn't show PDFs under the new CSP:** the `blob:` PDF inherits `frame-ancestors 'none'`. Now `'self'` (still blocks other sites).
2. **Firefox reported a CSP violation on every form:** zod probes for `eval`. Client schemas now import zod from `utils/zod.js` with `jitless`; a test enforces the import.
3. **Safari didn't get focus back after closing a dialog or the mobile menu:** Safari doesn't focus clicked buttons, so the trap restored focus to `<main>` or nothing. It now returns to the control clicked just before opening.
4. **Loading skeletons:** 17 had `aria-label` on a plain `div` (ignored by screen readers, axe "serious"). Now `role="status"`; a test enforces it.
5. **Live Markdown previews** (note and assignment editors) scrolled but weren't keyboard-focusable (axe "serious"). Now focusable.
6. **"Mark as read"** was named "Mark “…” as read", which doesn't start with its visible text (WCAG 2.5.3; voice control users say what they see). Now "Mark as read: …". The same pattern fixed on the assignment page's Review link and the code block's Copy button (found by review, not by axe).
7. **The dashboard's Approve and Decline buttons** had identical names for every request. They now name the student and course.
8. **Two tabs refreshing at once could sign one out (Phase 1 bug).** Under load the full server suite failed the "concurrent tabs" test once. The second of two simultaneous refreshes could arrive after the first had marked the token rotated but before it had stored the replacement; the grace-window check then found no live session in the family and answered 401. The check now asks whether the family was _ended_ (logout, theft detection, password change and deactivation revoke sessions without a replacement) instead of whether a replacement already exists. A new test reproduces the in-between state and failed before the fix; two more prove a family ended by logout or a password change stays ended inside the grace window. Removing the check fails three tests. Residual edge (unchanged from before): a logout in the same millisecond as a refresh of the same token can leave that refresh's new session alive until it expires or is used.
9. **The notification bell** showed "9+" while its name said "Notifications, 11 unread" (WCAG 2.5.3, found by axe once more than 9 notifications existed). The badge now shows the exact count up to 99 ("99+" after), and the name uses the same text.
10. **A flaky Phase 7 test:** it checked that "70" (the marks) wasn't in the notification JSON, and random ObjectIds sometimes contain "70". It now checks the text fields only.

## Accessibility and browser verification

**Automated (executed):**

- axe-core 4.14 via `@axe-core/playwright`, tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, on: anonymous sign-in, register and 404; student dashboard, catalogue, course, lesson reader, assignments, assignment, notifications, profile; trainer dashboard, courses, course builder, materials editor, student preview, new/view/edit assignment, review page, review queue, students, student, reports, course report, notifications, profile; and the "Add note" dialog with a live preview. The setup hands in fresh work first, so pages with an unread notification and a submission awaiting review are always included. **Result: 0 violations in Chromium, Firefox and WebKit.**
- Keyboard (E2E): keyboard-only sign-in; empty submit marks fields `aria-invalid` and describes them by their message; focus moves to `main` after navigation; skip link (Chromium, Firefox); dialog keeps Tab inside for 25 presses and Escape returns focus to the opener (all three).
- Layout: no sideways scrolling on 7 student and 9 trainer pages in Pixel 7 and iPhone 14 emulation; the menu opens, closes with Escape and returns focus; the PDF viewer gets a `blob:` URL and the "Open it in a new tab" fallback.

**Not executed (no tool or device here):**

- No screen reader (NVDA, JAWS, VoiceOver, TalkBack) was available.
- No real iPhone, iPad or Android phone; no real Safari (Playwright's WebKit build is close to Safari but isn't Safari, and on Windows it can't tell whether a PDF renders inside the frame). Emulation is a viewport and user agent only.
- Upload sizes through the real Vercel rewrite (see Known issues).

## Manual verification still needed (checklist)

**Screen reader** (NVDA + Firefox on Windows, VoiceOver + Safari on a Mac or iPhone):

1. Sign-in page: the field names and the required state are read; submit empty: each error is read when moving to its field; a wrong password: the alert is announced.
2. Student dashboard: headings list (NVDA H / VoiceOver rotor) gives a sensible outline; the bell is read as "Notifications, N unread".
3. Lesson reader: "Mark as complete" announces the result inside the completion panel; the PDF viewer has a name ("PDF viewer: …").
4. Submit an assignment with a PDF: upload progress and the result are announced.
5. Trainer review page: the student PDF notice is read; "Save review" result announced.
6. Notifications page: "Mark as read: …" buttons, the Unread filter state ("pressed").
7. Any dialog (New course): focus starts inside, Escape closes it, focus returns to "New course".

**Real devices and browsers:**

1. iPhone Safari: sign in, reload (still signed in), open a lesson PDF: if only the first page shows, "Open it in a new tab" opens the whole file.
2. Android Chrome: the same, plus a student PDF upload from the Files app.
3. Desktop Safari (macOS): sign in, reload, sign out in one tab and check the other tab signs out; Option+Tab reaches the skip link.
4. 200 % zoom in a desktop browser: no sideways scrolling on the dashboard, lesson reader and review page.

**After deploying** (docs/deployment.md step 7): health, register/reload/sign-out, upload and view a PDF, the 19 MB and 9 MB uploads through Vercel, headers with `curl -I`, `TRUST_PROXY` measured and diagnostics switched off.

## Files

**New (server):** `services/storage/{s3,sigv4,keys,errors}.js`, `services/fileMaintenance.js`, `scripts/files.js`, `middleware/proxy.js`; tests `storage-sigv4`, `storage-s3`, `storage-files`, `file-maintenance`, `config`, `proxy`, `origin-secret`, `db` (`.test.js`) and `fake-s3.js`.

**Changed (server):** `config/env.js` (S3 and proxy settings, production rules, `loadConfig`, `redactSecrets`), `config/db.js` (`ensureIndexes`, connection events), `server.js` (index check, shutdown grace, masked fatal logs), `app.js` (origin check first), `routes/index.js` (`no-store`, diagnostics), `utils/logger.js` (redaction), `middleware/errorHandler.js` (503 for storage), `services/storage/{index,local}.js` (`open`, `list`, shared key rules), `services/file.service.js` (open via driver, safe delete order, cleanup on failed record), `controllers/file.controller.js`, `services/token.service.js` (rotation race), `package.json` (`files` script), `.env.example`; tests `auth.test.js` (+3), `permission-audit.test.js` (+1 row), `notifications.test.js` (flaky check fixed).

**New (client):** `utils/zod.js`, `scripts/{check-deploy-config,check-build-secrets}.js` and their test `scripts/deployChecks.test.js`, `test/a11yConventions.test.js`.

**Changed (client):** `vercel.json` (`/api` route with the secret header, headers, caching), `vite.config.js` (preview headers, E2E HTTPS, proxy header), `package.json` (build checks), `hooks/useFocusTrap.js`, four `schemas.js` (zod import), `features/lessons/admin/MaterialForms.jsx` (reuse upload, focusable preview), `features/assignments/admin/AssignmentEditorPage.jsx` (focusable preview), `features/assignments/components/SubmissionItems.jsx` + `admin/SubmissionReviewPage.jsx` (not-scanned notice), `features/assignments/admin/AdminAssignmentPage.jsx`, `components/content/CodeBlock.jsx`, `features/notifications/{NotificationsPage.jsx,format.js}`, `features/trainer/dashboard/TrainerDashboardPage.jsx` (accessible names), 17 pages (`role="status"` on loading skeletons); tests `A11yComponents`, `LessonMaterials`, `AdminAssignments`, `TrainerPages`, `Notifications`, `ContentRendering`.

**New (root):** `playwright.config.js`, `e2e/` (7 specs, `support/`, README), `render.yaml`, `docs/deployment.md`, this report. **Changed:** `package.json` (Playwright, axe, scripts), `eslint.config.js`, `.prettierignore`, `README.md`, the spec, `CLAUDE.md`, `render.yaml` and `server/.env.example` (`ORIGIN_SECRET`).

## Tests executed (actual results, final run 2026-10-18)

| Check            | Command                | Result                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server tests     | `npm test -w server`   | **33 files, 601 tests passed** (530 + 71 new)                                                                                                                                                                                                                                                                                                                                                                        |
| Client tests     | `npm test -w client`   | **24 files, 215 tests passed** (203 + 12 new)                                                                                                                                                                                                                                                                                                                                                                        |
| E2E              | `npm run test:e2e`     | **48 passed, 13 skipped, 0 failed** (61 runs of 21 tests, 6.4 min, fresh build, API requiring the proxy secret). Earlier full runs on 2026-10-17 failed 3 and then 1 axe tests; those were the label-in-name problems 6 and 9, fixed before the later runs                                                                                                                                                           |
| Lint             | `npm run lint`         | **0 errors, 0 warnings**                                                                                                                                                                                                                                                                                                                                                                                             |
| Formatting       | `npm run format:check` | **All files pass**                                                                                                                                                                                                                                                                                                                                                                                                   |
| Production build | `npm run build`        | **Succeeds, no chunk over 500 kB.** Startup JS 435.5 kB (index 425.0 kB + 2 small chunks), same as Phase 7. The deploy check prints a note about the placeholder URL (an error only on Vercel); the post-build secret scan passes. Simulated Vercel build of the committed file: stops on the placeholder and the missing `ORIGIN_SECRET`; a planted copy of a test secret in a built file: the scan fails the build |
| Dependency audit | `npm audit`            | **0 vulnerabilities.** Production-only server install (Render's command, scratch copy): 0                                                                                                                                                                                                                                                                                                                            |

**E2E specs** (each fails on page errors and CSP violations):

| Spec            | What it proves                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`          | register; `Set-Cookie` flags; host-only cookie; nothing in local/session storage; reload keeps the session; sign out; wrong password; role areas; a replayed rotated token revokes the family                                                                                                                                                                                                                                                                                                                                             |
| `learning`      | request enrollment → trainer approves on the dashboard → start the lesson → PDF from S3 via `blob:` with `no-store` → the file URL without the token is a 404 → mark complete → dashboard progress                                                                                                                                                                                                                                                                                                                                        |
| `assignments`   | trainer enrolls a student → student uploads a PDF → trainer opens it from the review queue (with the not-scanned notice) and grades → student sees the notification, marks and feedback                                                                                                                                                                                                                                                                                                                                                   |
| `security`      | PDF privacy (owner, trainer, other student, anonymous), spoofed PDF refused, students can't use `/files`, foreign origins refused on cookie endpoints, `no-store` everywhere, page security headers; **direct calls to the API refused (token, login, refresh with the real cookie, guessed secret) while the same calls through the proxy work, the health check open, a visitor-supplied header replaced by the proxy; 20 MB and 10 MB uploads through the proxy; the secret in no served file or response** (Chromium only: API-level) |
| `keyboard`      | see "Accessibility and browser verification"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `accessibility` | the axe scan above                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `mobile`        | phone layouts, menu, PDF fallback (Pixel 7, iPhone 14)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**Skipped by design:** the 6 `security` tests in Firefox and WebKit (they check the API and headers, not the browser) and the skip-link test in WebKit (WebKit, like Safari by default, doesn't Tab to links).

**New server tests (60):** SigV4 against AWS's examples (7); S3 driver round trip, missing objects, key validation, retries, refusals, network errors, timeouts, virtual-hosted URLs (8); the file API on S3 (privacy, spoofed uploads, 503s without details, missing objects, old local records) and failure handling (12); cleanup, migrate both ways, checksum and overwrite protection, storage check (10); production env validation and redaction (10); proxy-aware rate limiting, diagnostics, origin secret, `no-store`, production cookie and CSRF through the proxy (8); index check (1); permission audit row (1); refresh rotation race and ended families (3); at review: proxy secret (10 in `origin-secret.test.js`, +3 config; the 2 earlier origin-secret tests in `proxy.test.js` were replaced).

**Mutation check.** Each rule below was broken on purpose by a script, the related tests run, and the code restored. Every break failed at least one test. One survived at first: removing the query sort in the signer passed, because AWS's example URL is already sorted; a test with reversed parameters now catches it.

| Rule removed                                  | Failed | Rule removed                                 | Failed |
| --------------------------------------------- | ------ | -------------------------------------------- | ------ |
| Production requires `TRUST_PROXY`             | 3      | S3 retries temporary failures                | 1      |
| Production refuses local storage              | 2      | S3 driver validates keys                     | 1      |
| https storage endpoint                        | 1      | SigV4 sorts query parameters (after fix)     | 1      |
| Blank env values mean unset                   | 1      | SigV4 path encoding                          | 1      |
| Records deleted before bytes                  | 1      | Migration checks the source checksum         | 1      |
| Bytes removed when the record fails           | 1      | Migration never overwrites                   | 1      |
| Storage errors become a detail-free 503       | 2      | Cleanup ignores foreign files                | 1      |
| API responses `no-store`                      | 2      | Cleanup keeps superseded copies              | 1      |
| Origin secret (first version)                 | 1      | Cleanup is a dry run without `--apply`       | 1      |
| Diagnostics only when enabled                 | 1      | Cleanup waits for the cutoff                 | 2      |
| Client: material form reuses its upload       | 1      | Client: not-scanned notice                   | 1      |
| Client: request buttons name the student      | 1      | Client: loading skeletons are status regions | 1      |
| Client: zod only via `utils/zod.js`           | 1      | Client: focus returns to the clicked control | 1      |
| Ended families stay ended in the grace window | 3      | Origin check applied app-wide                | 6      |
| Origin check before CORS and body parsing     | 2      | Only the exact health path is open           | 1      |
| Exact, constant-time secret match             | 2      | Previous secret accepted while rotating      | 1      |
| `ORIGIN_SECRET` required in production        | 1      | Header redacted in logs                      | 1      |
| Deploy check: route sets the header           | 1      | Deploy check: Vercel build needs the secret  | 1      |
| Deploy check: no other rewrite reaches `/api` | 1      | Build: secret scan                           | 1      |

## Known issues and remaining work

**New in this phase:**

1. **Not verified against real R2.** The driver passed AWS's published signatures and a signature-checking fake, but no real bucket was used (no credentials here, and no hosted data may be changed without you). First step after creating the bucket: `files check`.
2. **`TRUST_PROXY` is still to be measured** on the live deployment (guide step 6). Until then production must use `0`, which makes every visitor share one rate limit.
3. **Vercel's half of the proxy secret is verified locally, not on Vercel.** The route syntax follows Vercel's documentation and the build checks it, and a local proxy plays its role in the tests, but whether Vercel applies the transform and forwards query strings is first seen in smoke test steps 7.6–7.7. If it doesn't, every API call through Vercel is refused (fails closed); roll back both halves together.
4. **Upload size through Vercel is unverified.** Vercel documents a 120-second limit for proxied requests and no body limit for external rewrites or routes (its 4.5 MB limit is for Functions, which aren't used). 20 MB trainer and 10 MB student uploads must be tried once deployed (guide step 7).
5. **No virus scanning** (decision 6; carried from Phase 4, now documented as a production limitation).
6. **No screen reader or real-device testing** (checklist above). WebKit's skip-link stop and its PDF rendering are manual checks.
7. **Rate limits and "due soon" throttling are in memory** per API instance: they reset on restart (a free Render instance restarts after sleeping) and aren't shared if you scale out.
8. **`files cleanup` is manual.** Nothing runs it on a schedule.
9. **Vercel preview deployments** don't build without `ORIGIN_SECRET` in the Preview environment; with it, they lose the session on reload unless their URL is in `CLIENT_ORIGINS`.
10. **The health check is open** without the secret (Render needs it). It returns only `ok`/`degraded` and the database state.
11. **R2 has no versioning and Atlas M0 no backups:** deleting a file in the app is final; database backups need `mongodump` or a paid tier.
12. **E2E needs OpenSSL** (found in Git for Windows automatically) and the local MongoDB; a full run takes about 8–10 minutes.

**Resolved from earlier phases:**

- Phase 1 #1 `TRUST_PROXY` hop count: now required in production with a measurement procedure (the measurement itself is new item 2)
- Phase 1 #3 Vercel rewrite URL: placeholder kept, but a Vercel build now fails until it's replaced
- Phase 3 #5 local storage only: S3/R2 driver; local refused in production
- Phase 3 #2 and Phase 4 #6 orphaned uploads: failure handling, retry reuse, `files cleanup`
- Phase 7 #6 axe scan (screen reader still manual) and #8 Firefox and WebKit coverage (real Safari and devices still manual)
- The flaky notification test

**Carried over (unchanged):**

- Phase 7: publishing a lesson, module or course doesn't notify; enrollment decisions don't notify; "due soon" depends on app use; notifications are snapshots; axios kept; toasts cover the phone title area for 3.5 s
- Phase 6: the activity log starts at Phase 6; seeded activity order; "signed in" is the last password sign-in; scale assumptions; course report totals per page; the first 100 courses in filters; enrolling by email on the course's Students tab
- Phase 5: no seeded overdue demo; courses with completions can only be archived; demo progress comes back after a full un-complete and reseed; the narrow lesson-deletion race; dashboards reflect the moment they were loaded
- Phase 4: links not checked for reachability; no per-student extensions; a penalty change doesn't recompute final marks
- Phase 3: PDFs on iOS (fallback link present; real device still to check); view-only isn't DRM
- Phase 1: the expected 401 on anonymous page loads
- Tests: the occasional unmocked request in `AdminCourses.test.jsx` and the jsdom "navigation not implemented" message; neither fails a test

## Approval and open release gates (2026-10-18)

Approved for a local commit on the basis of the implementation and the verification results above. Not approved, and not done: pushing, deploying, configuring production secrets, migrating hosted data, seeding Atlas or changing DNS. Each needs your explicit approval.

These gates stay open until checked on the real deployment (`docs/deployment.md` step 7 and the checklists above):

1. Vercel adds `x-origin-secret` on the `/api` route: a direct call to the Render URL gets 403, the same call through Vercel reaches the API (step 7.6).
2. The Vercel route forwards query strings (step 7.7).
3. R2 connectivity with the real bucket and token (`files check`, step 5).
4. 20 MB trainer and 10 MB student uploads through Vercel (step 7.4).
5. `TRUST_PROXY` measured on the live path and diagnostics switched off (step 6).
6. Virus scanning: not available; accepted as a documented limitation (decision 6), not a resolved item.
7. Manual screen reader and real-device checks (see "Manual verification still needed").

## Release checklist

1. ~~Review this phase~~ Approved for the local implementation and committed locally (2026-10-18).
2. Create Atlas (user, network access) and R2 (private bucket, scoped token).
3. Fill in the Render URL in `client/vercel.json`.
4. Generate one `ORIGIN_SECRET`. Render from `render.yaml`; enter the secret values (including `ORIGIN_SECRET`); `TRUST_PROXY=0`.
5. Vercel: root `client`, Node 22, project variable `ORIGIN_SECRET` (Production, Sensitive, same value).
6. `files check`, then seed against Atlas and R2 (**changes hosted data**, your call).
7. Measure `TRUST_PROXY`, set it, switch diagnostics off.
8. Smoke test, including the large uploads through Vercel and the direct-access check (direct `403`, through Vercel `401`).
9. Screen reader and device checklist.
10. Only then invite students.

## Git status

Committed locally on `main` as `feat: Phase 8 production readiness and deployment safeguards`, on top of `50e67fd` (Phase 7). Not pushed and not deployed. Test output (`test-results/`, `playwright-report/`), `client/dist`, `server/.env` and `server/uploads/` are git-ignored and not part of the commit.
