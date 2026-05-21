-- Add is_qotd flag to question_attempts
ALTER TABLE public.question_attempts 
ADD COLUMN IF NOT EXISTS is_qotd BOOLEAN DEFAULT false;

-- Create user_streaks table
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_qotd_streak INTEGER DEFAULT 0,
    max_qotd_streak INTEGER DEFAULT 0,
    current_qotd_correct_streak INTEGER DEFAULT 0,
    max_qotd_correct_streak INTEGER DEFAULT 0,
    last_qotd_date DATE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks"
    ON public.user_streaks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own streaks"
    ON public.user_streaks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streaks"
    ON public.user_streaks FOR UPDATE
    USING (auth.uid() = user_id);


-- Create unified badges table
CREATE TABLE IF NOT EXISTS public.badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    type TEXT DEFAULT 'qotd', -- 'qotd' or 'block'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view badges"
    ON public.badges FOR SELECT
    USING (true);


-- Create user_badges junction table
CREATE TABLE IF NOT EXISTS public.user_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, badge_id)
);

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own badges"
    ON public.user_badges FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view all user badges for leaderboard"
    ON public.user_badges FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own badges"
    ON public.user_badges FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Insert baseline badges
INSERT INTO public.badges (name, description, icon, type)
VALUES 
  ('First to Answer', 'First person to answer the Question of the Day.', '🥇', 'qotd'),
  ('Just in Time', 'Submitted the QOTD between 11:55am and 11:59am.', '⏰', 'qotd'),
  ('QOTD 5x Streak', 'Answered the QOTD 5 weekdays in a row.', '🔥', 'qotd'),
  ('QOTD 10x Streak', 'Answered the QOTD 10 weekdays in a row.', '🔥🔥', 'qotd'),
  ('Flawless Victory', 'Scored 100% on a board review block.', '🏆', 'block'),
  ('Marathoner', 'Answered 100 total questions.', '🏃‍♂️', 'block'),
  ('Night Owl', 'Completed a block between 12am and 4am.', '🦉', 'block')
ON CONFLICT (name) DO NOTHING;
