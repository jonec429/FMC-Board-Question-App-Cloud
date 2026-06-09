-- Add selected_index to question_attempts to track which specific wrong option residents choose
ALTER TABLE public.question_attempts
ADD COLUMN IF NOT EXISTS selected_index integer;

-- Update the TypeScript types to reflect this new column
-- (You don't need to run this comment, I will update lib/database.types.ts automatically)
