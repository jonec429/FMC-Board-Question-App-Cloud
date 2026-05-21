-- =============================================================================
-- migrate_yoy_schema.sql
-- =============================================================================
-- Adds year-over-year tracking fields to authorized_roster so the app can:
--   1. Derive current PGY from cohort_year (no manual bumps every July 1)
--   2. Distinguish FM residents from OB/Academic fellows and faculty
--   3. Mark people graduated/on_leave without destructive deletes
--   4. Hide graduates from dashboards by default
--
-- Idempotent: ALTERs use IF NOT EXISTS. Safe to re-run.
-- Non-destructive: existing `pgy` column is preserved as legacy display until
-- the app is migrated to derive labels from cohort_year + track.
-- =============================================================================

-- 1. Add columns (additive only)
ALTER TABLE public.authorized_roster
  ADD COLUMN IF NOT EXISTS cohort_year    INT,
  ADD COLUMN IF NOT EXISTS track          TEXT,
  ADD COLUMN IF NOT EXISTS pgy_override   INT,
  ADD COLUMN IF NOT EXISTS status         TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS graduated_year INT;

-- 2. Backfill cohort_year + track from existing `pgy` values.
-- "Class of YYYY" graduates in June YYYY, so they entered PGY1 in (YYYY - 3).
UPDATE public.authorized_roster
SET cohort_year = 2022, track = 'family_medicine'
WHERE pgy = 'Class of 2025' AND track IS NULL;

UPDATE public.authorized_roster
SET cohort_year = 2023, track = 'family_medicine'
WHERE pgy = 'Class of 2026' AND track IS NULL;

UPDATE public.authorized_roster
SET cohort_year = 2024, track = 'family_medicine'
WHERE pgy = 'Class of 2027' AND track IS NULL;

UPDATE public.authorized_roster
SET cohort_year = 2025, track = 'family_medicine'
WHERE pgy = 'Class of 2028' AND track IS NULL;

UPDATE public.authorized_roster
SET track = 'faculty'
WHERE pgy = 'Faculty' AND track IS NULL;

-- 3. Indexes for dashboard filtering
CREATE INDEX IF NOT EXISTS authorized_roster_status_idx ON public.authorized_roster(status);
CREATE INDEX IF NOT EXISTS authorized_roster_track_idx  ON public.authorized_roster(track);

-- 4. NOTE: OB Fellows and Academic Fellows are not in the current roster.
-- After running this migration, add them via the Roster UI (or directly via
-- INSERT) with track = 'ob_fellow' or 'academic_fellow' and cohort_year set
-- to the year they joined.
--
-- Verification query (run separately):
--   SELECT track, status, COUNT(*) FROM public.authorized_roster
--   GROUP BY track, status ORDER BY track, status;
