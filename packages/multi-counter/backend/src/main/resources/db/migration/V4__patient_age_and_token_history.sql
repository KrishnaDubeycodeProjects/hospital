-- Patient age (asked alongside name during registration) and a durable
-- token_history ledger: every token copied here the moment it's marked
-- 'completed' (service actually finished), independent of the live
-- "tokens" table -- which keeps today's stats/queue view working exactly as
-- before, while giving a permanent per-phone visit history that survives
-- forever. Nothing in QueueManagerService relies on completed rows being
-- absent from "tokens", so a phone number was already free to book a new
-- token (for a different patient, different name/age) the moment its prior
-- token left 'waiting'/'serving'/'registering_name' -- this just adds the
-- audit trail for it.

ALTER TABLE tokens
  ADD COLUMN IF NOT EXISTS age INT;

CREATE TABLE IF NOT EXISTS token_history (
  id SERIAL PRIMARY KEY,
  token_id INT NOT NULL,
  phone VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  age INT,
  hospital_id INT REFERENCES hospitals(id),
  counter_id INT,
  created_at TIMESTAMP,
  served_at TIMESTAMP,
  completed_at TIMESTAMP,
  archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_token_history_phone ON token_history (phone);
CREATE INDEX IF NOT EXISTS idx_token_history_token_id ON token_history (token_id);
