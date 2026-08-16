# Clinic Queue Management System — Spring Boot (Java) port

This is a Java/Spring Boot port of [KrishnaDubeycodeProjects/hospital](https://github.com/KrishnaDubeycodeProjects/hospital),
a WhatsApp-driven clinic queue management system. The original backend
(Node.js/Express) has been rewritten 1:1 in Spring Boot and then hardened
for production: JWT auth, TLS, input validation, rate limiting, async I/O,
versioned migrations, and container-native health checks. The React
frontend is functionally unchanged and still talks to the same
`/api/queue` and `/webhook` routes.

## What changed vs. the original

| Original (Node) | This port (Java) |
|---|---|
| `backend/index.js` | `ClinicQueueApplication.java` + `config/WebConfig.java` |
| `backend/utils/db.js` | `config/FlywayMigrationRunner.java` + `db/migration/V1__init_schema.sql` |
| `backend/utils/queueManager.js` | `service/QueueManagerService.java` |
| `backend/utils/whatsappSender.js` | `service/WhatsAppService.java` (now async) |
| `backend/routes/queue.js` | `controller/QueueController.java` |
| `backend/routes/webhook.js` | `controller/WebhookController.java` |
| `qrcode` npm package | `service/QrCodeService.java` (ZXing) |
| Express `cors()` + static/catch-all | `config/WebConfig.java` + `security/SecurityConfig.java` |
| `pg` (node-postgres) | Spring JDBC (`NamedParameterJdbcTemplate`) against the same schema |
| Single static `ADMIN_TOKEN` header check | `security/` package: BCrypt password check + signed, expiring JWTs |
| *(none)* | Rate limiting, Actuator health probes, Docker packaging |

The REST API, the admin-token auth *model* (a Bearer token gates
`POST /api/queue/verify` and `PUT /api/queue/:id`), the QR payload format,
and the WhatsApp message copy/flow are all preserved. `frontend/` is the
original React app — its `axiosConfig.js` treats the login token as an
opaque string, so it needs no changes to work against the new JWT-based auth.
It doesn't yet have UI for the features below (hospitals/geo/OTP/counters/
missed-queue) — those are API-only for now, reachable via the endpoints
listed under "API surface".

Two small deliberate deviations from the original, both bugs in the source
rather than behavior worth reproducing: the backend now stays live (serving
error responses) if Postgres is unreachable instead of relying on JS's
fail-slow default; and two WhatsApp message flows that referenced a
never-set `position`/`peopleAhead` field (rendering `undefined`/`NaN` in the
real bot) fall back to `0` instead of throwing on a null unboxing.

## Features beyond the original

On top of the 1:1 port, this backend adds a hospital/geo/multi-counter
layer (`db/migration/V2__hospitals_geo_missed_counters.sql`):

