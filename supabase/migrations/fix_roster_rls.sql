-- =============================================================================
-- fix_roster_rls.sql
-- =============================================================================
-- Symptom: Admin Console Roster tab + Performance "Total Residents" showed
-- empty / 0 even though `authorized_roster` had 49 rows. No timeout, no error
-- in the browser console — the query SUCCEEDED but returned zero rows.
--
-- Root cause: `authorized_roster` had RLS enabled but no SELECT policy granting
-- authenticated users read access (or a policy evaluating to false). RLS does
-- not error on a blocked read — it silently filters the rows out. Unlike
-- questions/blocks/profiles, the roster never got an explicit RLS fix.
--
-- Fix: clean slate the policies and recreate a permissive read (+ write) set.
-- Idempotent — safe to re-run (drops existing policies first).
--
-- SECURITY NOTE: the write policy below grants ALL to any authenticated user,
-- matching the current admin-tool behavior. Tighten to admin/faculty-only
-- before launch — tracked in ROADMAP "Feedback Backlog / Hotfixes".
-- =============================================================================

ALTER TABLE public.authorized_roster ENABLE ROW LEVEL SECURITY;

-- Clean slate: drop any existing policies on the table
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'authorized_roster'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.authorized_roster', pol.policyname);
  END LOOP;
END $$;

-- Read: any authenticated user can read the roster (Roster tab + Performance)
CREATE POLICY "authorized_roster_select_authenticated"
ON public.authorized_roster FOR SELECT TO authenticated USING (true);

-- Write: any authenticated user can modify (tighten to admin-only pre-launch)
CREATE POLICY "authorized_roster_write_authenticated"
ON public.authorized_roster FOR ALL TO authenticated USING (true) WITH CHECK (true);
