-- Migration to add question_attempts tracking

CREATE TABLE IF NOT EXISTS public.question_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- RLS Policies
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own attempts"
    ON public.question_attempts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts"
    ON public.question_attempts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create 3 explicit Demo Questions so they are guaranteed to exist for the Demo Quiz
-- We will use negative IDs or specific strings so they don't clash with normal questions.
INSERT INTO public.questions (id, year, category, system, abfm_category, question_text, correct_index, explanation, resource_link, options)
VALUES 
('00000000-0000-0000-0000-000000000001', 'Demo', 'Demo', 'Demo', 'Demo', 'Who do you like better?', 1, 'Dr. Carbungco, obviously!', '', '["Dr. Dela Cruz", "Dr. Carbungco"]'::jsonb),
('00000000-0000-0000-0000-000000000002', 'Demo', 'Demo', 'Demo', 'Demo', 'Who is taller?', 1, 'It''s a matter of objective measurement.', '', '["Dr. Dela Cruz", "Dr. Carbungco"]'::jsonb),
('00000000-0000-0000-0000-000000000003', 'Demo', 'Demo', 'Demo', 'Demo', 'Who is Dr. McInnes'' favorite?', 1, 'We all know the truth.', '', '["Dr. Dela Cruz", "Dr. Carbungco"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