- **Hospitals** (`hospital/HospitalService`, `HospitalController`): a
  directory of hospitals, each with a stable `uriSlug`, name/address, a
  [DIGIPIN](https://www.indiapost.gov.in/) location (India Post's open geo
  code — `geo/DigipinService`, a straight port of the reference JS encoder/
  decoder), OPD open/close hours, and an active-counter count. This
  single-tenant deployment always operates as one hospital
  (`app.hospital-uri-slug`), seeded/kept in sync from `HOSPITAL_*` env vars
  on every boot by `HospitalSeedRunner`; the directory itself supports
  multiple hospitals for deployments that want to run more than one.
  `POST /api/hospitals` requires a `location` (DIGIPIN or lat/lon) for every
  hospital. The per-patient service time used in every wait-time estimate
  (`avgServiceMinutes`) is normally derived rather than typed in directly:
  give `avgPatientsPerDay` (how many patients the hospital treats on an
  average day) alongside `openTime`/`closeTime` (how many hours it's open),
  and it's computed as (open hours in minutes) ÷ `avgPatientsPerDay`; an
  explicit `avgServiceMinutes` still overrides that calculation if given.
- **Distance-based "get ready" notifications** (`geo/GeoDistanceService`):
  a patient can share their current GPS location or enter one manually
  (DIGIPIN or lat/lon) when creating a token or afterwards
  (`POST /api/queue/:id/location`). Their straight-line distance from the
  hospital is turned into an ETA (`app.geo-avg-speed-kmh`), which sets how
  many tokens before their turn they get pinged to head over
  (`notifyTokensAhead`, clamped between `NOTIFY_MIN_TOKENS` and
  `NOTIFY_MAX_TOKENS`) and how wide their check-in "priority window" is
  (`notifyTokensAhead x activeCounters`). A token that was pinged but never
  checked in (QR-scanned/verified) by the time its turn comes up is
  auto-skipped to `missed` instead of stalling the queue.
  `GET /api/queue/closing-time-check` answers "can I still make it before
  OPD closes?" before a patient commits to registering.
- **Patient registration: name, age, and visit history** (`QueueManagerService`):
  the WhatsApp bot asks for the patient's *age* right after their name (a new
  `awaiting_age` session step between `awaiting_name` and `menu` — the token
  only actually joins the queue once both are captured), and `POST
  /api/queue` accepts `age` directly too. A phone number was already free to
  book a new token for a *different* patient (different name/age) the moment
  its previous token left `waiting`/`serving`/`registering_name` — nothing
  blocks that on `phone` alone. What's new is a durable per-visit ledger:
  the instant a token is marked `completed`, it's archived into
  `token_history` (independent of the live `tokens` table, so today's
  queue/stats keep working exactly as before), browsable per phone number
  via the admin-only `GET /api/queue/history/{phone}`.
- **Missed-queue management** (`QueueManagerService` missed-queue methods,
  `/api/queue/missed*`): auto-skipped or manually-missed tokens land in a
  searchable (by id or phone) missed queue instead of disappearing. Staff
  can requeue one back to the *front* of the waiting line
  (`priority_rank`, no renumbering everyone else) or reject it permanently
  (a new `rejected` terminal status, distinct from `missed`).
- **Multi-counter package** (`CounterAssignmentService`,
  `/api/counters/**`): once a hospital's `activeCounters > 1`, the live
  board assigns waiting tokens to individual counters and, when a counter
  finishes (complete or miss), pulls only the next eligible token into
  *that* counter — the others keep serving whatever they already had. A
  single-counter hospital doesn't need this; the plain
  `PUT /api/queue/:id` flow already covers it.
- **Phone OTP verification** (`OtpService`, `/api/auth/otp/*`): optional
  gate (`OTP_REQUIRED_FOR_REGISTRATION`) on token creation. Three providers,
  selected by `OTP_PROVIDER`: `twilio` delegates entirely to Twilio's
  Verify API; `twilio-sms` generates and BCrypt-hashes its own 6-digit code
  (like `log` below) but delivers it as a real SMS via Twilio's plain
  Messages API through a Messaging Service (`TWILIO_MESSAGING_SERVICE_SID`)
  instead of the Verify API; `log` (the dev-friendly default) generates and
  BCrypt-hashes its own 6-digit code and logs the plaintext instead of
  sending an SMS, so the flow is fully testable with zero external accounts.
  If a Twilio send call itself fails (account issue, network, Twilio outage
  — not "wrong code"), `twilio`/`twilio-sms` both automatically fall back to
  generating a code and delivering it over WhatsApp instead of SMS;
  `verifyOtp` transparently checks the code against whichever path actually
  sent it.
