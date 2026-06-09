-- create_cron_logs.sql
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.cron_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cron_name TEXT NOT NULL,
    status TEXT NOT NULL,
    details JSONB,
    executed_at TIMESTAMPTZ DEFAULT now()
);

-- Optional: If you ever want to read it from the client app (like the Admin Console), 
-- we can enable RLS and give admins access. The API uses the Service Role so it bypasses RLS anyway.
ALTER TABLE public.cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable select for admins" 
ON public.cron_logs FOR SELECT 
TO authenticated
USING (public.is_admin_or_faculty());
