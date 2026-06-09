-- =============================================================================
-- migrate_admin_fixes.sql
-- =============================================================================
-- ⚠️ DO NOT RE-RUN — DESTRUCTIVE ⚠️
-- This script was applied once on initial admin console setup. The first
-- statement (`DROP TABLE IF EXISTS public.block_schedule CASCADE`) will
-- destroy all existing block_schedule data if executed again. Kept in the
-- repo as historical record of the schema/RLS changes, not as a re-runnable
-- migration. If you need to adjust policies or schema in the future, write
-- a new, idempotent migration file instead.
--
-- Historical applied: confirmed in Supabase SQL Editor as
-- "Admin Console RLS and block_schedule Migration Fix" (≤ 2026-05-19).
-- =============================================================================
-- Purpose: Resolves two major issues preventing the Admin Console from working:
-- 1. Recreates `block_schedule` with the correct schema (block_id foreign key)
--    that the Next.js app expects, replacing the legacy GAS schema.
-- 2. Adds Row Level Security (RLS) policies to `questions`, `blocks`, and
--    `block_schedule` so authenticated users can actually read/write the data.
--    (Currently, default RLS was silently blocking all data from the UI).
-- =============================================================================

-- 1. Fix block_schedule schema
DROP TABLE IF EXISTS public.block_schedule CASCADE;
CREATE TABLE public.block_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id TEXT REFERENCES public.blocks(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL
);

-- 2. Enable RLS explicitly (idempotent)
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.block_schedule ENABLE ROW LEVEL SECURITY;

-- 3. Clear any existing overlapping policies to prevent errors if run twice
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.questions;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.blocks;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.block_schedule;
DROP POLICY IF EXISTS "Enable insert/update/delete for authenticated users" ON public.questions;
DROP POLICY IF EXISTS "Enable insert/update/delete for authenticated users" ON public.blocks;
DROP POLICY IF EXISTS "Enable insert/update/delete for authenticated users" ON public.block_schedule;

-- 4. Create Read Policies (Allow all authenticated users to read)
CREATE POLICY "Enable read access for all authenticated users" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable read access for all authenticated users" ON public.block_schedule FOR SELECT TO authenticated USING (true);

-- 5. Create Write Policies (Allow all authenticated users to modify for now)
-- Note: In a stricter production environment, this would be restricted to role = 'faculty' or 'admin'
CREATE POLICY "Enable insert/update/delete for authenticated users" ON public.questions FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable insert/update/delete for authenticated users" ON public.blocks FOR ALL TO authenticated USING (true);
CREATE POLICY "Enable insert/update/delete for authenticated users" ON public.block_schedule FOR ALL TO authenticated USING (true);