- **Patient accounts, doctor accounts, and consent-based record access**
  (`DoctorService`, `PatientDocumentService`, `AccessService`,
  `/api/patients/**`, `/api/doctors/**`): a phone number's OTP verification
  *is* its login -- `POST /api/auth/otp/verify` returns a `ROLE_PATIENT` JWT
  on success, no separate password. Patients can then:
  `GET /api/patients/history` (their token-booking history, see
  `token_history` above), `POST/GET /api/patients/documents` (upload/list
  prescription/report photos, stored as Postgres BYTEA -- `patient_documents`
  -- 8MB cap, no cloud storage configured for this project), and manage
  who can see them.
  A **doctor** is also a phone+OTP account (`POST /api/doctors/register` then
  `/login`, gated the same way token registration is), which links to
  exactly one hospital by entering that hospital's `doctor_join_code`
  (`POST /api/doctors/join-hospital`; admin reads/rotates the code via
  `GET`/`POST /api/hospitals/{slug}/doctor-join-code[/regenerate]`, never
  exposed on the public hospital directory reads). Getting a doctor access
  to a patient's records is a QR/code consent flow: the doctor generates a
  short-lived request (`POST /api/doctors/access-requests`, rendered as a
  scannable PNG at `GET .../access-requests/{code}/qr`), and the patient's
  own device claims it (`POST /api/patients/access/{code}/accept`) --
  scanning happens on the patient's side, matching how every other
  patient-facing flow here already works. Claiming fires an immediate
  WhatsApp notice (`BotMessages#accessGranted`) with a same-channel escape
  hatch: replying **`revoke <id>`** to the bot revokes it right there,
  independent of whatever patient app calls the REST endpoints
  (`GET /api/patients/access[/history]`,
  `POST /api/patients/access/{id}/revoke`) -- only the granting patient can
  revoke, in either path. Once granted, a doctor's
  `GET /api/doctors/patients` groups every accessible document by
  **(name, age)**, not just phone -- the same distinction `token.age`
  introduced, since one WhatsApp number can cover a whole family.
- **DIGIPIN utility** (`/api/location/digipin/encode|decode`): stateless
  lat/lon <-> DIGIPIN conversion, with no token/hospital side effects —
  useful for a frontend that wants to show/edit a DIGIPIN directly.
- **WhatsApp provider failover** (`WhatsAppService`): `WA_PROVIDER` picks
  which of Meta Cloud API / Evolution API is tried *first*, not the only
  one used — if that call fails, every send (plain text, and interactive
  buttons/CTA/poll/list degrading to text) automatically retries the other
  configured provider before giving up, so a single provider outage doesn't
  silently drop patient notifications.

## Security hardening

- **Auth**: `POST /api/queue/login` checks the admin username/password with
  BCrypt (constant-time, never a plaintext `==`) and returns a signed,
  expiring JWT (`app.jwt-expiry-minutes`, default 12h) instead of a single
  forever-lived shared secret. `POST /api/queue/verify` and
  `PUT /api/queue/:id` require a valid token with the admin role, enforced
  declaratively by Spring Security (`security/SecurityConfig.java`), not a
  hand-rolled header check.
- **Passwords**: set `ADMIN_PASSWORD_HASH` (a BCrypt hash) in production.
  `ADMIN_PASSWORD` (plaintext) is still supported as a dev-only fallback —
  it's hashed once in memory at startup and never compared as plaintext.
- **JWT signing key**: `JWT_SECRET` should be set explicitly (32+ random
  bytes, base64 or raw) in any real deployment. If unset, a random key is
  generated per-process with a loud warning — fine for local dev, but it
  invalidates all sessions on restart and can't work across replicas.
- **Transport encryption**: the DB connection uses `sslmode=require`. The
  app itself can terminate TLS natively (`SERVER_SSL_ENABLED=true` + a
  keystore) or, more commonly in production, sit behind a TLS-terminating
  load balancer/reverse proxy (nginx, Caddy, an ALB) — either way, don't
  serve this over plain HTTP outside local dev.
- **CORS**: restricted to `ALLOWED_ORIGINS` (comma-separated), not a
  wildcard. Defaults to `FRONTEND_URL`.
- **Input validation**: request bodies are validated Java records
  (`jakarta.validation`), not raw untyped maps.
- **Rate limiting**: per-IP sliding-window limits on login, patient token
  creation, and the WhatsApp webhook (`RATE_LIMIT_*_PER_MINUTE`). It's
  in-memory, so it's per-instance — see "Scaling notes" below.
- **Webhook verification** now uses its own dedicated `WEBHOOK_VERIFY_TOKEN`
  secret instead of reusing the admin token for two unrelated purposes.
