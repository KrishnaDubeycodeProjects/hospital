# API Reference

Complete endpoint reference for the qDischarge clinic queue backend. For an
architectural overview, see [README.md](README.md).

## Conventions

- **Base URL**: `http://localhost:8080` (or wherever the app is deployed).
- **Content type**: `application/json` for all requests/responses except
  file uploads (`multipart/form-data`) and QR/document downloads (binary).
- **Response envelope**: almost every JSON response follows one of:
  ```json
  { "success": true, "data": { ... } }
  { "success": false, "message": "human-readable reason" }
  { "success": false, "error": "exception message" }
  ```
  Endpoints that don't follow this (login/OTP/doctor auth) are noted inline.
- **Auth header**: `Authorization: Bearer <jwt>`. Tokens are short-lived
  (`app.jwt-expiry-minutes`, default in `application.yml`) and carry one of
  three roles: `ROLE_ADMIN`, `ROLE_PATIENT`, `ROLE_DOCTOR`. A route marked
  "Admin JWT", "Patient JWT", or "Doctor JWT" below rejects tokens of any
  other role (or no token) with `401`/`403`.
- **Validation errors**: request bodies annotated with Bean Validation
  (`@NotBlank`, `@Pattern`, etc.) return `400` with a validation error body
  on bad input before the handler even runs.
- **Rate limiting**: a sliding 1-minute-window limiter (`RateLimitFilter`)
  applies to four routes — see each one below. Exceeding the limit returns
  `429` with `{ "success": false, "message": "Too many requests. Please slow down and try again shortly." }`.
- **Phone format**: everywhere a `phone` is accepted, it must match
  `^[+0-9][0-9 ()-]{4,20}$` (leading `+` optional, digits/spaces/parens/hyphens).

---

## Queue (`/api/queue`)

The original patient check-in / admin queue API. Reads and patient actions
are public; admin actions require an admin JWT.

### `POST /api/queue/login`
Admin login. Rate-limited (`app.rate-limit-login-per-minute`).

Request:
```json
{ "username": "admin", "password": "secret" }
```
Response `200`:
```json
{ "success": true, "token": "<admin JWT>" }
```
Response `401`: `{ "success": false, "message": "Invalid username or password." }`

### `GET /api/queue`
Full current queue snapshot. Public.

Response `200`: `data` is
```json
{
  "tokens": [ /* TokenDto[] */ ],
  "currentServing": 12,
  "stats": { "total": 20, "waiting": 5, "serving": 1, "completed": 13, "missed": 1 }
}
```

### `GET /api/queue/current`
The token currently being served. Public. `data` is a `TokenDto` (or `null`).

### `GET /api/queue/position/{phone}`
A patient's own active token + queue position. Public.
`404` if no active token exists for that phone.

### `GET /api/queue/history/{phone}`
**Admin JWT.** Every past completed visit under this phone number — can span
more than one patient's name/age if the number was reused. `data` is
`TokenHistoryDto[]`.

### `GET /api/queue/token/{id}`
Full details (including queue position) for one token by id. Public.
`404` if not found.

### `POST /api/queue`
Create a new token (patient check-in). Rate-limited
(`app.rate-limit-create-token-per-minute`).

Request:
```json
{
  "name": "Jane Doe",
  "age": 34,
  "phone": "+919876543210",
  "digipin": "39J-438-TJC7",
  "latitude": 19.0760,
  "longitude": 72.8777
}
```
`name`/`age` may be omitted if the flow captures them later (e.g. via the
WhatsApp bot). `phone` is required. `digipin` OR `latitude`+`longitude` are
optional — when given, the distance-based "get ready" window is computed
immediately (see [README](README.md) "Distance-based get ready notifications").

Response `200`:
```json
{ "success": true, "alreadyExists": false, "data": { /* TokenDto */ } }
```
`400` on validation failure (e.g. an existing active token blocks a duplicate).

### `POST /api/queue/{id}/location`
Patient shares/updates their GPS location (or a manually entered
DIGIPIN/lat-lon) for an existing token. Public.

Request: same shape as `SetLocationRequest` — `digipin`, or `latitude`+`longitude`.

