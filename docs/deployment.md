# Deployment guide: Vercel + Render + MongoDB Atlas + Cloudflare R2

This is the production setup chosen in decision D7 of the spec. Nothing in this repository deploys by itself: every step below is something you do in the providers' dashboards, in this order. Steps that change hosted data are marked **(changes hosted data)**.

```
Browser ── https://<app>.vercel.app ──────────────▶ Vercel (static client build)
              │  /api/*  (route, same origin; adds x-origin-secret at the edge)
              ▼
         https://<api>.onrender.com/api/* ──▶ Render web service (Express, NODE_ENV=production)
                                                 ├──▶ MongoDB Atlas (database)
                                                 └──▶ Cloudflare R2 (private bucket, S3 API)
```

- The browser only ever talks to the Vercel origin, so the refresh cookie is first-party (spec §11a). The client calls the relative `/api/v1`; there's no API host in the client build.
- Files are never public. The browser asks `GET /api/v1/files/:id` with its token; the API checks access, then streams the bytes from R2. R2 credentials stay on Render.
- **Only Vercel can reach the API.** One random secret is stored twice: as `ORIGIN_SECRET` on Render and as the `ORIGIN_SECRET` variable of the Vercel project. Vercel's `/api` route adds it to every proxied request as the `x-origin-secret` header, at the edge, replacing anything a visitor sent. The API refuses every request without it (403) before reading the body, except `GET /api/v1/health` for Render's health checks. The secret is never in the client build, the browser or any response (the build checks this).

## 1. MongoDB Atlas

1. Create a cluster (M0 is enough to start; backups need a paid tier, see "Backups").
2. **Database Access:** create a user with `readWrite` on the `lms` database only, with a long random password.
3. **Network Access:** Render's free and starter services have no fixed outbound IP, so allow `0.0.0.0/0` and rely on the strong password and TLS, or use Render's static outbound IPs (paid) and allow only those.
4. Copy the `mongodb+srv://…` connection string and add the database name: `…mongodb.net/lms?retryWrites=true&w=majority`.

Indexes are created by the API at startup (Mongoose `autoIndex`); the log line `Indexes checked` reports `built` and `failed` counts. Nothing is ever dropped.

## 2. Cloudflare R2

1. Create a bucket, for example `training-lms-files`, in the location nearest your Render region.
2. Leave **public access off**: no `r2.dev` subdomain and no custom domain. The app never needs a public URL, and a public bucket would bypass the access checks.
3. **R2 API token:** "Object Read & Write", limited to this one bucket. Note the access key id and secret (shown once).
4. The endpoint is `https://<account id>.r2.cloudflarestorage.com` (no bucket in the URL). Region is `auto`.
5. No CORS rules are needed: browsers never contact R2.

## 3. Render (API)

Create the service from the Blueprint (`render.yaml`, **New → Blueprint**) or by hand with the same settings:

| Setting           | Value                                                                |
| ----------------- | -------------------------------------------------------------------- |
| Root directory    | repository root (workspaces need the root lockfile)                  |
| Build command     | `npm ci --omit=dev --workspace server`                               |
| Start command     | `npm start --workspace server`                                       |
| Health check path | `/api/v1/health` (200 when the database is connected, 503 otherwise) |
| Node              | `NODE_VERSION=22`                                                    |

Environment variables (the API refuses to start, naming the problem but never a value, when one is missing or unsafe):

