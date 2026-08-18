# qDischarge frontend

A single React app covering every role the backend exposes — public
patient check-in, the patient portal, the doctor portal, and the staff/
admin console — all talking directly to the Spring Boot backend's REST API
(see `../API.md`).

## Stack

Plain React 19 + Vite + `react-router-dom`, `axios`, and `html5-qrcode` for
in-browser QR scanning. No UI framework — styling is hand-rolled CSS
(`src/index.css`) following the "Clinical Clarity" design system (medical
blue, large touch targets, rounded cards) referenced from this project's
design brief.

## Running it

```bash
npm install
npm run dev
```

Set the backend URL in `.env` (defaults to `http://localhost:8088`, the
Spring Boot app's default port):

```
VITE_API_URL=http://localhost:8088
```

The backend's `ALLOWED_ORIGINS`/`FRONTEND_URL` must include wherever this
dev server runs (default `http://localhost:5173`) or the browser will block
requests with a CORS error.

To serve this app directly from Spring Boot instead of a separate dev
server:

```bash
npm run build
cp -r dist/* ../src/main/resources/static/
```

## Structure

```
src/
  api/client.js        -- one axios instance + typed endpoint functions per
                           backend controller (queue, hospitals, counters,
                           doctors, patients, OTP, DIGIPIN); handles the
                           {success, data|message|error} envelope and the
                           three independent JWTs (admin/patient/doctor)
  context/
    AuthContext.jsx     -- holds the three sessions, each in its own
                           localStorage slot, so a staff member, a patient,
                           and a doctor can all be signed in at once
    ToastContext.jsx    -- global toast notifications
  components/
    ui.jsx              -- shared primitives: Card, Button, Field, Table,
                           Badge/StatusBadge, StatCard, Modal, Spinner...
    Layout.jsx           -- the sidebar shell each role's dashboard renders in
    TokenCard.jsx        -- one patient token's live status/QR/ETA view,
                           shared by the public tracker and the patient portal
    QrScanner.jsx         -- camera-based QR reader (admin check-in, patient
                           doctor-access claim)
  pages/
    Landing.jsx, Book.jsx, Track.jsx, TokenDetail.jsx, Login.jsx
                          -- public: browse the hospital, book a token, watch
                           its live position, sign in as any role
    admin/                -- live queue + verify/status/no-show, counters
                           board, missed-queue triage, visit-history lookup,
                           hospital/department/time-slot/doctor-join-code
                           administration
    patient/              -- own active token, visit history, document
                           upload/download, doctor-access grants
    doctor/               -- profile + hospital join + schedule, generate a
                           patient-access request QR, view consenting
                           patients' documents
```

## Roles

Three completely independent sign-ins, matching the backend's JWT roles:

- **Patient** — phone + OTP (`/api/auth/otp/*`); the same call is both login
  and registration.
- **Doctor** — phone + OTP proves identity, then register (first time) or
  log in (`/api/doctors/*`).
- **Admin/Staff** — username + password (`/api/queue/login`).

Booking a token itself needs no login (`POST /api/queue`) — verifying by
OTP first is optional there unless the backend is configured with
`OTP_REQUIRED_FOR_REGISTRATION=true`, in which case the booking form's
inline OTP step becomes required.
