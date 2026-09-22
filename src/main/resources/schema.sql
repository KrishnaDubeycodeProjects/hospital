-- ============================================================================
-- Idempotent schema definition, executed automatically on every boot by
-- Spring Boot's SQL initializer (spring.sql.init.mode=always, see
-- application.yml) via the spring-boot-starter-jdbc dependency already on
-- the classpath. This app talks to Postgres entirely through plain
-- NamedParameterJdbcTemplate SQL -- there are no @Entity classes anywhere,
-- so spring.jpa.hibernate.ddl-auto has nothing to generate DDL from and
-- Flyway's versioned-migration-history model (which fell out of sync with
-- the code and produced "bad SQL grammar" errors) has been replaced by this
-- single, always-safe-to-rerun file instead. Every statement here is
-- CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS, so running it against
-- a fresh DB or a DB that already has some/all of this schema both just
-- work -- mirrors the original Node backend's ad hoc CREATE TABLE IF NOT
-- EXISTS approach (see backend/utils/db.js).
--
-- Everything below lives in its own "clinicqueue" schema, not "public" --
-- the JDBC URL's currentSchema=clinicqueue param (see application.yml) makes
-- it the connection's default, so every unqualified CREATE TABLE/reference
-- here (and every query in the app) resolves inside it. That keeps this app
-- from colliding with whatever else already lives in "public" on the target
-- database (e.g. a shared Supabase project's own "users"/"doctors" tables --
-- CREATE TABLE IF NOT EXISTS is a no-op against an existing same-named
-- table, and ADD COLUMN IF NOT EXISTS would then silently bolt this app's
-- columns onto it instead of creating its own).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS clinicqueue;

-- ----------------------------------------------------------------------------
-- hospitals: location (DIGIPIN-based), OPD hours, counters, and profile.
-- See HospitalService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospitals (
  id SERIAL PRIMARY KEY,
  uri_slug VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  address TEXT,
  digipin CHAR(10) NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  avg_service_minutes INT NOT NULL DEFAULT 10,
  min_service_minutes INT,
  active_counters INT NOT NULL DEFAULT 1,
  doctor_join_code VARCHAR(20),
  ownership VARCHAR(50),
  year_established INT,
  accreditation TEXT,
  gender_specific VARCHAR(10),
  categories TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Self-heals a "hospitals" table created by an earlier version of this file.
ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS min_service_minutes INT,
  ADD COLUMN IF NOT EXISTS doctor_join_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ownership VARCHAR(50),
  ADD COLUMN IF NOT EXISTS year_established INT,
  ADD COLUMN IF NOT EXISTS accreditation TEXT,
  ADD COLUMN IF NOT EXISTS gender_specific VARCHAR(10),
  ADD COLUMN IF NOT EXISTS categories TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_hospitals_doctor_join_code
  ON hospitals (doctor_join_code) WHERE doctor_join_code IS NOT NULL;

-- Placeholder default hospital row (India Gate, Delhi, as a non-null
-- placeholder location) -- HospitalSeedRunner overwrites this from
-- HOSPITAL_* env vars on every boot, so this row is just a safe fallback
-- if the app ever starts against a fresh DB before that runner executes.
INSERT INTO hospitals (uri_slug, name, address, digipin, latitude, longitude, open_time, close_time, avg_service_minutes, active_counters)
SELECT 'main', 'Main Hospital', 'Address not yet configured', '3C3P39L8T4', 28.6139, 77.2090, '09:00', '17:00', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE uri_slug = 'main');

