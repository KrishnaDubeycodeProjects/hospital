-- ============================================================================
-- ASHA Backend Schema — clinicqueue schema (same DB as main backend)
-- All statements are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ============================================================================

-- 1. ASHA Workers
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

-- 2. ANM Profiles (with QR code data)
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

-- 3. Survey Templates (3 sections: PREGNANCY, DISEASE, CHILD)
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

-- 4. Survey Responses (filled forms)
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

-- 5. Follow-Up Tasks (from referral system)
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

-- 6. Extend existing family_units (NO GPS)
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS village_name VARCHAR(200);
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS house_number VARCHAR(50);
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS sequential_number INT;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS visit_interval_days INT;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS next_visit_date DATE;
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS asha_worker_phone VARCHAR(50);
ALTER TABLE family_units ADD COLUMN IF NOT EXISTS last_visited_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_fu_asha ON family_units (asha_worker_phone);
CREATE INDEX IF NOT EXISTS idx_fu_seq ON family_units (sequential_number);
CREATE INDEX IF NOT EXISTS idx_fu_next ON family_units (next_visit_date);

-- 7. Extend existing family_members
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS is_pregnant BOOLEAN DEFAULT FALSE;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS expected_delivery_date DATE;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS has_chronic_condition BOOLEAN DEFAULT FALSE;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS chronic_condition_type VARCHAR(100);
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS last_survey_date TIMESTAMP;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS follow_up_due_date DATE;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS follow_up_reason VARCHAR(200);
