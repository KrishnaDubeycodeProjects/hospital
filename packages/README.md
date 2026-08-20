# Deployment Packages

Standalone, self-contained copies of the backend + frontend, one per
deployment shape. Each is a point-in-time copy of the repo root (not a
symlink/submodule) that can be zipped and handed to a site as-is — pull
fresh copies here after upstream changes if you need them.

- [`single-counter/`](single-counter/) — one OPD counter (`HOSPITAL_ACTIVE_COUNTERS=1`).
- [`multi-counter/`](multi-counter/) — more than one OPD counter, live counter board (`HOSPITAL_ACTIVE_COUNTERS>1`, `/api/counters/**`).

Same code both ways — the only difference is the `HOSPITAL_ACTIVE_COUNTERS`
value in each package's `backend/.env.example`. See each package's own
README for quick-start steps.
