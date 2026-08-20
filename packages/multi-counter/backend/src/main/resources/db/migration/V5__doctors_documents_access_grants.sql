-- Doctor accounts (phone+OTP, same as patients -- see OtpService), each
-- linked to exactly one hospital via that hospital's doctor_join_code.
-- Patient-uploaded prescription/report photos. A consent model where a
-- doctor's outstanding "let me view your records" request (a short code +
-- QR) is claimed by the patient, creating a revocable access grant.

ALTER TABLE hospitals
  ADD COLUMN IF NOT EXISTS doctor_join_code VARCHAR(20) UNIQUE;

CREATE TABLE IF NOT EXISTS doctors (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  hospital_id INT REFERENCES hospitals(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_doctors_hospital_id ON doctors (hospital_id);

-- One row per uploaded photo. patient_name/patient_age (not just patient_phone)
-- identify *which* person under a shared phone number the document belongs to,
-- same distinction used for tokens (see V4) -- lets a doctor's dashboard group
-- everything by (name, age) into one person's complete record.
CREATE TABLE IF NOT EXISTS patient_documents (
  id SERIAL PRIMARY KEY,
  patient_phone VARCHAR(50) NOT NULL,
  patient_name VARCHAR(100) NOT NULL,
  patient_age INT,
  doc_type VARCHAR(20) NOT NULL, -- 'prescription' or 'report'
  hospital_id INT REFERENCES hospitals(id),
  uploaded_by_doctor_id INT REFERENCES doctors(id),
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  file_size INT NOT NULL,
  file_data BYTEA NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_patient_documents_phone ON patient_documents (patient_phone);
CREATE INDEX IF NOT EXISTS idx_patient_documents_identity ON patient_documents (patient_phone, patient_name, patient_age);

-- A doctor's outstanding access request: generated as a short code + QR,
-- not yet tied to any patient until claimed.
CREATE TABLE IF NOT EXISTS access_requests (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  doctor_id INT NOT NULL REFERENCES doctors(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | claimed | expired
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  claimed_by_phone VARCHAR(50),
  claimed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_access_requests_code ON access_requests (code);

-- A live (or revoked) doctor <-> patient-phone consent grant, created the
-- moment a patient claims a doctor's access request.
CREATE TABLE IF NOT EXISTS access_grants (
  id SERIAL PRIMARY KEY,
  doctor_id INT NOT NULL REFERENCES doctors(id),
  patient_phone VARCHAR(50) NOT NULL,
  source_request_id INT REFERENCES access_requests(id),
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  revoked_by VARCHAR(20) -- 'patient' or 'doctor'
);
CREATE INDEX IF NOT EXISTS idx_access_grants_patient_phone ON access_grants (patient_phone);
CREATE INDEX IF NOT EXISTS idx_access_grants_doctor_id ON access_grants (doctor_id);
CREATE INDEX IF NOT EXISTS idx_access_grants_active ON access_grants (patient_phone, doctor_id) WHERE revoked_at IS NULL;
