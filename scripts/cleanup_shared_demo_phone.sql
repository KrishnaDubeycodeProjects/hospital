-- ---------------------------------------------------------------------------
-- One-off cleanup: tokens booked under the old shared fallback number.
--
-- Before the booking-flow fix, the web booking page sent phone 9876543210
-- whenever it could not find the patient's own number, so unrelated people's
-- tokens all landed on that one number (and showed up for whoever viewed it).
--
-- This script is a DRY RUN by default: it ends in ROLLBACK. Review the report
-- output, then change the last line to COMMIT and run it again.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/cleanup_shared_demo_phone.sql
-- Set search_path first if your schema isn't the default (app uses clinicqueue).
-- ---------------------------------------------------------------------------
SET search_path TO clinicqueue, public;

BEGIN;

-- 1. Report: what is attached to the shared number right now.
SELECT 'tokens (all)' AS what, status, COUNT(*) AS n
FROM tokens
WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%9876543210'
GROUP BY status
UNION ALL
SELECT 'token_history', NULL, COUNT(*)
FROM token_history
WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%9876543210'
UNION ALL
SELECT 'family_members', NULL, COUNT(*)
FROM family_members fm
JOIN family_units fu ON fu.id = fm.family_unit_id
WHERE regexp_replace(fu.primary_phone, '[^0-9]', '', 'g') LIKE '%9876543210';

-- 2. Take still-active tokens on that number out of the live queues.
--    Rows are kept (status 'cancelled') so the audit trail stays intact;
--    every queue/position query only looks at waiting/serving/frozen/etc.
UPDATE tokens
SET status = 'cancelled', completed_at = COALESCE(completed_at, NOW())
WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%9876543210'
  AND status IN ('waiting', 'serving', 'registering_name', 'frozen', 'reserved');

-- 3. Show the result inside the transaction.
SELECT status, COUNT(*) AS n
FROM tokens
WHERE regexp_replace(phone, '[^0-9]', '', 'g') LIKE '%9876543210'
GROUP BY status;

-- Change to COMMIT once the report above looks right.
ROLLBACK;
