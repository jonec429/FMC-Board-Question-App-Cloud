-- Migration to add qotd_reactions tracking
CREATE TABLE IF NOT EXISTS public.qotd_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    date DATE NOT NULL,
    reaction TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(user_id, question_id, date)
);

-- RLS Policies
ALTER TABLE public.qotd_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all reactions"
    ON public.qotd_reactions FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own reactions"
    ON public.qotd_reactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reactions"
    ON public.qotd_reactions FOR UPDATE
    USING (auth.uid() = user_id);
