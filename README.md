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

Two small deliberate deviations from the original, both bugs in the source
rather than behavior worth reproducing: the backend now stays live (serving
error responses) if Postgres is unreachable instead of relying on JS's
fail-slow default; and two WhatsApp message flows that referenced a
never-set `position`/`peopleAhead` field (rendering `undefined`/`NaN` in the
real bot) fall back to `0` instead of throwing on a null unboxing.

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

## API surface (unchanged from the original)

```
POST   /api/queue/login
GET    /api/queue
GET    /api/queue/current
GET    /api/queue/position/:phone
GET    /api/queue/token/:id
POST   /api/queue
GET    /api/queue/qr/:id
POST   /api/queue/verify        (admin JWT required)
PUT    /api/queue/:id           (admin JWT required)

GET    /webhook/whatsapp        (Meta subscription verification)
POST   /webhook/whatsapp        (incoming WhatsApp messages)

GET    /actuator/health/liveness
GET    /actuator/health/readiness
```
