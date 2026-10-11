# Jansamvaad ASHA Worker Mobile App & Backend: Comprehensive Codebase Documentation

This document provides an exhaustive, code-level documentation for the **ASHA Worker Mobile Application (`asha-app`)** and the **ASHA Worker Standalone Backend (`asha-backend`)**. Every file, class, method, state machine, database schema, data flow, API endpoint, security filter, and UI component is documented directly from the implementation.

---

## Table of Contents

1. [System Architecture & Data Flow](#1-system-architecture--data-flow)
2. [ASHA Backend (`asha-backend`) — Exhaustive Code Walkthrough](#2-asha-backend-asha-backend--exhaustive-code-walkthrough)
   - [2.1 Database Schema (`schema.sql`)](#21-database-schema-schemasql)
   - [2.2 Configuration & Properties (`AppProperties.java`, `WebConfig.java`)](#22-configuration--properties-apppropertiesjava-webconfigjava)
   - [2.3 Security Engine (`SecurityConfig.java`, `JwtAuthFilter.java`, `JwtService.java`, `CurrentUser.java`)](#23-security-engine-securityconfigjava-jwtauthfilterjava-jwtservicejava-currentuserjava)
   - [2.4 REST Controller Layer](#24-rest-controller-layer)
     - [`AshaWorkerController.java`](#241-ashaworkercontrollerjava)
     - [`SurveyController.java`](#242-surveycontrollerjava)
     - [`FollowUpController.java`](#243-followupcontrollerjava)
     - [`SyncController.java`](#244-synccontrollerjava)
     - [`AnmController.java`](#245-anmcontrollerjava)
     - [`ChoAnalyticsController.java`](#246-choanalyticscontrollerjava)
   - [2.5 Service Layer (Business Logic)](#25-service-layer-business-logic)
     - [`SyncService.java`](#251-syncservicejava)
     - [`SurveyService.java`](#252-surveyservicejava)
     - [`FollowUpService.java`](#253-followupservicejava)
     - [`AshaWorkerService.java`](#254-ashaworkerservicejava)
     - [`AnmService.java`](#255-anmservicejava)
   - [2.6 Background Schedulers (`ReferralExpiryScanner.java`)](#26-background-schedulers-referralexpiryscannerjava)
   - [2.7 Data Transfer Objects (DTOs) & Seed Runner](#27-data-transfer-objects-dtos--seed-runner)
3. [ASHA Mobile App (`asha-app`) — Exhaustive Code Walkthrough](#3-asha-mobile-app-asha-app--exhaustive-code-walkthrough)
   - [3.1 Type System (`types/storage.ts`)](#31-type-system-typesstoragets)
   - [3.2 Offline Storage Engine (`storage/OfflineStorageService.ts`, `uuid.ts`, `seedData.ts`)](#32-offline-storage-engine-storageofflinestorageservicets-uuidts-seeddatats)
   - [3.3 Reactive State & Context Providers](#33-reactive-state--context-providers)
     - [`AuthContext.tsx`](#331-authcontexttsx)
     - [`LanguageContext.tsx`](#332-languagecontexttsx)
     - [`OfflineDataContext.tsx`](#333-offlinedatacontexttsx)
   - [3.4 Networking & Offline Synchronization (`api/syncApi.ts`)](#34-networking--offline-synchronization-apisyncapits)
   - [3.5 Speech Synthesis & Voice Recognition Engine (`voice/speechEngine.ts`)](#35-speech-synthesis--voice-recognition-engine-voicespeechenginets)
   - [3.6 Clinical Summarizer & Fuzzy Search (`services/clinicalSummary.ts`, `fuzzySearch.ts`)](#36-clinical-summarizer--fuzzy-search-servicesclinicalsummaryts-fuzzysearchts)
   - [3.7 Reusable UI Components Library](#37-reusable-ui-components-library)
     - [`Header.tsx`](#371-headertsx)
     - [`BottomNav.tsx`](#372-bottomnavtsx)
     - [`DotGrid.tsx`](#373-dotgridtsx)
     - [`FamilyBottomSheet.tsx`](#374-familybottomsheettsx)
     - [`ChildVaccinationModal.tsx`](#375-childvaccinationmodaltsx)
     - [`RealQrCode.tsx`](#376-realqrcodetsx)
     - [`StatusBadge.tsx`](#377-statusbadgetsx)
     - [`VoiceGuideBanner.tsx`](#378-voiceguidebannertsx)
   - [3.8 Mobile Screens & Workflows](#38-mobile-screens--workflows)
     - [`HomeScreen.tsx`](#381-homescreentsx)
     - [`SurveyQuestionScreen.tsx`](#382-surveyquestionscreentsx)
     - [`FollowUpScreen.tsx`](#383-followupscreentsx)
     - [`AshaMeetingsScreen.tsx`](#384-ashameetingsscreentsx)
     - [`MemberResponsesScreen.tsx`](#385-memberresponsesscreentsx)
     - [`FamiliesScreen.tsx` & `FamilyDetailScreen.tsx`](#386-familiesscreentsx--familydetailscreentsx)
     - [`SendDataScreen.tsx` & `SyncSuccessScreen.tsx`](#387-senddatascreentsx--syncsuccessscreentsx)
     - [`ChoDashboardScreen.tsx`](#388-chodashboardscreentsx)
     - [`AnmOpenFormsScreen.tsx`, `AnmFormDetailScreen.tsx`, `AnmWorkerDetailScreen.tsx`](#389-anmopenformsscreentsx-anmformdetailscreentsx-anmworkerdetailscreentsx)
     - [`ProfileScreen.tsx` & `SettingsScreen.tsx`](#3810-profilescreentsx--settingsscreentsx)
   - [3.9 Root Application Orchestrator (`App.tsx`)](#39-root-application-orchestrator-apptsx)

---

## 1. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ASHA WORKER MOBILE APPLICATION                        │
│                  (React Native / Expo Web on Port 8081)                     │
│                                                                             │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌──────────────────┐  │
│  │   UI Screens Layer    │  │   Context Engine     │  │   Voice Engine   │  │
│  │ • HomeScreen          │  │ • AuthContext        │  │ • Web Speech TTS │  │
│  │ • SurveyQuestionScreen│◄─┼─► LanguageContext    │◄─┼─► Speech-to-Text │  │
│  │ • FollowUpScreen      │  │ • OfflineDataContext │  │ • Crucial Mic   │  │
│  │ • AshaMeetingsScreen  │  └──────────┬───────────┘  └──────────────────┘  │
│  └──────────┬────────────┘             │                                    │
│             │                          ▼                                    │
│             │               ┌──────────────────────┐                        │
│             └──────────────►│ OfflineStorageService│                        │
│                             │   (AsyncStorage)     │                        │
│                             │ • Local 24-Grid Data │                        │
│                             │ • Outbox FIFO Queue  │                        │
│                             └──────────┬───────────┘                        │
└────────────────────────────────────────┼────────────────────────────────────┘
                                         │ HTTP REST (JSON / Bearer JWT)
                                         │ Port 8089 /api/sync/*
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ASHA STANDALONE BACKEND                             │
│                  (Spring Boot 3.3.5 on Port 8089)                           │
│                                                                             │
│  ┌──────────────────┐   ┌──────────────────────────┐   ┌─────────────────┐  │
│  │  JwtAuthFilter   ├──►│   REST Controllers       ├──►│ Service Layer   │  │
│  │  (Shared Secret) │   │ • SyncController         │   │ • SyncService   │  │
│  │  Role Evaluation │   │ • SurveyController       │   │ • SurveyService │  │
│  └──────────────────┘   │ • FollowUpController     │   │ • FollowUpServ. │  │
│                         │ • AshaWorkerController   │   │ • AnmService    │  │
│                         │ • AnmController          │   └────────┬────────┘  │
│                         │ • ChoAnalyticsController │            │           │
│                         └──────────────────────────┘            │           │
│                                                                 │           │
│  ┌─────────────────────────────────┐                            │           │
│  │ ReferralExpiryScanner Scheduler │                            │           │
│  │ (Hourly Scan for Expired Passes)│                            │           │
│  └────────────────┬────────────────┘                            │           │
│                   │                                             │           │
│                   └──────────────────────┬──────────────────────┘           │
│                                          │ NamedParameterJdbcTemplate       │
│                                          ▼                                  │
│                         ┌──────────────────────────────────┐                │
│                         │     PostgreSQL (Port 5432)       │                │
│                         │     Schema: `clinicqueue`        │                │
│                         │ • asha_workers   • anm_profiles  │                │
│                         │ • survey_templates               │                │
│                         │ • survey_responses (JSONB)       │                │
│                         │ • follow_up_tasks                │                │
│                         │ • family_units & members         │                │
│                         └──────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ASHA Backend (`asha-backend`) — Exhaustive Code Walkthrough

### 2.1 Database Schema (`schema.sql`)

The schema file is located at `asha-backend/src/main/resources/schema.sql`. It defines the relational tables, indexes, and JSONB structures within the `clinicqueue` schema. All statements use `IF NOT EXISTS` to ensure idempotency.

```sql
-- 1. ASHA Workers Table
CREATE TABLE IF NOT EXISTS asha_workers (
  id                SERIAL PRIMARY KEY,
  phone             VARCHAR(50) NOT NULL UNIQUE,
  name              VARCHAR(100) NOT NULL,
  village_name      VARCHAR(200) NOT NULL,
  block_name        VARCHAR(200),
  district_name     VARCHAR(200),
  phc_id            INT,
  anm_phone         VARCHAR(50),
  is_active         BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_asha_phone ON asha_workers (phone);
CREATE INDEX IF NOT EXISTS idx_asha_village ON asha_workers (village_name);
```
- **Lines 7–19**: Defines `asha_workers`.
  - `phone`: Primary lookup key for authentication and association with surveys and households. Marked `UNIQUE`.
  - `name`: Full name of the ASHA worker (e.g., "Sunita Devi").
  - `village_name`: Village jurisdiction covered by this ASHA.
  - `anm_phone`: Links the worker to her supervising Auxiliary Nurse Midwife (ANM).
  - `is_active`: Flag to activate/deactivate accounts without data deletion.
- **Lines 20–21**: Indexes on `phone` (fast login and token lookup) and `village_name` (geographical aggregation for CHO analytics).

```sql
-- 2. ANM Profiles Table
CREATE TABLE IF NOT EXISTS anm_profiles (
  id                SERIAL PRIMARY KEY,
  phone             VARCHAR(50) NOT NULL UNIQUE,
  name              VARCHAR(100) NOT NULL,
  phc_name          VARCHAR(200),
  qr_code_data      VARCHAR(200) NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_anm_phone ON anm_profiles (phone);
CREATE UNIQUE INDEX IF NOT EXISTS idx_anm_qr ON anm_profiles (qr_code_data);
```
- **Lines 24–33**: Stores supervising ANM profiles.
  - `qr_code_data`: Unique cryptographic token encoded into the ANM's physical QR badge. When an ASHA worker scans this badge in `SendDataScreen.tsx`, the client validates this string to direct data synchronization.
  - Unique index `idx_anm_qr` guarantees no two ANMs share a verification badge.

```sql
-- 3. Survey Templates Table
CREATE TABLE IF NOT EXISTS survey_templates (
  id                SERIAL PRIMARY KEY,
  category_code     VARCHAR(50) NOT NULL,
  category_label    VARCHAR(100) NOT NULL,
  category_label_hi VARCHAR(100),
  icon_name         VARCHAR(50),
  version           INT NOT NULL DEFAULT 1,
  is_active         BOOLEAN DEFAULT TRUE,
  questions         JSONB NOT NULL,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_st_active
  ON survey_templates (category_code, version) WHERE is_active = TRUE;
```
- **Lines 36–49**: Stores dynamic questionnaire definitions.
  - `category_code`: Key code (`PREGNANCY`, `CHILD`, `DISEASE`, `GENERAL`).
  - `category_label_hi`: Localized label in Devanagari Hindi.
  - `questions`: PostgreSQL `JSONB` column containing question definitions: ID, type (`RADIO`, `BOOLEAN`, `TEXT`, `NUMBER`), labels in multiple languages, and validation criteria.
  - Partial unique index ensures only one active template exists per `category_code` and `version`.

```sql
-- 4. Survey Responses Table
CREATE TABLE IF NOT EXISTS survey_responses (
  id                  SERIAL PRIMARY KEY,
  family_unit_id      INT NOT NULL,
  family_member_id    INT NOT NULL,
  template_id         INT NOT NULL REFERENCES survey_templates(id),
  category_code       VARCHAR(50) NOT NULL,
  asha_worker_phone   VARCHAR(50) NOT NULL,
  answers             JSONB NOT NULL,
  synced_to_anm       BOOLEAN NOT NULL DEFAULT FALSE,
  target_anm_phone    VARCHAR(50),
  synced_at           TIMESTAMP,
  offline_id          VARCHAR(50),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sr_family ON survey_responses (family_unit_id);
CREATE INDEX IF NOT EXISTS idx_sr_member ON survey_responses (family_member_id);
CREATE INDEX IF NOT EXISTS idx_sr_asha ON survey_responses (asha_worker_phone);
CREATE INDEX IF NOT EXISTS idx_sr_anm ON survey_responses (target_anm_phone, synced_to_anm);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sr_offline
  ON survey_responses (offline_id) WHERE offline_id IS NOT NULL;
```
- **Lines 51–71**: Stores collected responses.
  - `answers`: Flexible JSONB payload holding responses, audio voice note transcripts, and crucial notes (`crucialVoiceNote`).
  - `synced_to_anm`: Boolean flag indicating whether the ANM supervisor has reviewed and approved the record.
  - `offline_id`: Client-generated UUID (`generateUUID()`). The partial unique index `idx_sr_offline` prevents duplicate submissions if an offline device uploads the same outbox record multiple times.

```sql
-- 5. Follow-Up Tasks Table
CREATE TABLE IF NOT EXISTS follow_up_tasks (
  id                  SERIAL PRIMARY KEY,
  family_unit_id      INT NOT NULL,
  family_member_id    INT NOT NULL,
  asha_worker_phone   VARCHAR(50) NOT NULL,
  task_type           VARCHAR(50) NOT NULL,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  due_date            DATE NOT NULL,
  status              VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  source_referral_id  INT,
  completed_at        TIMESTAMP,
  offline_id          VARCHAR(50),
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ft_asha ON follow_up_tasks (asha_worker_phone, status);
CREATE INDEX IF NOT EXISTS idx_ft_due ON follow_up_tasks (due_date, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ft_offline
  ON follow_up_tasks (offline_id) WHERE offline_id IS NOT NULL;
```
- **Lines 73–92**: Tasks requiring home visits or checks.
  - `task_type`: Categorizes follow-ups (`REFERRAL_MISSED`, `ANC_CHECKUP`, `IMMUNIZATION`, `NCD_SCREENING`).
  - `status`: Lifecycle states (`PENDING`, `COMPLETED`, `CANCELLED`).
  - `source_referral_id`: Foreign key link to `clinicqueue.course_referrals`. Auto-populated when patient misses a hospital referral appointment.

```sql
-- 6. Family Units Extensions (NO GPS — House Numbers & Spatial Numbers Only)
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS village_name VARCHAR(200);
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS house_number VARCHAR(50);
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS sequential_number INT;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS visit_interval_days INT;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS next_visit_date DATE;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS asha_worker_phone VARCHAR(50);
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMP;
```
- **Lines 94–100**: Extends the shared `family_units` table without invasive GPS tracking.
  - `sequential_number`: 1 to 24 matching the 3x8 physical dot grid of the village layout.
  - `visit_interval_days`: 7, 15, or 30 days based on clinical vulnerability.

---

### 2.2 Configuration & Properties (`AppProperties.java`, `WebConfig.java`)

#### `AppProperties.java`
- `@ConfigurationProperties(prefix = "app")`: Binds YAML properties under the `app` namespace into strongly-typed Java beans.
- `jwtSecret`: 256-bit HMAC secret string shared with the primary clinic queue backend. Ensures tokens signed by the main backend are verified here.
- `jwtExpiryMinutes`: Expiration window (default: 1440 minutes / 24 hours).
- `allowedOrigins`: List of permitted CORS origins (supports `*` for Expo mobile web bundling).

#### `WebConfig.java`
- Implements `WebMvcConfigurer`. Configures static resource routing for Expo Web assets (`/static/**`, `/_expo/**`) so that the compiled React Native web client can be served directly from Spring Boot if hosted monolithically.

---

### 2.3 Security Engine (`SecurityConfig.java`, `JwtAuthFilter.java`, `JwtService.java`, `CurrentUser.java`)

#### `SecurityConfig.java`
- **Lines 37–39**: Declares `BCryptPasswordEncoder` bean.
- **Lines 42–87**: Configures the HTTP `SecurityFilterChain`:
  - `cors(...)`: Enables custom CORS policy allowing all HTTP verbs (`GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`, `PATCH`).
  - `csrf.disable()`: Disables CSRF tokens because authentication is purely token-based and stateless.
  - `sessionManagement(STATELESS)`: Disables HTTP session creation.
  - `exceptionHandling`:
    - `authenticationEntryPoint`: Writes HTTP 401 with JSON payload `{"success": false, "message": "Unauthorized. Token is missing or invalid."}`.
    - `accessDeniedHandler`: Writes HTTP 403 with JSON payload `{"success": false, "message": "Forbidden. Insufficient privileges."}`.
  - `authorizeHttpRequests`:
    - Public endpoints: `/actuator/health/**`, `/api/asha/register`, `/api/anm/register`, `/api/surveys/templates/**`, `/api/surveys/categories`.
    - Protected endpoints (`/api/asha/**`, `/api/surveys/**`, `/api/followups/**`, `/api/sync/**`): Require `ROLE_PATIENT`, `ROLE_DOCTOR`, or `ROLE_ADMIN`.
    - ANM routes (`/api/anm/**`): Accessible to ANM supervisors and doctors.
    - CHO Analytics (`/api/cho/**`): Restricted to `ADMIN` or `DOCTOR`.
  - `addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)`: Injects JWT inspection before Spring's authentication filter.

#### `JwtAuthFilter.java`
- Extends `OncePerRequestFilter`.
- Inspects the `Authorization` header of each incoming request:
  - If header is absent or does not start with `Bearer `, filter execution continues along the chain.
  - If present, extracts the substring after `Bearer `.
  - Calls `jwtService.validateToken(token)`.
  - If valid, extracts the phone number (subject) and roles claim.
  - Creates a `UsernamePasswordAuthenticationToken` containing a `CurrentUser` principal and `SimpleGrantedAuthority` collection.
  - Stores this token in `SecurityContextHolder.getContext().setAuthentication(...)`.

#### `JwtService.java`
- Uses `io.jsonwebtoken` (JJWT 0.12.6) with HMAC-SHA256 (`Keys.hmacShaKeyFor(secret.getBytes())`).
- `parseClaims(token)`: Validates signature and expiry date, returning `Claims` object.
- `extractPhone(token)`: Returns subject claim.
- `extractRoles(token)`: Parses comma-delimited or list-based role claims.

---

### 2.4 REST Controller Layer

#### 2.4.1 `AshaWorkerController.java` (`/api/asha`)
- **`GET /api/asha/profile`**:
  - Injects `@AuthenticationPrincipal CurrentUser user`.
  - Calls `ashaWorkerService.getProfile(user.getPhone())`.
  - Returns `AshaWorkerDto` containing worker ID, name, village, block, district, assigned ANM phone, and active status.
- **`GET /api/asha/dashboard`**:
  - Compiles real-time KPI metrics for the mobile dashboard:
    - Total families assigned in the 24-grid.
    - Total vulnerable individuals (pregnant women, chronic disease patients, infants).
    - Pending follow-ups and overdue count.
    - Unsynced survey count.
- **`POST /api/asha/register`**:
  - Public endpoint to register a new ASHA worker profile with name, phone, village name, and supervising ANM phone.

#### 2.4.2 `SurveyController.java` (`/api/surveys`)
- **`GET /api/surveys/categories`**:
  - Calls `surveyService.listCategories()`. Returns available categories with question counts.
- **`GET /api/surveys/templates`**:
  - Query parameter `categoryCode` (optional). Returns active `SurveyTemplateDto` with embedded questions JSONB.
- **`POST /api/surveys/responses`**:
  - Ingests `SurveyResponseDto`. Writes answers to PostgreSQL and executes clinical side-effects (e.g., flagging `is_pregnant = true` on the family member).
- **`GET /api/surveys/responses`**:
  - Query filters: `familyUnitId`, `memberId`, `categoryCode`. Returns historical responses including recorded voice notes.

#### 2.4.3 `FollowUpController.java` (`/api/followups`)
- **`GET /api/followups`**:
  - Returns follow-up tasks for the authenticated worker, optionally filtered by status (`PENDING`, `COMPLETED`).
- **`GET /api/followups/overdue`**:
  - Returns tasks where `due_date < CURRENT_DATE` and `status = 'PENDING'`.
- **`GET /api/followups/today`**:
  - Returns tasks due today.
- **`POST /api/followups/{id}/complete`**:
  - Marks task completed, records completion timestamp and clinical resolution notes.
- **`POST /api/followups`**:
  - Manually creates a new follow-up task from the app.

#### 2.4.4 `SyncController.java` (`/api/sync`)
- **`POST /api/sync/upload`**:
  - Receives `SyncUploadRequest` containing queued offline data (new families, members, completed surveys, follow-up completions). Returns counts of accepted and rejected records.
- **`GET /api/sync/download`**:
  - Parameter `since` (ISO timestamp). Returns delta updates for families, members, survey templates, and newly assigned follow-up tasks.

#### 2.4.5 `AnmController.java` (`/api/anm`)
- **`GET /api/anm/profile`**: Returns ANM profile matching the authenticated phone.
- **`GET /api/anm/verify-qr?code=...`**: Verifies scanned QR code against `anm_profiles.qr_code_data`.
- **`GET /api/anm/workers`**: Lists all ASHA workers assigned to this ANM.
- **`GET /api/anm/forms`**: Lists pending unreviewed survey responses from assigned workers.
- **`POST /api/anm/forms/{id}/verify`**: Marks a survey response as verified (`synced_to_anm = true`).

#### 2.4.6 `ChoAnalyticsController.java` (`/api/cho`)
- **`GET /api/cho/village-summary`**: Aggregates population health data for Community Health Officers (total pregnancies, high-risk cases, immunization coverage, missed referral rates across villages).

---

### 2.5 Service Layer (Business Logic)

#### 2.5.1 `SyncService.java`
`SyncService` coordinates offline-to-online data reconciliation.
- **`parseSafeId(Object obj)`** (Lines 36–48): Sanitizes integer IDs arriving from the client. If the mobile app generated a UUID or non-numeric string, it extracts trailing digits or returns null to prevent SQL parsing errors.
- **`upload(String ashaPhone, SyncUploadRequest request)`** (Lines 50–140):
  - Iterates over `request.getFamilies()`: Performs `INSERT INTO clinicqueue.family_units` with parameters `headName`, `villageName`, `houseNumber`, `sequentialNumber`, and `asha_worker_phone`.
  - Iterates over `request.getMembers()`: Performs `INSERT INTO clinicqueue.family_members` with parameters `family_unit_id`, `name`, `dob`, `age`, `gender`, `relationship`, `phone`.
  - Iterates over `request.getSurveys()`: Translates payload into `SurveyResponseDto`, wraps JSON answers in PostgreSQL `PGobject("jsonb")`, and inserts via `ON CONFLICT (offline_id) DO NOTHING`.
  - Iterates over `request.getFollowUps()`: Inserts newly generated follow-ups or marks existing tasks completed via `completed_at = NOW()`.
- **`download(String ashaPhone, Instant since)`** (Lines 142–246):
  - Queries modified `family_units` where `asha_worker_phone = :phone` and `updated_at > :since`.
  - Queries associated `family_members`.
  - Queries active `survey_templates`.
  - Queries pending `follow_up_tasks`.
  - Returns a unified `SyncDownloadResponse`.

#### 2.5.2 `SurveyService.java`
- **`submitResponse(SurveyResponseDto body)`**:
  - Executes parameterized insert into `clinicqueue.survey_responses`.
  - Uses `ON CONFLICT (offline_id) DO NOTHING` for idempotent writes.
  - Executes clinical side-effects:
    - Updates `family_members.last_survey_date = NOW()`.
    - If `categoryCode == 'PREGNANCY'` and answer `isPregnant == true`, updates `family_members.is_pregnant = true`.
- **`listResponses(...)`**:
  - Joins `survey_responses` with `family_units` and `family_members` to return human-readable names and house numbers alongside JSONB answers.

#### 2.5.3 `FollowUpService.java`
- **`listFollowUps`**, **`listOverdue`**, **`listToday`**:
  - Uses `NamedParameterJdbcTemplate` with dynamic filtering.
  - Joins with `family_units` (`head_name`, `house_number`) and `family_members` (`member_name`).
- **`completeFollowUp(Integer id, String notes)`**:
  - Sets `status = 'COMPLETED'`, records completion timestamp, and appends notes to description.

---

### 2.6 Background Schedulers (`ReferralExpiryScanner.java`)

Located at `asha-backend/src/main/java/com/jansamvaad/asha/scheduler/ReferralExpiryScanner.java`.
- **Annotation `@Scheduled(fixedRate = 3600000)`**: Executes once every hour (3,600,000 milliseconds).
- **Core Query** (Lines 25–29):
  ```sql
  SELECT cr.*, c.patient_phone, c.family_member_id
  FROM clinicqueue.course_referrals cr
  JOIN clinicqueue.courses c ON cr.course_id = c.id
  WHERE cr.status = 'issued' AND cr.valid_until < CURRENT_DATE
  ```
- **Execution Logic**:
  1. Finds all priority referral cards (`urgent_7d`, `semi_urgent_14d`, `routine_30d`) that were issued but expired without being marked `completed` or `scanned` at the hospital counter.
  2. For each expired referral, verifies whether a `follow_up_task` has already been generated via `checkSql`.
  3. Resolves the patient's assigned ASHA worker:
     - First tries matching by `family_member_id` via `clinicqueue.family_members` -> `clinicqueue.family_units`.
     - Falls back to matching by `patient_phone` in `family_units`.
  4. Inserts a new task into `clinicqueue.follow_up_tasks`:
     - `task_type`: `'REFERRAL_MISSED'`
     - `title`: `'Missed referral: ' || reason`
     - `due_date`: `CURRENT_DATE + 3` (gives ASHA worker 3 days to perform a home visit and investigate why the patient missed their hospital appointment).

---

### 2.7 Data Transfer Objects (DTOs) & Seed Runner

- **`SyncUploadRequest.java`**: POJO holding lists of families, members, surveys, follow-ups, and meetings queued in local storage.
- **`SyncDownloadResponse.java`**: POJO containing server delta lists and server timestamp.
- **`SurveyResponseDto.java`**: Maps survey response fields and JSONB answers dictionary.
- **`FollowUpTaskDto.java`**: Maps task details, family head name, member name, house number, and urgency string.
- **`SurveyTemplateSeedRunner.java`**: Implements `CommandLineRunner`. On application boot, checks if `survey_templates` is empty. If so, parses predefined JSON templates for `PREGNANCY`, `CHILD`, and `DISEASE` and inserts them with `version = 1`.

---

## 3. ASHA Mobile App (`asha-app`) — Exhaustive Code Walkthrough

### 3.1 Type System (`types/storage.ts`)

Located at `asha-app/src/types/storage.ts`. Defines TypeScript interfaces for all data structures:

```typescript
export type GridStatusType = '7days' | '15days' | '30days' | 'visited' | 'noData';
```
- Categorizes house vulnerability:
  - `'7days'`: High vulnerability (infants, high-risk pregnancies, acute illness) — Red dot.
  - `'15days'`: Moderate vulnerability (chronic diseases, routine ANC) — Orange dot.
  - `'30days'`: Low vulnerability / healthy household — Yellow dot.
  - `'visited'`: Visited recently — Green dot.
  - `'noData'`: Unsurveyed — Gray dot.

```typescript
export interface FamilyUnit {
  id: string; // UUID
  sequentialNumber: number; // 1 to 24 on physical grid
  houseNumber: number | string;
  headName: string;
  primaryPhone: string;
  villageName: string;
  visitIntervalDays: 7 | 15 | 30 | null;
  nextVisitDate: string;
  lastVisitedAt: string | null;
  ashaWorkerPhone: string;
  status: GridStatusType;
  totalMembers: number;
  hasPregnancy: boolean;
  hasDisease: boolean;
  hasChild: boolean;
  toiletType?: 'Septic Tank' | 'Soak Pit' | 'Open Defecation' | 'Other';
  waterSource?: 'Handpump' | 'India Mark-II' | 'Well' | 'Tap Water' | 'Other';
  bplCard?: boolean;
  religion?: 'Hindu' | 'Muslim' | 'Sikh' | 'Christian' | 'Other';
  casteCategory?: 'SC' | 'ST' | 'OBC' | 'General' | 'Other';
  markedForHomeVisit?: boolean;
  updatedAt: string;
}
```
- Models a household unit. Includes official Gram Survey Registry fields (`toiletType`, `waterSource`, `bplCard`, `casteCategory`).

```typescript
export interface FamilyMember {
  id: string;
  familyUnitId: string;
  name: string;
  initials: string;
  dob?: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  relationship: string;
  phone?: string;
  fatherOrHusbandName?: string;
  maritalStatus?: 'Unmarried' | 'Married' | 'Widow' | 'Widower';
  education?: 'Illiterate' | 'Primary' | 'Middle' | 'High School' | 'Graduate' | 'Other';
  abhaNumber?: string;
  isAbhaLinked: boolean;
  isPregnant: boolean;
  expectedDeliveryDate?: string;
  isHrp?: boolean; // High Risk Pregnancy
  hasChronicCondition: boolean;
  chronicConditionType?: string;
  isNcdPatient?: boolean;
  ncdDiagnosis?: string;
  isChild?: boolean;
  lastSurveyDate?: string;
  followUpDueDate?: string;
  followUpReason?: string;
  updatedAt: string;
}
```
- Models an individual resident. Captures ABDM ABHA status, pregnancy flags, NCD diagnoses, and clinical follow-up dates.

```typescript
export interface OutboxItem {
  id: string;
  action: OutboxAction;
  payload: any;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  createdAt: string;
  syncedAt?: string;
  retryCount: number;
}
```
- FIFO outbox record holding offline changes until network connectivity or ANM Wi-Fi synchronization is established.

---

### 3.2 Offline Storage Engine (`storage/OfflineStorageService.ts`, `uuid.ts`, `seedData.ts`)

Located at `asha-app/src/storage/OfflineStorageService.ts`. Implements client-side persistence over `@react-native-async-storage/async-storage`.

- **Storage Keys** (Lines 22–31):
  - `@asha_families_v2`, `@asha_members_v2`, `@asha_surveys_v2`, `@asha_followups_v2`, `@asha_vaccinations_v2`, `@asha_meetings_v2`, `@asha_outbox_v2`, `@asha_initialized_v2`.
- **`initialize()`** (Lines 39–60):
  - Checks if `@asha_initialized_v2` exists in AsyncStorage.
  - If null, seeds the storage with complete 24-household grid data from `seedData.ts`.
- **`getFamilies()` & `saveFamily()`** (Lines 66–105):
  - Retrieves all families. Guarantees a minimum of 24 households for grid rendering.
  - When saving, assigns a UUID via `generateUUID()`, updates `updatedAt`, and writes a `CREATE_FAMILY` or `UPDATE_FAMILY` action to the outbox.
- **`getMembers()` & `saveMember()`** (Lines 111–160):
  - Automatically calculates initials safely (`member.name ? member.name.trim().charAt(0).toUpperCase() : 'M'`).
  - Appends member and queues `ADD_MEMBER` into outbox.
- **`getFollowUps()` & `toggleFollowUp()`** (Lines 210–250):
  - Toggles `isCompleted` flag and records `completedAt`. Queues `COMPLETE_FOLLOWUP` into outbox.
- **Outbox Management** (Lines 370–440):
  - `addToOutbox(action, payload)`: Appends an `OutboxItem` with status `PENDING`, `retryCount: 0`, and timestamp.
  - `markOutboxItemSynced(id)`: Changes status to `SYNCED`.
  - `clearSyncedOutbox()`: Deletes processed items to free mobile storage.

#### `uuid.ts`
- Generates RFC-4122 compliant UUID v4 strings using crypto random numbers, enabling client-side primary key generation in offline mode.

#### `seedData.ts`
- Provides 24 predefined realistic rural Indian households (Chandpur village, House Nos. 1 to 24), members, follow-up tasks, meetings, and immunization records.

---

### 3.3 Reactive State & Context Providers

#### 3.3.1 `AuthContext.tsx`
- Manages user identity and active role: `ASHA`, `ANM`, or `CHO`.
- Stores authentication token in AsyncStorage.
- Provides `switchRole(role)` allowing health workers and supervisors to toggle role views during field demonstrations.

#### 3.3.2 `LanguageContext.tsx`
- Multi-lingual translation engine supporting Hindi (`hi`), Marathi (`mr`), and English (`en`).
- Contains a dictionary of translated strings for medical questions, form titles, buttons, alert banners, and validation messages.
- Exposes `useLanguage()` hook returning `t(key)` helper and current language code.

#### 3.3.3 `OfflineDataContext.tsx`
Located at `asha-app/src/context/OfflineDataContext.tsx`. The central state coordinator for the application.
- **State Properties**:
  - `families`, `members`, `followUps`, `surveys`, `childVaccinations`, `meetings`, `outbox`.
  - `isLoading`, `isSyncing`, `isOnline`.
- **Auto-Sync Listener** (Lines 110–135):
  - Regularly pings the backend health endpoint.
  - When connectivity transitions from offline to online (`!prevOnline && isOnline`), triggers background synchronization.
- **`submitSurvey(survey)`**:
  - Persists survey response to local storage via `OfflineStorageService.saveSurvey`.
  - Updates member's local profile (`isPregnant = true`, `lastSurveyDate`).
  - Recalculates family vulnerability status on the 24-grid (e.g., changes status from `'30days'` to `'7days'`).
  - Refreshes local state.
- **`simulateMissedReferral(...)`**:
  - Testing and demonstration helper that inserts an overdue referral task into local storage and updates the village grid.

---

### 3.4 Networking & Offline Synchronization (`api/syncApi.ts`)

Located at `asha-app/src/api/syncApi.ts`.
- Manages HTTP communication with `http://localhost:8089` (or production URL).
- **`ping()`**: Quick 2-second timeout health check to verify backend connectivity.
- **`uploadBatch(token, outboxItems)`**:
  - Bundles pending outbox actions into a single `SyncUploadRequest` JSON payload.
  - Sends to `POST /api/sync/upload`.
  - On success, marks processed outbox items as `SYNCED`.
- **`downloadDelta(token, lastSyncTimestamp)`**:
  - Sends `GET /api/sync/download?since=...`.
  - Merges incoming server changes into local AsyncStorage.

---

### 3.5 Speech Synthesis & Voice Recognition Engine (`voice/speechEngine.ts`)

Located at `asha-app/src/voice/speechEngine.ts`. Provides zero-cost, offline voice capabilities.

#### `SpeechEngine` (Text-to-Speech)
```typescript
static async speak(text: string, lang = 'hi-IN', rate = 0.9, onStart?: () => void, onEnd?: () => void): Promise<void>
```
- Uses the browser/system `window.speechSynthesis`.
- Cancels any running utterance to prevent audio overlap (`speechSynthesis.cancel()`).
- Voice Selection Algorithm (Lines 21–32):
  - Enumerates local offline voices via `window.speechSynthesis.getVoices()`.
  - Matches language prefix (`hi` for Hindi, `mr` for Marathi).
  - Selects regional Indian accent voice if available.
- Sets playback rate to `0.9` for clear rural speech comprehension.
- Attaches `onstart`, `onend`, and `onerror` lifecycle listeners.

#### `VoiceRecognition` (Speech-to-Text)
```typescript
static start(lang = 'hi-IN', onResult: (text: string) => void, onError: (err: string) => void): void
```
- Initializes `window.SpeechRecognition` or `window.webkitSpeechRecognition`.
- Sets `lang = 'hi-IN'` (or `'mr-IN'`) and `continuous = false`.
- On speech capture (`onresult`), extracts transcript and passes it to the `onResult` callback.
- Includes fallback simulation for development environments without physical microphone hardware.

---

### 3.6 Clinical Summarizer & Fuzzy Search (`services/clinicalSummary.ts`, `fuzzySearch.ts`)

#### `clinicalSummary.ts`
Located at `asha-app/src/services/clinicalSummary.ts`.
- **`generateClinicalSummary(member, survey, lang)`**:
  - Analyzes member records and survey responses to produce structured summary data.
  - Evaluates clinical risk rules:
    - High-risk pregnancy indicators: maternal age (<18 or >35), systolic BP >= 140, diastolic BP >= 90, severe anemia (Hb < 7 g/dL), previous caesarean delivery.
    - Child malnutrition: weight-for-age z-score, missing immunization milestones.
    - Chronic conditions: hypertension, diabetes, tuberculosis, leprosy.
  - Builds:
    - `highlights`: Array of badge items with status types (`'check'`, `'alert'`, `'info'`).
    - `spokenText`: Natural, clear Devanagari or English text synthesized specifically for the ASHA worker to listen to via TTS.
    - `detailedEntries`: Form entries formatted for audit display.

#### `fuzzySearch.ts`
- Performs case-insensitive, fuzzy token-based matching across member names, head of family names, phone numbers, and house numbers.

---

### 3.7 Reusable UI Components Library

#### 3.7.1 `Header.tsx`
- Displays app branding ("जनसंवाद ASHA"), current village jurisdiction ("चांदपुर"), network connectivity badge (🟢 ऑनलाइन / 🔴 ऑफलाइन), outbox count badge, language selector dropdown, and active role switcher pill.

#### 3.7.2 `BottomNav.tsx`
- Renders the bottom navigation bar with 5 primary tabs:
  - 🏠 **होम (Home)**: Main dashboard.
  - 👥 **परिवार (Families)**: Household registry.
  - 📋 **पाठपुरावा (Follow-ups & Referrals)**: Follow-up tasks.
  - 📅 **बैठक (Meetings)**: Meeting logs.
  - 👤 **प्रोफ़ाइल (Profile)**: Settings and ASHA ID card.
- Displays dynamic red notification badge on **पाठपुरावा** when overdue tasks exist.

#### 3.7.3 `DotGrid.tsx`
- Renders the interactive 24-household village spatial grid (3 rows × 8 columns).
- Color codes each household circle:
  - Red: 7-day visit interval (urgent).
  - Orange: 15-day interval (moderate).
  - Yellow: 30-day interval (routine).
  - Green: Visited within cycle.
- Tapping any house circle triggers `onSelectHouse(houseNumber)`.

#### 3.7.4 `FamilyBottomSheet.tsx`
- Slide-up bottom sheet appearing when a house is selected on the grid.
- Shows house number, family head name, total members, visit urgency, and member list.
- Provides direct action buttons: "सर्वेक्षण शुरू करें (Start Survey)" and "विस्तार से देखें (View Details)".

#### 3.7.5 `ChildVaccinationModal.tsx`
- Modal dialog for child immunization tracking.
- Displays vaccine table categorized by age milestones:
  - Birth: BCG, OPV-0, Hepatitis B-0.
  - 6 Weeks: Pentavalent-1, OPV-1, Rotavirus-1, PCV-1.
  - 10 Weeks: Pentavalent-2, OPV-2, Rotavirus-2.
  - 14 Weeks: Pentavalent-3, OPV-3, Rotavirus-3, PCV-2, IPV-1.
  - 9 Months: Measles-Rubella-1, Vitamin A-1, PCV Booster.
- Provides one-tap toggle between `Given` (Green), `Due` (Orange), and `Not Given` (Gray).

#### 3.7.6 `RealQrCode.tsx`
- Renders SVG QR codes for peer-to-peer data sync between ASHA worker and ANM without internet access.

#### 3.7.7 `StatusBadge.tsx`
- Reusable pill badge with color-coded background and text for urgency tiers.

#### 3.7.8 `VoiceGuideBanner.tsx`
- Audio guide banner that speaks contextual instructions to rural health workers on screen open.

---

### 3.8 Mobile Screens & Workflows

#### 3.8.1 `HomeScreen.tsx`
- Clean mobile layout optimized for readability in outdoor village conditions.
- Top section: 24-household dot grid showing village health status at a glance.
- Middle section: Action counters:
  - 🔴 Overdue follow-ups count.
  - 🟡 Today's visits count.
  - 🟢 Completed visits count.
- Bottom section: "डेटा सिंक (Data Sender)" card showing pending records with a direct button to send to the ANM.

#### 3.8.2 `SurveyQuestionScreen.tsx`
- Clean mobile questionnaire screen with minimized text.
- Renders survey questions sequentially.
- **Under Each Question — Unified Voice Add-on Bar**:
  - 🔊 **प्रश्न सुनें (Listen to Question)**: Triggers `SpeechEngine.speak(...)` in Hindi or Marathi.
  - 🎙️ **बोलकर भरें (Voice Input)**: Activates `VoiceRecognition.start(...)`, records the patient's spoken answer, transcribes it, and automatically matches the corresponding option or fills the text input.
- **At End of Form — Crucial Information Mic Add-on**:
  - Dedicated mic recording card labeled "अति आवश्यक जानकारी / लक्षण (वैकल्पिक माइक रिकॉर्डिंग)".
  - Ensures no critical clinical symptom or historical nuance is lost even if not covered by predefined questions.
  - Stores transcript into `answers.crucialVoiceNote`.

#### 3.8.3 `FollowUpScreen.tsx`
- Follow-up task and referral tracking screen.
- Header localized as **पाठपुरावा (Follow-ups & Referrals)** in Marathi and **फॉलो-अप** in Hindi.
- Urgency filter tabs:
  - 🔴 **अति आवश्यक (Urgent / 7 Days)**
  - 🟡 **मध्यम (Semi-Urgent / 14 Days)**
  - 🟢 **सामान्य (Routine / 30 Days)**
- Task Cards:
  - Shows resident name, house number, due date, and referral reason.
  - Audio button to listen to referral instructions via TTS.
  - Tapping card marks task completed with visual checkmark animation.
- **"+ नया संदर्भ (+ New Referral)" Modal**:
  - Allows ASHA to create an ad-hoc referral task for an ill resident.
  - Includes dedicated voice mic add-on to speak clinical observations.

#### 3.8.4 `AshaMeetingsScreen.tsx`
- Village health meeting tracker (VHSNC, ASHA Cluster, Sector Monthly, VHND Planning).
- Meeting Cards:
  - Displays meeting type, date, venue, attendee count, materials available, discussion points, and decisions taken.
  - 🔊 Audio button to listen to meeting summary.
- **"+ नई बैठक (+ New Meeting)" Modal**:
  - Form fields: meeting type, date, venue, attendees, materials, discussion points.
  - Crucial Decisions Mic Add-on: Dedicated voice recorder to capture key resolutions.

#### 3.8.5 `MemberResponsesScreen.tsx`
- Clinical audit view for an individual family member.
- Displays:
  - Health profile summary.
  - Clinical risk indicators.
  - Spoken summary via `SpeechEngine`.
  - Detailed questionnaire answers history.

#### 3.8.6 `FamiliesScreen.tsx` & `FamilyDetailScreen.tsx`
- Complete directory of households in the village.
- Allows searching by family head name, house number, or phone.
- `FamilyDetailScreen`: Lists all members, their ABHA link status, pregnancy status, and provides "+ सदस्य जोड़ें (Add Member)" functionality.

#### 3.8.7 `SendDataScreen.tsx` & `SyncSuccessScreen.tsx`
- Manages peer-to-peer data synchronization to the ANM supervisor.
- Two sync channels:
  1. Direct cloud sync via REST API when mobile internet is available.
  2. Offline QR sync: Displays data payload encoded in QR blocks for the ANM's tablet to scan.
- `SyncSuccessScreen`: Confirms transmission receipt with synced item count and timestamp.

#### 3.8.8 `ChoDashboardScreen.tsx`
- Supervisory analytics screen for Community Health Officers (CHOs) at the Health & Wellness Centre (Ayushman Bharat HWC).
- Displays aggregated village indicators: total population, institutional delivery rates, immunization dropouts, and missed referral trends.

#### 3.8.9 `AnmOpenFormsScreen.tsx`, `AnmFormDetailScreen.tsx`, `AnmWorkerDetailScreen.tsx`
- ANM supervisory portal screens:
  - `AnmOpenFormsScreen`: Feed of unverified survey forms submitted by ASHA workers.
  - `AnmFormDetailScreen`: Deep inspection of an individual survey, allowing the ANM to verify or flag anomalies.
  - `AnmWorkerDetailScreen`: Performance overview of an individual ASHA worker.

#### 3.8.10 `ProfileScreen.tsx` & `SettingsScreen.tsx`
- `ProfileScreen`: Displays ASHA worker identity card, village, phone, assigned ANM name, and session statistics.
- `SettingsScreen`: Language preferences, cache clear options, and local database reset to defaults.

---

### 3.9 Root Application Orchestrator (`App.tsx`)

Located at `asha-app/App.tsx`.
- **Imports** (Lines 1–26): Imports React, state hooks, context providers (`AuthProvider`, `LanguageProvider`, `OfflineDataProvider`), common layout components (`Header`, `BottomNav`), color constants, and all 16 application screens.
- **`ScreenView` Union Type** (Lines 28–43): Declares valid screen identifiers for internal navigation.
- **Navigation State** (Lines 46–63):
  - `activeTab`: Current bottom tab (`'Home'`, `'Families'`, `'FollowUps'`, `'Meetings'`, `'Profile'`).
  - `currentScreen`: Active screen view.
  - `selectedHouse`, `selectedMember`, `surveyFormType`, `selectedAshaWorker`: Navigation parameter states passed to screens.
- **Role Reaction Hook** (Lines 65–73):
  - Watches `user.role` from `AuthContext`.
  - When role switches to `CHO`, automatically routes to `ChoDashboard`.
  - When role switches to `ANM`, routes to `AnmOpenForms`.
  - When role switches to `ASHA`, routes to `Home`.
- **`handleTabChange`** (Lines 77–91): Handles tab clicks and restricts tab access based on user role.
- **`renderActiveScreen()`** (Lines 93–260):
  - Evaluates `currentScreen` and `user.role`.
  - Injects appropriate props and callbacks (e.g., `onSelectHouse`, `onStartSurvey`, `onCompleteTask`, `onNavigate`).
- **Main Render Tree** (Lines 262–305):
  - Wraps tree in `<SafeAreaView style={styles.container}>`.
  - Renders `<Header />`.
  - Renders `<View style={styles.screenWrapper}>{renderActiveScreen()}</View>`.
  - Renders `<BottomNav />` at bottom of screen.
