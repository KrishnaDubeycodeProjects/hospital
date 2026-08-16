-- Per-phone WhatsApp bot session: tracks which language a patient has chosen
-- (English / Hindi / Marathi) so the greeting -> language picker -> menu flow
-- only has to run once per number, independent of whether they currently
-- have an active token row.

CREATE TABLE IF NOT EXISTS wa_sessions (
  phone VARCHAR(32) PRIMARY KEY,
  -- NULL while the language prompt is pending a reply; 'EN' / 'HI' / 'MR' once chosen.
  language VARCHAR(2),
  -- 'awaiting_language' or 'ready'.
  stage VARCHAR(20) NOT NULL DEFAULT 'awaiting_language',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