- **At-rest encryption**: phone numbers aren't application-level encrypted,
  because the original matching logic relies on flexible `LIKE`/`REPLACE`
  queries that ciphertext can't support without a much more complex
  searchable-encryption scheme. Use your Postgres host's disk-level
  encryption at rest instead (Supabase/RDS/Cloud SQL all do this by default).

## Scalability

- **Async WhatsApp dispatch**: outbound WhatsApp API calls run on a bounded
  background thread pool (`ASYNC_*` settings) instead of blocking the HTTP
  request thread, so a slow/unreachable WhatsApp provider can't starve
  Tomcat's worker threads.
- **Stateless auth**: JWTs carry no server-side session, so any number of
  app replicas can validate them independently behind a load balancer, as
  long as they share `JWT_SECRET`.
- **Connection pooling**: HikariCP pool size is configurable
  (`DB_POOL_MAX_SIZE`, `DB_POOL_MIN_IDLE`) and won't block app startup if
  Postgres is briefly unreachable.
- **Versioned schema + indexes**: Flyway (`db/migration/`) replaces the
  original's ad hoc `CREATE TABLE IF NOT EXISTS`, adding indexes on
  `phone`, `status`, `(status, id)`, and `created_at` for the hot queries
  (phone lookup, position counting, FIFO next-waiting scan).
- **Health probes for orchestration**: `/actuator/health/liveness` reflects
  only "is the JVM/HTTP server up" (safe for restart policies);
  `/actuator/health/readiness` reflects DB reachability (safe for
  load-balancer routing) — so a transient DB blip doesn't get healthy
  instances killed.
- **Docker**: multi-stage `Dockerfile` + `docker-compose.yml` (app +
  Postgres) for containerized, horizontally-scalable deployment.
- **Known single-node limit**: the rate limiter is in-memory. For a
  multi-replica deployment, swap `ratelimit/RateLimiterService.java` for a
  Redis-backed limiter so the window is shared across instances.

## Requirements

- Java 21+
- Maven 3.9+
- A reachable PostgreSQL database (Supabase or otherwise)

## Configuration

```
# --- Server ---
PORT=5000
SERVER_SSL_ENABLED=false            # set true + the 4 vars below to terminate TLS natively
SERVER_SSL_KEY_STORE=
SERVER_SSL_KEY_STORE_PASSWORD=
SERVER_SSL_KEY_STORE_TYPE=PKCS12
SERVER_SSL_KEY_ALIAS=

# --- App ---
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173   # comma-separated; defaults to FRONTEND_URL
CLINIC_NAME=qDischarge
AVG_SERVICE_MINUTES=10
TOKEN_EXPIRY_HOURS=24

# --- Database ---
DB_HOST=...
DB_PORT=5432
DB_DATABASE=postgres
DB_USER=...
DB_PASSWORD=...
DB_POOL_MAX_SIZE=10
DB_POOL_MIN_IDLE=2

# --- Admin auth ---
ADMIN_USERNAME=admin
ADMIN_PASSWORD=adminpass            # dev fallback; prefer ADMIN_PASSWORD_HASH in prod
ADMIN_PASSWORD_HASH=                # a bcrypt hash, e.g. from `htpasswd -bnBC 10 "" 'yourpassword' | tr -d ':\n'`
JWT_SECRET=                         # REQUIRED in production: 32+ random bytes (base64 or raw)
JWT_EXPIRY_MINUTES=720
WEBHOOK_VERIFY_TOKEN=clinic_queue_token

# --- WhatsApp ---
WA_PROVIDER=meta
META_ACCESS_TOKEN=...
META_PHONE_NUMBER_ID=...
META_API_VERSION=v25.0
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=...
INSTANCE_NAME=clinic-bot

# --- Rate limiting (requests/minute/IP) ---
RATE_LIMIT_LOGIN_PER_MINUTE=10
RATE_LIMIT_WEBHOOK_PER_MINUTE=120
RATE_LIMIT_CREATE_TOKEN_PER_MINUTE=20

# --- Async WhatsApp dispatch pool ---
ASYNC_CORE_POOL_SIZE=4
ASYNC_MAX_POOL_SIZE=16
ASYNC_QUEUE_CAPACITY=500

# --- Geo / distance-based notification ---
GEO_AVG_SPEED_KMH=25                # assumed travel speed for the distance -> ETA estimate
NOTIFY_MIN_TOKENS=2                 # floor of the "get ready" notification window
NOTIFY_MAX_TOKENS=12                # ceiling of the "get ready" notification window

# --- Hospital location (DIGIPIN, or lat/lon to derive one) ---
HOSPITAL_URI_SLUG=main              # which hospitals row this deployment operates as
HOSPITAL_DIGIPIN=                   # either this...
HOSPITAL_LATITUDE=                  # ...or these two (a DIGIPIN is then derived)
HOSPITAL_LONGITUDE=
HOSPITAL_OPEN_TIME=09:00
HOSPITAL_CLOSE_TIME=17:00
HOSPITAL_ACTIVE_COUNTERS=1          # >1 turns on the multi-counter package (/api/counters)

# --- OTP verification (phone-number gate on patient registration) ---
OTP_PROVIDER=log                    # 'log' (dev: code is logged, not sent), 'twilio' (Verify API), or 'twilio-sms' (Messages API)
OTP_REQUIRED_FOR_REGISTRATION=false
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_MESSAGING_SERVICE_SID=       # only needed for OTP_PROVIDER=twilio-sms
OTP_TTL_MINUTES=10
RATE_LIMIT_OTP_PER_MINUTE=5
```

