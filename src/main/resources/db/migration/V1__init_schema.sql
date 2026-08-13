-- Mirrors backend/utils/db.js's original ad hoc schema, now versioned via Flyway.
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting',
  session_step VARCHAR(50) DEFAULT 'welcome',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  served_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  missed_at TIMESTAMP NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMP NULL
);

-- Speeds up the hot paths in QueueManagerService: phone lookups (getActiveToken/
-- getPatientPosition), status-filtered queue reads, the "how many waiting
-- tokens have a smaller id" position count, and the FIFO next-waiting scan.
CREATE INDEX IF NOT EXISTS idx_tokens_phone ON tokens (phone);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens (status);
CREATE INDEX IF NOT EXISTS idx_tokens_status_id ON tokens (status, id);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens (created_at);
