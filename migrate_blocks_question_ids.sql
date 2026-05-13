-- =============================================================================
-- Migration: Fixed Assigned Question Sets per Block
-- Date: 2026-05-13
-- Author: Claude (per user request 2026-05-13)
-- =============================================================================
--
-- WHY: We're pivoting from "each resident gets a random sample from category
-- filters" to "all residents see the same fixed question set per block."
-- This enables cross-cohort comparison: "what % of residents got Q17 right?"
-- Order is still shuffled per resident (client-side in QuizEngine).
--
-- WHAT: Adds a `question_ids` JSONB column to `blocks`. Auto-population of
-- existing blocks happens in the app — open Admin → Block Builder and click
-- "Auto-populate from filters" for each block (or "Initialize All").
--
-- The Mixed Review and Weakest Topics block types continue to use the legacy
-- per-resident random sampling — they're intentionally personalized.
--
-- USAGE: Run this in the Supabase SQL Editor (paste & Run).
-- =============================================================================

ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS question_ids JSONB DEFAULT '[]';

-- Index for faster lookups when fetching questions by block
CREATE INDEX IF NOT EXISTS idx_blocks_question_ids ON public.blocks USING gin (question_ids);

-- Quick sanity check — show current state of all blocks
SELECT
  title,
  block_type,
  question_count AS target_count,
  jsonb_array_length(question_ids) AS actual_assigned,
  jsonb_array_length(category_filters) AS num_categories
FROM public.blocks
ORDER BY sort_order;
