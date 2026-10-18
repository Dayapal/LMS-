# End-to-end tests (Playwright)

```bash
npm run test:e2e:install                 # once: Chromium, Firefox and WebKit
npm run test:e2e                         # everything, all browsers (about 10 minutes)
npx playwright test --project=chromium   # one browser
npx playwright test e2e/auth.spec.js     # one file
E2E_SKIP_BUILD=1 npm run test:e2e        # reuse client/dist from the last run
npx playwright show-report               # the HTML report of the last run
```

## What runs

Playwright starts two servers (`playwright.config.js`):

1. **API** (`e2e/support/stack.js`): drops and reseeds the `lms_e2e` database on the local MongoDB (with the demo students), starts an in-memory S3 endpoint on port 9055, then runs `node server/src/server.js` in **production mode** (`NODE_ENV=production`, `STORAGE_DRIVER=s3`, secure cookies) on port 5055.
2. **Client**: `npm run build -w client`, then `vite preview` over **HTTPS** on port 4174 with a throwaway self-signed certificate (`e2e/support/cert.js`). The preview server forwards `/api` to the API like the Vercel rewrite and sends the same security headers as `client/vercel.json` (CSP included).

HTTPS is needed because the API always marks the refresh cookie `Secure` in production, and WebKit doesn't keep `Secure` cookies on plain `http://localhost`.

## Isolation

- Nothing touches `server/.env`, the development database or real storage. The stack refuses to reset a database whose name doesn't start with `lms_e2e` (override the URI with `E2E_MONGODB_URI`).
- Stored files live only in the in-memory S3 endpoint and disappear when the run ends.
- Each test creates its own students, so the browsers can run side by side.

## Requirements

- MongoDB on `127.0.0.1:27017` (or `E2E_MONGODB_URI`).
- OpenSSL for the certificate: on `PATH`, in Git for Windows (found automatically), or set `OPENSSL` to its path.
- Free ports 4174, 5055 and 9055.

## Projects

| Project           | Engine   | Device              | Specs                       |
| ----------------- | -------- | ------------------- | --------------------------- |
| `chromium`        | Chromium | Desktop, 1280 × 800 | all except `mobile.spec.js` |
| `firefox`         | Firefox  | Desktop, 1280 × 800 | all except `mobile.spec.js` |
| `webkit`          | WebKit   | Desktop, 1280 × 800 | all except `mobile.spec.js` |
| `mobile-chromium` | Chromium | Pixel 7 emulation   | `mobile.spec.js`            |
| `mobile-webkit`   | WebKit   | iPhone 14 emulation | `mobile.spec.js`            |

Emulation is a viewport, touch and user agent, not a real phone. Playwright's WebKit is close to Safari but isn't Safari; see the manual checklist in `docs/phase-reports/phase-8.md`.

## Every test also fails on

- an uncaught page error, and
- a Content Security Policy violation reported in the console.