-- ----------------------------------------------------------------------------
-- tokens: one row per patient queue ticket. See QueueManagerService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT,
  gender VARCHAR(10),
  category VARCHAR(100),
  status VARCHAR(20) DEFAULT 'waiting',
  session_step VARCHAR(50) DEFAULT 'welcome',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  served_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  missed_at TIMESTAMP NULL,
  rejected_at TIMESTAMP NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP NULL,
  hospital_id INT,
  patient_digipin CHAR(10),
  patient_lat DOUBLE PRECISION,
  patient_lon DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  travel_minutes DOUBLE PRECISION,
  treatment_remaining_minutes DOUBLE PRECISION,
  notified_ready_at TIMESTAMP,
  anomaly_control_until TIMESTAMP,
  priority_rank BIGINT,
  counter_id INT,
  reserved_counter_id INT,
  no_show_count INT NOT NULL DEFAULT 0,
  search_offset INT NOT NULL DEFAULT 0,
  daily_number INT,
  target_arrival_time TIMESTAMP,
  selected_travel_minutes INT
);

-- Self-heals a "tokens" table created by an earlier version of this file.
-- Each ALTER is a separate statement so one failure cannot block the others.
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS category VARCHAR(100);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS hospital_id INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS patient_digipin CHAR(10);
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS patient_lat DOUBLE PRECISION;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS patient_lon DOUBLE PRECISION;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS travel_minutes DOUBLE PRECISION;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS treatment_remaining_minutes DOUBLE PRECISION;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS notified_ready_at TIMESTAMP;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS anomaly_control_until TIMESTAMP;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS priority_rank BIGINT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS counter_id INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS reserved_counter_id INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS no_show_count INT NOT NULL DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS search_offset INT NOT NULL DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS daily_number INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS target_arrival_time TIMESTAMP;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS selected_travel_minutes INT;

-- Speeds up the hot paths in QueueManagerService: phone lookups, status-
-- filtered queue reads, the "how many waiting tokens have a smaller
-- id/priority_rank" position count, and the department-scoped FIFO scan.
CREATE INDEX IF NOT EXISTS idx_tokens_phone ON tokens (phone);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens (status);
CREATE INDEX IF NOT EXISTS idx_tokens_status_id ON tokens (status, id);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens (created_at);
CREATE INDEX IF NOT EXISTS idx_tokens_hospital_id ON tokens (hospital_id);
CREATE INDEX IF NOT EXISTS idx_tokens_missed_at ON tokens (missed_at);
CREATE INDEX IF NOT EXISTS idx_tokens_priority_rank ON tokens (priority_rank);
CREATE INDEX IF NOT EXISTS idx_tokens_counter_id ON tokens (counter_id);
CREATE INDEX IF NOT EXISTS idx_tokens_reserved_counter_id ON tokens (reserved_counter_id);
CREATE INDEX IF NOT EXISTS idx_tokens_category ON tokens (category);
CREATE INDEX IF NOT EXISTS idx_tokens_hospital_category_status ON tokens (hospital_id, category, status);
CREATE INDEX IF NOT EXISTS idx_tokens_frozen ON tokens (hospital_id, category, status, target_arrival_time);

-- ----------------------------------------------------------------------------
-- otp_verifications: phone-number OTP hashes/expiry/attempts. See OtpService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_verifications (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) NOT NULL,
  code_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL DEFAULT 'registration',
  expires_at TIMESTAMP NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications (phone);
CREATE INDEX IF NOT EXISTS idx_otp_phone_verified ON otp_verifications (phone, verified, expires_at);

