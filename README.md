# Clinic Queue Management System — Spring Boot (Java) port

This is a Java/Spring Boot port of [KrishnaDubeycodeProjects/hospital](https://github.com/KrishnaDubeycodeProjects/hospital),
a WhatsApp-driven clinic queue management system. The original backend
(Node.js/Express) has been rewritten 1:1 in Spring Boot; the React frontend
is unchanged and still talks to the same `/api/queue` and `/webhook` routes.

## What changed vs. the original

| Original (Node) | This port (Java) |
|---|---|
| `backend/index.js` | `ClinicQueueApplication.java` + `config/WebConfig.java` |
| `backend/utils/db.js` | `config/DatabaseInitializer.java` |
| `backend/utils/queueManager.js` | `service/QueueManagerService.java` |
| `backend/utils/whatsappSender.js` | `service/WhatsAppService.java` |
| `backend/routes/queue.js` | `controller/QueueController.java` |
| `backend/routes/webhook.js` | `controller/WebhookController.java` |
| `qrcode` npm package | `service/QrCodeService.java` (ZXing) |
| Express `cors()` + static/catch-all | `config/WebConfig.java` |
| `pg` (node-postgres) | Spring JDBC (`NamedParameterJdbcTemplate`) against the same Postgres schema |

The REST API, the `tokens` table schema, the admin-token auth model, the
QR payload format, and the WhatsApp message copy/flow are all preserved
exactly. `frontend/` is the original, untouched React app.

Two small deliberate deviations from the original (both bugs in the source,
not behavior worth reproducing):
- The backend now stays up and serves error responses if Postgres is
  unreachable (matches the *intent* of the original's fire-and-forget DB
  init — Node just doesn't crash because JS never fails fast on a bad
  connection pool at boot).
- Two WhatsApp message flows in `webhook.js` build their card off a token
  object that never had a `position`/`peopleAhead` field set, so the real
  bot silently rendered `undefined`/`NaN` in those two message paths. Java
  can't do that (unboxing a null `Integer` in arithmetic throws), so those
  are guarded to fall back to `0` instead of crashing.

## Requirements

- Java 21+
- Maven 3.9+
- A reachable PostgreSQL database (Supabase or otherwise) — same as the
  original

## Configuration

Environment variable names are unchanged from `backend/.env.example`, so an
existing `.env` from the original project can be reused as plain
environment variables (Spring doesn't read `.env` files itself — export
them, or pass `--DVAR=value`, or edit `src/main/resources/application.yml`
directly):

```
PORT=5000
FRONTEND_URL=http://localhost:5173
CLINIC_NAME=qDischarge

DB_HOST=...
DB_PORT=5432
DB_DATABASE=postgres
DB_USER=...
DB_PASSWORD=...

WA_PROVIDER=meta
META_ACCESS_TOKEN=...
META_PHONE_NUMBER_ID=...
META_API_VERSION=v25.0

EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=...
INSTANCE_NAME=clinic-bot

ADMIN_USERNAME=admin
ADMIN_PASSWORD=adminpass
ADMIN_TOKEN=clinic-admin-secret-token-2026

AVG_SERVICE_MINUTES=10
TOKEN_EXPIRY_HOURS=24
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

The server listens on `http://localhost:5000` (same default as the
original) and creates/migrates the `tokens` table on startup.

## Running the frontend

Unchanged from the original — see `frontend/README.md`:

```bash
cd frontend
npm install
npm run dev
```

- Admin: `http://localhost:5173/admin` (`admin` / `adminpass` by default)
- Patient tracker: `http://localhost:5173/patient/:tokenId`

To serve the frontend directly from Spring Boot instead (like the original
did with `express.static(frontend/dist)`), build it and copy the output
into the Java project's static resources:

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
POST   /api/queue/verify        (admin token required)
PUT    /api/queue/:id           (admin token required)

GET    /webhook/whatsapp        (Meta subscription verification)
POST   /webhook/whatsapp        (incoming WhatsApp messages)
```
