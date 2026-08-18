# qDischarge — Single-Counter Deployment Package

This is a **standalone, self-contained copy** of the qDischarge backend and
frontend, packaged for a hospital/clinic running with a single OPD counter
(`HOSPITAL_ACTIVE_COUNTERS=1`). It was copied from the repo root and does
not depend on anything outside this folder — it can be zipped up and
handed to a site as-is.

```
packages/single-counter/
├── backend/     Spring Boot app (Java 21, Maven, Postgres/Flyway)
└── frontend/    React + Vite admin/patient UI
```

For the full feature list, API surface, and how everything works, see the
main repo [README.md](../../README.md) and [API.md](../../API.md) — this
package is functionally identical, just pinned to one counter.

## What's different from the main repo copy

Nothing in code. The only pin is in `backend/.env.example`:

```
HOSPITAL_ACTIVE_COUNTERS=1
```

Leave it at `1`. Setting it above `1` turns on the multi-counter board
(`CounterAssignmentService`, `/api/counters/**`) — for that, use the
`packages/multi-counter` package instead (once it exists) rather than
changing this one.

## Quick start

1. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   # fill in JWT_SECRET, ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH), DB_*, WA_* etc.
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
  automatically flow here. Re-copy from the repo root if you need to pull
  in fixes made upstream.
- Secrets (`.env`) are intentionally not copied — only `.env.example`.
  Create your own `.env` per deployment.
