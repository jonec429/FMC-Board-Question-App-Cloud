-- Migration: Create user_flagged_questions table
-- Allows residents to bookmark/flag questions for focused review and custom quizzes

CREATE TABLE IF NOT EXISTS public.user_flagged_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, question_id)
);

-- Index for fast user lookups
CREATE INDEX IF NOT EXISTS idx_user_flagged_user_id ON public.user_flagged_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_flagged_question_id ON public.user_flagged_questions(question_id);

-- Enable Row Level Security
ALTER TABLE public.user_flagged_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users manage only their own flags
CREATE POLICY "Users can view their own flagged questions" ON public.user_flagged_questions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can flag questions" ON public.user_flagged_questions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their flagged notes" ON public.user_flagged_questions
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can unflag questions" ON public.user_flagged_questions
  FOR DELETE
  USING (auth.uid() = user_id);
