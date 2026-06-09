-- =============================================================================
-- migrate_profiles_split_names.sql
-- =============================================================================
-- Purpose: Add first_name and last_name columns to the profiles table so the
-- Profile Settings name update and signup flows can persist split-name data.
--
-- Context: The app code (ProfileSettings.tsx, Login.tsx) was already writing
-- first_name/last_name on upsert, but the columns didn't exist — Supabase was
-- silently rejecting the entire row. Every signup since that code was written
-- silently failed to create a profiles row (the app fell back to reading from
-- authorized_roster).
--
-- Backfill: For existing rows that have full_name set, split on the first
-- space. Everything before the first space → first_name; everything after →
-- last_name. Multi-word last names ("de la Cruz", "Van Der Berg") are
-- preserved correctly. Multi-word first names ("Mary Anne Smith") will need
-- to be corrected by the user in Profile Settings.
-- =============================================================================

-- 1. Add the columns (idempotent — safe to re-run)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_name TEXT;

-- 2. Backfill any rows that have a full_name but null split values
UPDATE profiles
SET
  first_name = COALESCE(
    first_name,
    split_part(full_name, ' ', 1)
  ),
  last_name = COALESCE(
    last_name,
    CASE
      WHEN position(' ' IN full_name) > 0
        THEN substring(full_name FROM position(' ' IN full_name) + 1)
      ELSE ''
    END
  )
WHERE full_name IS NOT NULL
  AND (first_name IS NULL OR last_name IS NULL);

-- 3. Quick verification query (run separately to check results)
-- SELECT email, full_name, first_name, last_name FROM profiles ORDER BY full_name;
