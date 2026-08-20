-- Adds: hospitals (location/URI/DIGIPIN/OPD hours/counters), per-token geo +
-- notification-window + priority-window + counter-assignment columns, a
-- 'rejected' terminal outcome alongside 'missed', and OTP verification.

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
  active_counters INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Placeholder default hospital row (India Gate, Delhi, as a non-null
-- placeholder location) -- HospitalSeedRunner overwrites this from
-- HOSPITAL_* env vars on every boot, so this row is just a safe fallback
-- if the app ever starts against a fresh DB before that runner executes.
INSERT INTO hospitals (uri_slug, name, address, digipin, latitude, longitude, open_time, close_time, avg_service_minutes, active_counters)
SELECT 'main', 'Main Hospital', 'Address not yet configured', '3C3P39L8T4', 28.6139, 77.2090, '09:00', '17:00', 10, 1
WHERE NOT EXISTS (SELECT 1 FROM hospitals WHERE uri_slug = 'main');

ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS hospital_id INT REFERENCES hospitals(id),
  ADD COLUMN IF NOT EXISTS patient_digipin CHAR(10),
  ADD COLUMN IF NOT EXISTS patient_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS patient_lon DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS distance_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS notify_tokens_ahead INT,
  ADD COLUMN IF NOT EXISTS priority_window INT,
  ADD COLUMN IF NOT EXISTS notified_ready_at TIMESTAMP,
  -- NULL = ordered by id (normal FIFO). Set to a decreasing negative value to
  -- jump a requeued-from-missed token to the front of the waiting queue.
  ADD COLUMN IF NOT EXISTS priority_rank BIGINT,
  -- Which physical counter is currently serving this token (multi-counter package only).
  ADD COLUMN IF NOT EXISTS counter_id INT,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMP;

UPDATE tokens SET hospital_id = (SELECT id FROM hospitals WHERE uri_slug = 'main') WHERE hospital_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tokens_hospital_id ON tokens (hospital_id);
CREATE INDEX IF NOT EXISTS idx_tokens_missed_at ON tokens (missed_at);
CREATE INDEX IF NOT EXISTS idx_tokens_priority_rank ON tokens (priority_rank);
CREATE INDEX IF NOT EXISTS idx_tokens_counter_id ON tokens (counter_id);

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