| Variable                                   | Production value                                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                 | `production`                                                                                                                                                                           |
| `MONGODB_URI`                              | the Atlas string from step 1                                                                                                                                                           |
| `JWT_ACCESS_SECRET`                        | 32+ random characters (the Blueprint generates one)                                                                                                                                    |
| `CLIENT_ORIGINS`                           | `https://<app>.vercel.app` (add a custom domain comma-separated; https only, no trailing slash)                                                                                        |
| `TRUST_PROXY`                              | **required**; start with `0`, then measure in step 6                                                                                                                                   |
| `ORIGIN_SECRET`                            | **required**; 32+ random characters, the same value as in Vercel (step 4). Generate it once: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`          |
| `STORAGE_DRIVER`                           | `s3` (`local` is refused in production: Render's disk is wiped on every deploy)                                                                                                        |
| `S3_ENDPOINT`                              | `https://<account id>.r2.cloudflarestorage.com`                                                                                                                                        |
| `S3_REGION`                                | `auto`                                                                                                                                                                                 |
| `S3_BUCKET`                                | the bucket name                                                                                                                                                                        |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | the R2 token from step 2                                                                                                                                                               |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`  | the trainer login (used only by `npm run seed`)                                                                                                                                        |
| Optional                                   | `LOG_LEVEL` (`info`), rate limits (`RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`, `REFRESH_RATE_LIMIT_MAX`, `UPLOAD_RATE_LIMIT_MAX`), `ORIGIN_SECRET_PREVIOUS` (only while rotating, step 8) |

Never set `SEED_DEMO_STUDENT_PASSWORD` or `COOKIE_SECURE=false` in production. `server/.env.example` describes every variable.

## 4. Vercel (client)

1. Edit `client/vercel.json`: in the `/api/(.*)` route, replace `https://REPLACE-WITH-RENDER-SERVICE.onrender.com` with your Render URL (keep `/api/$1` at the end) and commit. Leave its `transforms` entry as it is: it sets `x-origin-secret` from `$ORIGIN_SECRET`; the value itself never goes in this file.
2. Import the repository in Vercel: **Root Directory** `client`, framework **Vite**, build command `npm run build`, output directory `dist`, Node 22.
3. **Environment variable** (Project → Settings → Environment Variables): `ORIGIN_SECRET` = the same value as on Render, environment **Production**, marked **Sensitive** (it can't be read back in the dashboard). Don't give it a `VITE_` prefix: that would put it into the browser bundle. Leave it out of **Preview** unless preview deployments should reach the production API. Changing it needs a redeploy.
4. The build checks the configuration (`client/scripts/check-deploy-config.js`) and stops when: the route still has the placeholder URL or isn't https; the route doesn't set the header from `$ORIGIN_SECRET`; any rewrite could also match `/api`; `ORIGIN_SECRET` isn't set for the build (Vercel would then send the literal text `$ORIGIN_SECRET`, and the API would refuse everything); or a `VITE_` variable holds a secret. After building, `client/scripts/check-build-secrets.js` fails the build if the secret appears in any output file.
5. Vercel installs from the workspace root. If the first build can't find the lockfile, set the install command to `cd .. && npm ci --workspace client` and redeploy.
6. `client/vercel.json` also sets the page security headers (CSP, `X-Frame-Options: SAMEORIGIN`, `nosniff`, referrer and permissions policies, HSTS), turns off CDN caching for `/api/*` (`x-vercel-enable-rewrite-caching: 0`) and caches the hashed `/assets/*` files for a year. The API also sends `Cache-Control: no-store` on every response.

**Preview deployments** get other `*.vercel.app` URLs. Without `ORIGIN_SECRET` in the Preview environment their builds stop at the check above (and their API calls would be refused anyway). If you do give previews the secret, a page reload still loses the session unless the preview URL is in `CLIENT_ORIGINS`.

## 5. First data **(changes hosted data)**

The production database starts empty. Create the trainer account and the starter courses with the normal seed, run from your machine against Atlas and R2:

1. Create `server/.env.production.local` (git-ignored by `.env.*`) with `NODE_ENV=production`, the Atlas `MONGODB_URI`, the `S3_*` values, `STORAGE_DRIVER=s3`, `TRUST_PROXY=0`, `CLIENT_ORIGINS`, `ORIGIN_SECRET` and `JWT_ACCESS_SECRET` (any valid values; the seed neither serves requests nor signs tokens) and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.
2. Check storage first: `node --env-file=server/.env.production.local server/src/scripts/files.js check` writes, reads and deletes one temporary object.
3. Seed: `node --env-file=server/.env.production.local server/src/seeds/seed.js`. It only adds what's missing, never changes existing records, refuses `--reset` in production, and uploads the three cheat-sheet PDFs to R2 through the same checks as real uploads.
4. Delete `server/.env.production.local` when you're done (or keep it outside the repository).

## 6. Measure `TRUST_PROXY`

Rate limits count requests per client IP, which Express reads from `X-Forwarded-For` according to `TRUST_PROXY`. Vercel sets that header to the visitor's IP; every proxy after it appends one address. The number of proxies between Vercel and Express on Render isn't documented, so it's measured, not guessed:

1. On Render set `PROXY_DIAGNOSTICS=true` and redeploy.
2. In your browser open `https://<app>.vercel.app/api/v1/health/proxy` (through Vercel, not the Render URL).
3. Compare the `candidates` list with your public IP (search "what is my IP"). Set `TRUST_PROXY` to the `trustProxy` of the **first** candidate whose `ip` is your address.
4. Set `PROXY_DIAGNOSTICS=false` (or remove it) and redeploy. Open the URL again: it must be a 404.
5. Check: with the new value, `ip` in step 2 would be your address. Sign-in attempts from another network (a phone on mobile data) now get their own rate limit.

While `TRUST_PROXY=0`, every visitor shares one rate-limit allowance (the proxy's address), so sign-ins could hit the 10-per-15-minutes limit. Finish this step before inviting students. A value higher than needed would let clients choose their own IP, so don't round up.

## 7. Smoke test

1. `https://<app>.vercel.app/api/v1/health` → `{"success":true,"data":{"status":"ok","db":"up"}}`.
2. Register a student, reload the page (still signed in), sign out.
3. As the trainer: upload a small PDF to a lesson, publish it, and view it as an enrolled student.
4. **Upload size through the route:** upload a PDF of about 19 MB as the trainer and a 9 MB PDF as a student. Vercel documents a 120-second limit for proxied requests but no request-size limit for external rewrites or routes (its 4.5 MB limit is for Functions, which this setup doesn't use), so this must be checked on the real deployment (see "Known limits").
5. `curl -I https://<app>.vercel.app/` shows the CSP and the other headers; `curl -I https://<app>.vercel.app/api/v1/health` shows `cache-control: no-store`.
6. **Direct access is refused:** `curl -i https://<api>.onrender.com/api/v1/courses` → `403` with `"Requests must go through the application URL"`; `curl https://<api>.onrender.com/api/v1/health` → `200`. Through Vercel, `curl -i https://<app>.vercel.app/api/v1/courses` → `401` (it reached the API, which asks for a sign-in; a 403 here would mean the header isn't arriving).
7. **Query strings pass through the route:** signed in as the trainer, the Courses page's filters and pagination work (they send `?status=…&page=…`), and a file opens with **Download** (`?download=1`).

## 8. The proxy secret (`ORIGIN_SECRET`)

**Why:** anyone can find and call the `onrender.com` URL. Such a request would skip Vercel's headers and, having one proxy fewer in front of it, could choose the IP the rate limiter sees (`TRUST_PROXY`). CORS and the `Origin` check don't stop it: browsers enforce them, scripts don't. So the API serves only requests that carry the secret, which only Vercel's edge adds: Vercel's documented "Restricting your origin to Vercel traffic" pattern, a `routes` entry with a `request.headers` transform whose `env` allowlist names `ORIGIN_SECRET`.

**How it's enforced:** `requireOriginSecret` (`server/src/middleware/proxy.js`) runs right after `helmet`, before CORS, body parsing, uploads and every route. It compares SHA-256 digests in constant time against `ORIGIN_SECRET` (and `ORIGIN_SECRET_PREVIOUS` during a rotation). Refusals are `403` with `Cache-Control: no-store`, and the connection is closed without reading the body. The header is redacted from the request logs. Production refuses to start without `ORIGIN_SECRET`.

**Rotating it** (for example yearly, or if it may have leaked):

1. Generate a new value.
2. Render: set `ORIGIN_SECRET_PREVIOUS` to the current value and `ORIGIN_SECRET` to the new one; redeploy. Both values are now accepted.
3. Vercel: set `ORIGIN_SECRET` to the new value; redeploy.
4. Repeat step 7.6, then remove `ORIGIN_SECRET_PREVIOUS` on Render and redeploy.

If Render and Vercel hold different values, every API call through Vercel gets `403 Requests must go through the application URL`. Fix the values; nothing else changes.

## Rollback

- **Client:** Vercel → Deployments → promote the previous deployment (instant).
- **API:** Render → the service → Events → roll back to the previous deploy. Phase 8 has no database migration, so an older Phase 8+ build reads the same data.
- **Don't roll the API back to a build before Phase 8** once files are stored in R2: those builds have no S3 driver and would answer 500 for every file. Production starts with Phase 8, so this only matters for databases migrated from local storage (below), and there the rollback is `files migrate --to=local`.
- **Configuration mistakes** (for example a wrong `TRUST_PROXY`): fix the variable and redeploy; nothing is stored.
- **Keep the Vercel route and Render's `ORIGIN_SECRET` together:** a client deployment without the header transform, or an API without the secret, doesn't work with the other half (403 everywhere, or the API won't start). Roll both back or neither.

## Moving existing data (only if you have a database with local files) **(changes hosted data)**

A fresh production database (step 5) needs none of this. If you want to move a development or staging database that used `STORAGE_DRIVER=local`:

1. **Back up first:** `mongodump` the source database and copy the upload folder.
2. Restore the database into Atlas (`mongorestore`), or point the commands below at the database you're moving.
3. With an env file that has that `MONGODB_URI`, `UPLOAD_DIR` pointing at the copied upload folder, and the `S3_*` values:
   - `node --env-file=<file> server/src/scripts/files.js migrate --to=s3` (dry run: how many files would move)
   - `… migrate --to=s3 --apply`: for each file, reads the local bytes, checks them against the stored SHA-256, uploads them under the same key, reads them back and checks again, and only then switches the record's `provider` to `s3`. Files that are missing or don't match are listed and left as they were (exit code 1). It never deletes the local copy and never overwrites an object.
   - Run it again until it reports `total: 0`; it's safe to repeat.
4. **Rollback:** `… migrate --to=local --apply` switches records back (their local copies are still there). Files uploaded after the migration are copied back too.

## Operations

- **Logs:** JSON lines (pino) in Render's log view. Authorization headers, cookies and `Set-Cookie` are redacted; storage errors name the operation and status only; a failed start masks connection-string credentials and secrets.
- **Health:** Render restarts the service when `/api/v1/health` fails. On deploy, Render sends `SIGTERM`; the API stops accepting connections and gives requests 10 seconds to finish.
- **Storage housekeeping** (monthly, or after a storage incident): `files cleanup` (dry run) lists uploads that were never attached (a save that failed after its upload), stored objects with no record (a delete whose storage call failed) and records whose bytes are missing. `cleanup --apply` removes the first two, only when older than 24 hours (`--older-than-hours`), and rechecks each before deleting. Missing bytes are only reported.
- **Secrets:** rotate `ORIGIN_SECRET` as in step 8. Rotate the R2 token by creating a new one, updating `S3_*` on Render, redeploying, then revoking the old token. Rotating `JWT_ACCESS_SECRET` invalidates the current 15-minute access tokens only; refresh tokens are random values stored hashed, so clients refresh silently and nobody is signed out.
- **Backups:** Atlas M0 has no automated backups; schedule `mongodump` or use a paid tier. R2 has no versioning: deleting a file in the app deletes its object.

## Known limits

| Limit                         | Value                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------- |
| JSON body                     | 1 MB (413 above)                                                              |
| Trainer uploads               | PDF, DOCX, PPTX up to 20 MB; 30 per hour                                      |
| Student uploads               | PDF up to 10 MB; 30 per hour                                                  |
| Rate limits                   | sign-in/registration 10 per 15 min per IP; refresh 60; everything else 300    |
| Proxied request (Vercel)      | 120 s; request body limit for external routes not documented, check in step 7 |
| Rate-limit and reminder state | in memory per API instance: reset on restart, per instance if you scale out   |
| Free Render plan              | sleeps after 15 idle minutes; the first request then takes about a minute     |
| Virus scanning                | none: uploads are type-checked only (see the Phase 8 report)                  |
