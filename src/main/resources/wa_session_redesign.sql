-- WhatsApp Session Redesign: add columns to wa_sessions and tokens

ALTER TABLE wa_sessions ALTER COLUMN stage TYPE VARCHAR(64);
ALTER TABLE wa_sessions ADD COLUMN IF NOT EXISTS prev_stage VARCHAR(64);
ALTER TABLE wa_sessions ADD COLUMN IF NOT EXISTS pending_media_id VARCHAR(255);
ALTER TABLE wa_sessions ADD COLUMN IF NOT EXISTS pending_media_type VARCHAR(32);
ALTER TABLE wa_sessions ADD COLUMN IF NOT EXISTS pending_member_id INTEGER;

ALTER TABLE tokens ADD COLUMN IF NOT EXISTS prev_session_step VARCHAR(64);
ALTER TABLE tokens ALTER COLUMN session_step TYPE VARCHAR(64);