Response `200`: updated `TokenDto`. `404` if token not found; `400` on bad location data.

### `GET /api/queue/closing-time-check?lat=&lon=`
Pre-registration feasibility check: "you're N km away, M minutes remain
before OPD closes — will you make it?" Public.

Response `200`: `data` is an `ArrivalFeasibility` object (distance, ETA,
minutes-until-close, and a boolean feasibility flag).

### `GET /api/queue/qr/{id}`
Returns a PNG QR code (image bytes, `Content-Type: image/png`,
`Cache-Control: public, max-age=86400`) encoding
`{ "tokenId": <id>, "type": "CLINIC_QUEUE_TOKEN", "timestamp": <epoch ms> }`.
Public.

### `POST /api/queue/verify`
**Admin JWT.** Verify (check in) a patient by scanning their QR or entering
a token id directly. Sends the patient a WhatsApp welcome notification.

Request (either form):
```json
{ "tokenId": 42 }
```
```json
{ "qrData": "{\"tokenId\":42,...}" }
```
`qrData` may also be a raw object, or a plain string containing a number.

Response `200`:
```json
{ "success": true, "message": "🎉 Token #42 (Jane Doe) verified successfully! ...", "data": { /* TokenDto */ } }
```
`400` if neither `tokenId` nor a parseable `qrData` is given; `404` if the token doesn't exist.

### `PUT /api/queue/{id}`
**Admin JWT.** Update a token's status.

Request:
```json
{ "status": "serving" }
```
Valid values: `waiting`, `serving`, `completed`, `missed`. `400` on any other value.

Response `200`: `data` is an `UpdateStatusResult` (updated token + any
side-effect info, e.g. next token pulled in). `404` if not found.

### Missed queue (`/api/queue/missed*`) — all **Admin JWT**

- `GET /api/queue/missed` — full missed-queue list (`TokenDto[]`).
- `GET /api/queue/missed/search?query=` — search missed tokens by id or phone.
- `POST /api/queue/missed/{id}/requeue` — move a missed token to the *front*
  of the waiting line (`priority_rank`, no renumbering). `404` if not in the
  missed queue.
- `POST /api/queue/missed/{id}/reject` — permanently reject a missed token
  (terminal `rejected` status, distinct from `missed`). `404` if not in the
  missed queue.

---

## Counters (`/api/counters`)

Multi-counter package — only meaningful once a hospital's `activeCounters > 1`.

### `GET /api/counters`
Public. Live counter board: which token each counter is serving.

### `POST /api/counters/{counterId}/complete`
**Admin JWT.** Marks the counter's current token completed and pulls in the
next eligible waiting token.

### `POST /api/counters/{counterId}/miss`
**Admin JWT.** Marks the counter's current token missed and pulls in the
next eligible waiting token.

---

## Hospitals (`/api/hospitals`)

Hospital directory: location (DIGIPIN-based), OPD hours, active counter
count. Reads are public; writes are admin-only.

### `GET /api/hospitals`
Public. `data` is `HospitalDto[]`.

### `GET /api/hospitals/{uriSlug}`
Public. `404` if not found.

### `POST /api/hospitals`
**Admin JWT.**

Request:
```json
{
  "uriSlug": "city-clinic",
  "name": "City Clinic",
  "address": "123 Main St",
  "location": { "digipin": "39J-438-TJC7" },
  "openTime": "09:00",
  "closeTime": "17:00",
  "avgPatientsPerDay": 96,
  "avgServiceMinutes": null,
  "activeCounters": 1
}
```
`uriSlug` must match `^[a-z0-9-]{2,100}$`. `location` is required (either
`digipin` or `latitude`+`longitude`). `avgServiceMinutes`, if given,
overrides the derived `(openHours ÷ avgPatientsPerDay)` calculation.
`400` on validation failure.

### `GET /api/hospitals/{uriSlug}/doctor-join-code`
**Admin JWT.** The code to hand a doctor so they can self-link their
account (`POST /api/doctors/join-hospital`). `data`: `{ "doctorJoinCode": "..." }`.
`404` if hospital not found.

### `POST /api/hospitals/{uriSlug}/doctor-join-code/regenerate`
**Admin JWT.** Rotates the join code (e.g. it leaked); existing doctor
links are unaffected. Same response shape as above.

