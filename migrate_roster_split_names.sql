-- =============================================================================
-- migrate_roster_split_names.sql
-- =============================================================================
-- Purpose: Add first_name and last_name columns to the authorized_roster table 
-- so the app can support true last-name sorting (especially for multi-word
-- last names like "Dela Cruz").
--
-- Backfill: For existing rows, split on the first space. 
-- Everything before the first space -> first_name; 
-- everything after -> last_name. 
-- The admin can hand-correct any multi-word first names later.
-- =============================================================================

ALTER TABLE authorized_roster ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE authorized_roster ADD COLUMN IF NOT EXISTS last_name TEXT;

UPDATE authorized_roster
SET
  first_name = COALESCE(
    first_name,
    split_part(name, ' ', 1)
  ),
  last_name = COALESCE(
    last_name,
    CASE
      WHEN position(' ' IN name) > 0
        THEN substring(name FROM position(' ' IN name) + 1)
      ELSE ''
    END
  )
WHERE name IS NOT NULL
  AND (first_name IS NULL OR last_name IS NULL);
