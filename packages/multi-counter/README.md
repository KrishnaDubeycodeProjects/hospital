# qDischarge — Multi-Counter Deployment Package

This is a **standalone, self-contained copy** of the qDischarge backend and
frontend, packaged for a hospital/clinic running with more than one OPD
counter (`HOSPITAL_ACTIVE_COUNTERS > 1`). It was copied from the repo root
and does not depend on anything outside this folder — it can be zipped up
and handed to a site as-is.

```
packages/multi-counter/
├── backend/     Spring Boot app (Java 21, Maven, Postgres/Flyway)
└── frontend/    React + Vite admin/patient UI
```

For the full feature list, API surface, and how everything works, see the
main repo [README.md](../../README.md) and [API.md](../../API.md) — this
package is functionally identical to `packages/single-counter`, just
configured for multiple counters instead of one.

## What's different from the single-counter package

Nothing in code — same backend, same frontend, same database schema. The
only difference is configuration, in `backend/.env.example`:

```
HOSPITAL_ACTIVE_COUNTERS=3   # set to this site's actual counter count (must be >1)
```

Once `activeCounters > 1`, `CounterAssignmentService` turns on the live
counter board: waiting tokens get assigned to individual counters, and
when a counter finishes a patient (complete or miss), only *that*
counter's next eligible token is pulled in — the others keep serving
whatever they already had. This is exposed via `/api/counters`
(`CounterController`):

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/counters` | Live board — public read, for the display board / admin dashboard |
| `POST` | `/api/counters/{counterId}/complete` | Mark the token at that counter done, pull the next one in |
| `POST` | `/api/counters/{counterId}/miss` | Mark the token at that counter missed, pull the next one in |

The plain single-counter flow (`PUT /api/queue/{id}`) still exists and
keeps working underneath — the counter board layers on top of it.

**Note:** the current admin frontend (`frontend/`) has no dedicated UI for
the counter board yet — it's API-only for now (see repo README). If your
rollout needs a per-counter screen, that's frontend work still to be done
in this package (or upstream, then re-copied here).

## Quick start

1. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   # fill in JWT_SECRET, ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH), DB_*, WA_*,
   # and HOSPITAL_ACTIVE_COUNTERS for this site's real counter count
   docker compose up -d --build
   ```
   This starts Postgres + the Spring Boot app (`:5000`), running Flyway
   migrations automatically on boot.

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev       # http://localhost:5173, talks to VITE_API_URL
   # or: npm run build   →  static files in frontend/dist/
   ```
   Check `frontend/.env` — `VITE_API_URL` should point at the backend
   (`http://localhost:5000/api` for local dev).

## Notes

- This folder is a point-in-time copy, not a symlink or git submodule —
  changes made in the main repo (`src/`, `frontend/`) do **not**
  automatically flow here, and neither do changes in
  `packages/single-counter`. Re-copy from the repo root if you need to
  pull in fixes made upstream.
- Secrets (`.env`) are intentionally not copied — only `.env.example`.
  Create your own `.env` per deployment.