### `PUT /api/hospitals/{uriSlug}/location`
**Admin JWT.** Relocate a hospital.

Request: `SetLocationRequest` (`digipin`, or `latitude`+`longitude`).
Response `200`: updated `HospitalDto`. `404` if not found; `400` on bad location.

---

## DIGIPIN utility (`/api/location/digipin`)

Stateless encode/decode — no side effects on tokens/hospitals. Public.

### `POST /api/location/digipin/encode`
Request: `{ "latitude": 19.0760, "longitude": 72.8777 }`
Response `200`: `data`: `{ "digipin": "39J438TJC7", "formattedDigipin": "39J-438-TJC7" }`
`400` if coordinates are out of range.

### `POST /api/location/digipin/decode`
Request: `{ "digipin": "39J-438-TJC7" }`
Response `200`: `data`: `{ "latitude": 19.0760, "longitude": 72.8777 }`
`400` if the DIGIPIN is malformed.

---

## Phone OTP (`/api/auth/otp`)

Public, rate-limited (`app.rate-limit-otp-per-minute`) phone verification.
A verified phone stays "recently verified" for `app.otp-ttl-minutes`. A
successful `/verify` **is** patient login — it issues a `ROLE_PATIENT` JWT
used by every `/api/patients/**` route; there's no separate password.

### `POST /api/auth/otp/send`
Request: `{ "phone": "+919876543210" }`
Response `200` (success) / `502` (delivery failed):
```json
{ "success": true, "message": "OTP sent." }
```

### `POST /api/auth/otp/verify`
Request: `{ "phone": "+919876543210", "code": "123456" }` (`code` must be 4-8 digits)
Response `200`:
```json
{ "success": true, "message": "Phone verified.", "token": "<patient JWT>" }
```
Response `400` on wrong/expired code: `{ "success": false, "message": "..." }`

---

## Doctors (`/api/doctors`)

Doctor accounts: phone+OTP identity (same model as patients), linked to a
hospital via its join code, plus the QR-based patient-access-request flow.

### `POST /api/doctors/register`
Public — call right after the phone's OTP is verified (proof of identity).

Request: `{ "name": "Dr. Rao", "phone": "+919876543210" }`
Response `200`/`400`:
```json
{ "success": true, "message": "...", "token": "<doctor JWT>", "data": { /* DoctorDto */ } }
```

### `POST /api/doctors/login`
Public — returning doctor, phone must already be OTP-verified.

Request: `{ "phone": "+919876543210" }`
Response: same shape as `register`.

### `POST /api/doctors/join-hospital`
**Doctor JWT.** Links the calling doctor to a hospital by its join code.

Request: `{ "hospitalCode": "ABC123" }`
Response `200`: `data` is the updated `DoctorDto`. `400` if the code is invalid.

### `GET /api/doctors/me`
**Doctor JWT.** The calling doctor's own profile (`DoctorDto`, includes
`hospitalName` if linked).

### `POST /api/doctors/access-requests`
**Doctor JWT.** Generates a fresh access-request code (valid 30 minutes)
that a patient can scan/claim to grant this doctor access to their
documents. Requires the doctor to have already joined a hospital.

Response `200`: `data` is an `AccessRequestDto`. `400` if the doctor hasn't joined a hospital yet.

### `GET /api/doctors/access-requests/{code}/qr`
**Doctor JWT.** Returns the request code as a scannable PNG
(`Content-Type: image/png`, `Cache-Control: no-store`). `404` if the code
doesn't exist.

### `GET /api/doctors/patients`
**Doctor JWT.** Every patient currently granting this doctor access,
grouped by `(name, age)` with their uploaded documents.

### `GET /api/doctors/patients/documents/{docId}/file`
**Doctor JWT.** Downloads one document's file bytes — only if the doctor
currently has active access to that document's patient. `404` if the
document doesn't exist; `403` if access isn't currently granted.

---

## Patients (`/api/patients`)

**All routes require a Patient JWT** (issued by `POST /api/auth/otp/verify`).
Every action operates on the caller's own phone number, taken from the JWT
— there is no "which patient" parameter anywhere.

