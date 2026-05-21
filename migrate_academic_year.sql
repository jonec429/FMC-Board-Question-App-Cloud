-- =============================================================================
-- migrate_academic_year.sql
-- =============================================================================
-- Purpose: Adds academic_year tracking to results and blocks.
-- =============================================================================

ALTER TABLE public.results ADD COLUMN IF NOT EXISTS academic_year INT;
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS academic_year INT;

-- Backfill results based on created_at timestamp.
-- The academic year ends in the year July falls in.
-- If month >= 7 (July), it's the next calendar year's academic year.
UPDATE public.results 
SET academic_year = CAST(EXTRACT(YEAR FROM created_at) + CASE WHEN EXTRACT(MONTH FROM created_at) >= 7 THEN 1 ELSE 0 END AS INT)
WHERE academic_year IS NULL;

-- For existing blocks, we can assume they belong to the current AY 25-26 (which is integer 2026 in our schema)
UPDATE public.blocks
SET academic_year = 2026
WHERE academic_year IS NULL;
