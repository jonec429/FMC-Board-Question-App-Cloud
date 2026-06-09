-- Add block streaks to user_streaks
ALTER TABLE public.user_streaks 
ADD COLUMN IF NOT EXISTS current_block_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_block_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_block_date TIMESTAMP WITH TIME ZONE;

-- Rename "Flawless Victory" to "Perfect Block"
UPDATE public.badges SET name = 'Perfect Block' WHERE name = 'Flawless Victory';

-- Insert new badges
INSERT INTO public.badges (name, description, icon, type)
VALUES 
  ('First Step', 'Submitted your first practice block.', '🐣', 'block'),
  ('QOTD 30x Streak', 'Answered the QOTD 30 weekdays in a row.', '🔥🔥🔥', 'qotd'),
  ('100 Club', 'Answered 100 total questions.', '🥉', 'block'),
  ('200 Club', 'Answered 200 total questions.', '🥈', 'block'),
  ('300 Club', 'Answered 300 total questions.', '🥇', 'block'),
  ('400 Club', 'Answered 400 total questions.', '🏅', 'block'),
  ('500 Club', 'Answered 500 total questions.', '🏃‍♂️', 'block'),
  ('600 Club', 'Answered 600 total questions.', '🚀', 'block'),
  ('700 Club', 'Answered 700 total questions.', '🛸', 'block'),
  ('800 Club', 'Answered 800 total questions.', '🌠', 'block'),
  ('900 Club', 'Answered 900 total questions.', '🌌', 'block'),
  ('1k Club', 'Answered 1000 total questions.', '👑', 'block')
ON CONFLICT (name) DO NOTHING;