### `GET /api/patients/history`
This phone's token-booking history. `data` is `TokenHistoryDto[]`.

### `POST /api/patients/documents` (multipart/form-data)
Upload a prescription/report photo.

Form fields: `file` (the image), `docType` (`prescription` or `report`),
`patientName`, `patientAge` (optional), `hospitalId` (optional).

Response `200`: `data` is the created `PatientDocumentDto`. `400` on bad
input, `500` on I/O failure.

### `GET /api/patients/documents`
Every document this phone has uploaded (for itself or a family member).
`data` is `PatientDocumentDto[]` — metadata only, no file bytes.

### `GET /api/patients/documents/{id}/file`
Downloads one document's file bytes. `404` if it doesn't exist or doesn't
belong to the caller's phone.

### `POST /api/patients/access/{code}/accept`
Claims a doctor's access-request code (from their QR): grants that doctor
access to this patient's documents and sends a WhatsApp notice (which
includes the `revoke <id>` command — see below).

Response `200`: `data` is the created `AccessGrantDto`. `400` if the code
is invalid, expired, or already claimed.

### `GET /api/patients/access`
Doctors who currently have active access — name + hospital.
`data` is `AccessGrantDto[]`.

### `GET /api/patients/access/history`
Every grant ever issued from this phone, active or revoked.
`data` is `AccessGrantDto[]`.

### `POST /api/patients/access/{grantId}/revoke`
Revokes an active grant. Response `200`: `{ "success": true, "data": { "revoked": true } }`.
`404` if no active grant with that id exists for the caller's phone.

---

## WhatsApp webhook (`/webhook/whatsapp`)

Public — called by Meta's Cloud API or an Evolution API instance, not by
frontend clients.

### `GET /webhook/whatsapp`
Meta's subscription-verification handshake.
Query params: `hub.mode`, `hub.verify_token`, `hub.challenge`.
Returns the challenge string (`200`, `text/plain`) if `hub.mode=subscribe`
and the token matches `app.webhook-verify-token`; `403` on mismatch, `400`
if params are missing.

### `POST /webhook/whatsapp`
Incoming message handler (both Meta and Evolution payload shapes).
Rate-limited (`app.rate-limit-webhook-per-minute`). Always responds `200
"EVENT_RECEIVED"` (or a JSON error body on internal failure) — see the
[README](README.md) for the full conversational flow (language picker,
name/age registration, generate/status/cancel intents, `revoke <id>`).

---

## Health (`/actuator`)

- `GET /actuator/health/liveness` — public.
- `GET /actuator/health/readiness` — public.
- Everything else under `/actuator/**` — **Admin JWT**.

---

## Shared response shapes

**`TokenDto`** (fields present depend on which endpoint populated them —
absent fields are simply omitted from the JSON, not `null`):
`id, phone, name, age, status, sessionStep, createdAt, servedAt,
completedAt, missedAt, isVerified, verifiedAt, position, peopleAhead,
currentServing, hospitalId, patientDigipin, patientLat, patientLon,
distanceKm, notifyTokensAhead, priorityWindow, notifiedReadyAt,
priorityRank, rejectedAt, counterId`.
`status` is one of `registering_name | waiting | serving | completed |
missed | rejected`.

**`HospitalDto`**: `id, uriSlug, name, address, digipin, formattedDigipin,
latitude, longitude, openTime, closeTime, avgServiceMinutes,
activeCounters, createdAt, updatedAt`.

**`DoctorDto`**: `id, phone, name, hospitalId, hospitalName, createdAt`.

**`AccessGrantDto`**: `id, doctorId, doctorName, hospitalName,
patientPhone, grantedAt, revokedAt, revokedBy`.

**`AccessRequestDto`**: `id, code, doctorId, status (pending|claimed|expired),
createdAt, expiresAt`.

**`PatientDocumentDto`**: `id, patientPhone, patientName, patientAge,
docType (prescription|report), hospitalId, uploadedByDoctorId, fileName,
contentType, fileSize, createdAt`.

**`TokenHistoryDto`**: `id, tokenId, phone, name, age, hospitalId,
counterId, createdAt, servedAt, completedAt, archivedAt`.