-- ----------------------------------------------------------------------------
-- wa_sessions: per-phone WhatsApp bot language/stage. See bot.WaSessionService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wa_sessions (
  phone VARCHAR(32) PRIMARY KEY,
  language VARCHAR(2),
  stage VARCHAR(20) NOT NULL DEFAULT 'awaiting_language',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- token_history: durable per-phone visit ledger, archived the moment a token
-- is marked 'completed'. See QueueManagerService#archiveToHistory.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_history (
  id SERIAL PRIMARY KEY,
  token_id INT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT,
  gender VARCHAR(10),
  category VARCHAR(100),
  hospital_id INT,
  counter_id INT,
  created_at TIMESTAMP,
  served_at TIMESTAMP,
  completed_at TIMESTAMP,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE token_history
  ADD COLUMN IF NOT EXISTS gender VARCHAR(10),
  ADD COLUMN IF NOT EXISTS category VARCHAR(100),
  ADD COLUMN IF NOT EXISTS hospital_id INT,
  ADD COLUMN IF NOT EXISTS counter_id INT;

CREATE INDEX IF NOT EXISTS idx_token_history_phone ON token_history (phone);
CREATE INDEX IF NOT EXISTS idx_token_history_token_id ON token_history (token_id);

-- ----------------------------------------------------------------------------
-- doctors: phone+OTP accounts, linked to one hospital via its join code, and
-- assigned a counter/department. See DoctorService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  hospital_id INT,
  counter_id INT,
  category VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE doctors
  ADD COLUMN IF NOT EXISTS id SERIAL,
  ADD COLUMN IF NOT EXISTS hospital_id INT,
  ADD COLUMN IF NOT EXISTS counter_id INT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(100);

-- Earlier versions of this app connected straight to a Supabase project's default
-- "postgres" DB with no schema of its own, so this CREATE TABLE landed on top of that
-- project's *own* "doctors"/"users" tables sitting in "public" (Supabase Auth's
-- auth.users, judging by their column shape -- encrypted_password, confirmation_token,
-- raw_app_meta_data, etc. -- or a public-schema table referencing it) instead of
-- creating this app's own: "doctors" there was keyed on a NOT NULL "ehrid" column with
-- a foreign key into that "users" table, which this app's INSERTs never populated ("null
-- value in column \"ehrid\"", then a FK violation once a random UUID silenced that).
-- Now that every table in this file lives in its own "clinicqueue" schema (see the
-- CREATE SCHEMA above and currentSchema= in application.yml's datasource url), the
-- CREATE TABLE above always creates a fresh doctors table rather than colliding with
-- one from another project living in "public" -- no ehrid/FK workaround needed.

CREATE INDEX IF NOT EXISTS idx_doctors_hospital_id ON doctors (hospital_id);

-- ----------------------------------------------------------------------------
-- patient_documents: uploaded prescription/report photos, stored as BYTEA
-- (no cloud storage configured). See PatientDocumentService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patient_documents (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(50) NOT NULL,
  patient_name VARCHAR(100) NOT NULL,
  patient_age INT,
  doc_type VARCHAR(20) NOT NULL, -- 'prescription' or 'report'
  hospital_id INT,
  uploaded_by_doctor_id INT,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  file_data BYTEA NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_patient_documents_phone ON patient_documents (patient_phone);
CREATE INDEX IF NOT EXISTS idx_patient_documents_identity ON patient_documents (patient_phone, patient_name, patient_age);

-- Self-heals patient_documents table for off-database file storage
ALTER TABLE patient_documents
  ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500),
  ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
ALTER TABLE patient_documents ALTER COLUMN file_data DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- access_requests / access_grants: a doctor's outstanding "let me view your
-- records" request (code + QR), and the revocable consent grant created once
-- a patient claims one. See AccessService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS access_requests (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  doctor_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | claimed | expired
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  claimed_by_phone VARCHAR(50),
  claimed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_requests_code ON access_requests (code);

CREATE TABLE IF NOT EXISTS access_grants (
  id SERIAL PRIMARY KEY,
  doctor_id INT NOT NULL,
  patient_phone VARCHAR(50) NOT NULL,
  source_request_id INT,
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by VARCHAR(20) -- 'patient' or 'doctor'
);

CREATE INDEX IF NOT EXISTS idx_access_grants_patient_phone ON access_grants (patient_phone);
CREATE INDEX IF NOT EXISTS idx_access_grants_doctor_id ON access_grants (doctor_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_active ON access_grants (patient_phone, doctor_id);

-- ----------------------------------------------------------------------------
-- hospital_departments: one row per (hospital, category) queue -- how many
-- counters staff that department. See HospitalDepartmentService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hospital_departments (
  id SERIAL PRIMARY KEY,
  hospital_id INT NOT NULL,
  category VARCHAR(100) NOT NULL,
  active_counters INT NOT NULL DEFAULT 1,
  avg_service_minutes INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backs both lookups and the ON CONFLICT (hospital_id, category) upsert in
-- HospitalDepartmentService#ensure.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hospital_departments_unique ON hospital_departments (hospital_id, category);

-- ----------------------------------------------------------------------------
-- time_slots / time_slot_doctors: OPD time windows within a day, each
-- assigned to a list of doctors. See TimeSlotService.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_slots (
  id SERIAL PRIMARY KEY,
  hospital_id INT NOT NULL,
  category VARCHAR(100),
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_time_slots_hospital_date ON time_slots (hospital_id, slot_date);

CREATE TABLE IF NOT EXISTS time_slot_doctors (
  time_slot_id INT NOT NULL,
  doctor_id INT NOT NULL,
  PRIMARY KEY (time_slot_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS idx_time_slot_doctors_doctor ON time_slot_doctors (doctor_id);

-- ----------------------------------------------------------------------------
-- family_units & family_members: Local Family Account management
-- Primary user links family members with or without ABHA.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS family_units (
  id SERIAL PRIMARY KEY,
  primary_phone VARCHAR(50) NOT NULL UNIQUE,
  head_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_family_units_phone ON family_units (primary_phone);

CREATE TABLE IF NOT EXISTS family_members (
  id SERIAL PRIMARY KEY,
  family_unit_id INT NOT NULL REFERENCES family_units(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  dob DATE,
  age INT,
  gender VARCHAR(10),
  relationship VARCHAR(50) NOT NULL,
  phone VARCHAR(50),
  abha_number VARCHAR(100),
  abha_address VARCHAR(100),
  is_abha_linked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_family_members_unit ON family_members (family_unit_id);
CREATE INDEX IF NOT EXISTS idx_family_members_abha ON family_members (abha_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_unit_name_rel ON family_members (family_unit_id, name, relationship);

-- ----------------------------------------------------------------------------
-- courses (EpisodeOfCare): Condition-centric continuity of care container
-- Groups all visits, prescriptions, labs, and referrals for a clinical journey
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(50) NOT NULL,
  patient_name VARCHAR(100) NOT NULL,
  family_member_id INT REFERENCES family_members(id),
  course_type VARCHAR(100) NOT NULL, -- 'tb_treatment', 'anc_pregnancy', 'hypertension', etc.
  title VARCHAR(200) NOT NULL,
  diagnosis VARCHAR(200) NOT NULL,
  icd10_code VARCHAR(20),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  started_by_doctor_id INT,
  started_at_hospital_id INT,
  current_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  closed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_courses_phone ON courses (patient_phone);
CREATE INDEX IF NOT EXISTS idx_courses_family_member ON courses (family_member_id);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses (status);

-- ----------------------------------------------------------------------------
-- course_encounters: Individual doctor consultations within a course
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_encounters (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  doctor_id INT NOT NULL,
  hospital_id INT NOT NULL,
  visit_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  chief_complaint TEXT,
  clinical_notes TEXT,
  examination_findings TEXT,
  plan TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_encounters_course ON course_encounters (course_id);

-- ----------------------------------------------------------------------------
-- course_prescriptions: FHIR MedicationRequest items linked to a course/encounter
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_prescriptions (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  encounter_id INT REFERENCES course_encounters(id),
  doctor_id INT NOT NULL,
  medicine_name VARCHAR(200) NOT NULL,
  snomed_code VARCHAR(50),
  dosage VARCHAR(50) NOT NULL,
  frequency VARCHAR(50) NOT NULL,
  duration_days INT NOT NULL,
  route VARCHAR(50) DEFAULT 'Oral',
  instructions TEXT,
  is_nlem BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_prescriptions_course ON course_prescriptions (course_id);

-- ----------------------------------------------------------------------------
-- course_referrals: Tiered priority referrals (Urgent 7d, Semi-Urgent 14d, Routine 30d)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_referrals (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  encounter_id INT REFERENCES course_encounters(id),
  referring_doctor_id INT NOT NULL,
  from_hospital_id INT NOT NULL,
  to_hospital_id INT NOT NULL,
  target_department VARCHAR(100) NOT NULL,
  referred_doctor_id INT,
  reason TEXT NOT NULL,
  priority_tier VARCHAR(20) NOT NULL CHECK (priority_tier IN ('urgent_7d', 'semi_urgent_14d', 'routine_30d')),
  valid_until DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'booked', 'completed', 'expired', 'cancelled')),
  qr_payload TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  visited_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_referrals_course ON course_referrals (course_id);
CREATE INDEX IF NOT EXISTS idx_course_referrals_to_hospital ON course_referrals (to_hospital_id, status);

-- ----------------------------------------------------------------------------
-- course_documents: PDF / Scanned files within a course (Mode 2)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_documents (
  id SERIAL PRIMARY KEY,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  encounter_id INT REFERENCES course_encounters(id),
  doc_type VARCHAR(100) NOT NULL, -- 'Chest X-ray', 'Lab Report', 'Discharge Summary', etc.
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  storage_path VARCHAR(500),
  file_hash VARCHAR(64),
  file_data BYTEA,
  uploaded_by_doctor_id INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_documents_course ON course_documents (course_id);
CREATE INDEX IF NOT EXISTS idx_course_documents_hash ON course_documents (file_hash);

-- Alterations for backward compatibility and upgrades
ALTER TABLE course_documents ADD COLUMN IF NOT EXISTS storage_path VARCHAR(500);
ALTER TABLE course_documents ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);
ALTER TABLE course_documents ALTER COLUMN file_data DROP NOT NULL;

-- Tokens table alterations
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS family_member_id INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS course_id INT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS referral_id INT;

-- Hospitals table alterations for referral quotas
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS urgent_referral_quota INT DEFAULT 5;
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS standard_referral_quota INT DEFAULT 15;

-- Family members table alterations for abha_number and abha_address length
ALTER TABLE family_members ALTER COLUMN abha_number TYPE VARCHAR(100);
ALTER TABLE family_members ALTER COLUMN abha_address TYPE VARCHAR(100);

-- ABDM HFR (Health Facility Registry) and HPR (Healthcare Professional Registry) Identifiers
ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS hfr_id VARCHAR(100) DEFAULT 'IN0001DEMO';
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS hpr_id VARCHAR(100) DEFAULT '91-0000-0000-0000@hpr.abdm';

-- Eka Care & ABDM Dual-Write Sync Tracking Columns
ALTER TABLE course_encounters ADD COLUMN IF NOT EXISTS eka_sync_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE course_encounters ADD COLUMN IF NOT EXISTS eka_record_id VARCHAR(100);
ALTER TABLE course_encounters ADD COLUMN IF NOT EXISTS eka_synced_at TIMESTAMP;
ALTER TABLE course_encounters ADD COLUMN IF NOT EXISTS eka_error TEXT;

ALTER TABLE course_prescriptions ADD COLUMN IF NOT EXISTS eka_sync_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE course_prescriptions ADD COLUMN IF NOT EXISTS eka_record_id VARCHAR(100);
ALTER TABLE course_prescriptions ADD COLUMN IF NOT EXISTS eka_synced_at TIMESTAMP;
ALTER TABLE course_prescriptions ADD COLUMN IF NOT EXISTS eka_error TEXT;

ALTER TABLE course_documents ADD COLUMN IF NOT EXISTS eka_sync_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE course_documents ADD COLUMN IF NOT EXISTS eka_record_id VARCHAR(100);
ALTER TABLE course_documents ADD COLUMN IF NOT EXISTS eka_synced_at TIMESTAMP;
ALTER TABLE course_documents ADD COLUMN IF NOT EXISTS eka_error TEXT;

ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS eka_sync_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS eka_record_id VARCHAR(100);
ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS eka_synced_at TIMESTAMP;
ALTER TABLE patient_documents ADD COLUMN IF NOT EXISTS eka_error TEXT;
