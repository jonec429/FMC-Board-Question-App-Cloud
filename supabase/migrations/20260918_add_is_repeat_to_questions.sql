-- Migration: Add is_repeat to questions and mark known duplicate ITE questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_repeat BOOLEAN DEFAULT false;

-- Index for quick lookups and filtering in custom quizzes / high-yield modes
CREATE INDEX IF NOT EXISTS idx_questions_is_repeat ON public.questions (is_repeat) WHERE is_repeat = true;

-- Flag known repeat questions across ITEs
UPDATE public.questions
SET is_repeat = true
WHERE id IN (
  'b9d5b51f-8c32-472d-8f02-7ac394f086e1', -- 2025 Item: Ankle injury / Ottawa ankle rules
  'dda216f2-f1f8-4495-b597-bddab68e6b34', -- 2025 Item: Ankle injury / Ottawa ankle rules (Repeat)
  '41a27c0b-06ad-4593-8c67-4a68f24399cf', -- 2025 Item: Heart failure / fatigue workup
  'c60df00e-8b1d-4e35-8ed0-29c1b59348ef'  -- 2025 Item: Heart failure / fatigue workup (Repeat)
);
