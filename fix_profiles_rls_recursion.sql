-- =============================================================================
-- fix_profiles_rls_recursion.sql
-- =============================================================================
-- Purpose: Resolve "infinite recursion detected in policy for relation 'profiles'"
-- error when calling supabase.from('profiles').upsert(...) from ProfileSettings.
--
-- Root cause: One or more existing RLS policies on the profiles table contain
-- a subquery against profiles itself (e.g., checking admin role by reading
-- profiles.role). When Postgres evaluates the policy, the subquery triggers
-- the same policy again → infinite recursion.
--
-- Fix strategy: drop all existing policies on public.profiles and recreate a
-- minimal, non-recursive set that matches what the app actually does:
--   - Any authenticated user can SELECT any profile (needed for Admin
--     Performance, Leaderboard, etc.).
--   - Authenticated users can INSERT only their own row (id = auth.uid()).
--   - Authenticated users can UPDATE only their own row.
--   - No DELETE policy (the app never deletes profiles).
--
-- If you previously had admin-only-write or faculty-restricted-read policies,
-- they are removed by this script. Re-add them separately if needed (and
-- ensure they don't query profiles inside their own expression).
-- =============================================================================

-- 1. Drop ALL existing policies on public.profiles (clean slate)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 2. Ensure RLS is enabled on the table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Recreate minimal, non-recursive policies

-- Read: any authenticated user can read any profile row.
CREATE POLICY "profiles_select_authenticated"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Insert: users can only create their own profile row.
CREATE POLICY "profiles_insert_self"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Update: users can only modify their own profile row.
CREATE POLICY "profiles_update_self"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 4. Verification query (run separately to confirm new state)
-- SELECT policyname, cmd AS operation, qual AS using_expr, with_check AS check_expr
-- FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles';