## Running the backend

```bash
mvn spring-boot:run
```

or build a jar and run it:

```bash
mvn -DskipTests package
java -jar target/clinic-queue-backend.jar
```

Or with Docker:

```bash
cp .env.example .env   # fill in JWT_SECRET at minimum
docker compose up --build
```

The server listens on `http://localhost:5000` by default and migrates the
`tokens` table on startup via Flyway.

## Running the frontend

Unchanged from the original — see `frontend/README.md`:

```bash
cd frontend
npm install
npm run dev
```

- Admin: `http://localhost:5173/admin` (`admin` / `adminpass` by default)
- Patient tracker: `http://localhost:5173/patient/:tokenId`

To serve the frontend directly from Spring Boot instead, build it and copy
the output into the Java project's static resources:

```bash
cd frontend
npm run build
cp -r dist/* ../src/main/resources/static/
```

Any path Spring can't otherwise resolve to a REST route or a static file
falls back to `index.html`, so client-side routing keeps working.

## API surface

The original queue/webhook routes are unchanged; everything from "Hospital
directory" down is new (see "Features beyond the original" above).

```
POST   /api/queue/login
GET    /api/queue
GET    /api/queue/current
GET    /api/queue/position/:phone
GET    /api/queue/token/:id
POST   /api/queue                       (optional digipin/latitude/longitude fields)
POST   /api/queue/:id/location          (share/update a patient's location)
GET    /api/queue/closing-time-check?lat=&lon=
GET    /api/queue/qr/:id
POST   /api/queue/verify                (admin JWT required)
PUT    /api/queue/:id                   (admin JWT required)

GET    /api/queue/missed                (admin JWT required)
GET    /api/queue/missed/search?query=
POST   /api/queue/missed/:id/requeue    (admin JWT required)
POST   /api/queue/missed/:id/reject     (admin JWT required)

GET    /api/hospitals
GET    /api/hospitals/:uriSlug
POST   /api/hospitals                   (admin JWT required)
PUT    /api/hospitals/:uriSlug/location (admin JWT required)

GET    /api/counters                    (multi-counter board)
POST   /api/counters/:counterId/complete (admin JWT required)
POST   /api/counters/:counterId/miss     (admin JWT required)

POST   /api/location/digipin/encode
POST   /api/location/digipin/decode

POST   /api/auth/otp/send
POST   /api/auth/otp/verify

GET    /webhook/whatsapp                (Meta subscription verification)
POST   /webhook/whatsapp                (incoming WhatsApp messages)

GET    /actuator/health/liveness
GET    /actuator/health/readiness
```
