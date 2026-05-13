-- Migration to add question snapshot to quiz_sessions
ALTER TABLE public.quiz_sessions ADD COLUMN IF NOT EXISTS questions JSONB;
