# Training LMS

A learning management system for a full-stack trainer and their students. It covers courses and roadmaps, study materials, assignments, submissions and progress tracking. Built with MongoDB, Express, React and Node.

The design and the phase plan are in [docs/superpowers/specs/2026-10-14-training-lms-design.md](docs/superpowers/specs/2026-10-14-training-lms-design.md).

## Status

| Phase | Scope                                                                     | Status                                                                       |
| ----- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 0     | Planning                                                                  | ✅ Approved                                                                  |
| 1     | Foundation and authentication                                             | ✅ Implemented, waiting for review ([report](docs/phase-reports/phase-1.md)) |
| 2     | Courses and roadmaps                                                      | ⏳ Not started                                                               |
| 3–8   | Materials, assignments, student portal, review, notifications, deployment | ⏳ Not started                                                               |

## Requirements

- Node.js 22.12 or newer (npm 10)
- MongoDB 7 or newer, running locally on `mongodb://127.0.0.1:27017`, or a MongoDB Atlas connection string

## Setup

```bash
npm install                                  # installs root, server and client workspaces
cp server/.env.example server/.env           # then fill in the values below
npm run seed                                 # creates the trainer account (safe to run again)
npm run dev                                  # API on :5000, client on :5173
```

Open http://localhost:5173.

The values you must set in `server/.env`:

| Variable                                  | Purpose                                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `MONGODB_URI`                             | MongoDB connection string                                                                                                 |
| `JWT_ACCESS_SECRET`                       | 32+ random characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | The trainer login created by `npm run seed`. The password needs 8+ characters with a letter and a number                  |

Every other variable has a working default; [server/.env.example](server/.env.example) documents each one.

Students create their own accounts at `/register`. There is no public sign-up for trainers: the trainer account comes only from the seed.

## Scripts (run from the repository root)

| Command                                   | What it does                                                          |
| ----------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                             | Starts the API (with `node --watch`) and the Vite dev server together |
| `npm test`                                | Runs the server tests, then the client tests                          |
| `npm run lint`                            | Runs ESLint across both workspaces                                    |
| `npm run format` / `npm run format:check` | Runs Prettier (write / check)                                         |
| `npm run build`                           | Builds the client for production into `client/dist`                   |
| `npm run seed`                            | Creates the trainer account if it doesn't exist yet                   |

To run a single test file: `npm test -w server -- tests/auth.test.js` or `npm test -w client -- src/routes/guards.test.jsx`. Add `-t "name"` to filter by test name.

The server tests need the local MongoDB. Each test file creates and then drops its own `lms_test_*` database. Point them elsewhere with `TEST_MONGODB_URI`.

## How sign-in works

- The client always calls the API as `/api/v1/...` on its own origin. In development the Vite proxy forwards these calls; in production a Vercel rewrite does. Because of this, the refresh cookie is never a third-party cookie.
- **Access token:** a 15-minute JWT, held in memory only.
- **Refresh token:** a 7-day `httpOnly` cookie, limited to `/api/v1/auth`. It's rotated on every use, and reusing an old token revokes that login.
- **Logout:** revokes the session on the server. Other open tabs are signed out through a `BroadcastChannel` message.

The full design is in §11a of the spec.

## Project layout

```
client/   React 19 + Vite 8 + Tailwind CSS 4 single-page app
server/   Express 5 + Mongoose 8 REST API (/api/v1)
docs/     Design spec and per-phase reports
```
