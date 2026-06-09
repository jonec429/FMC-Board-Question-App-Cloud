-- =============================================================================
-- tighten_rls_policies.sql
-- =============================================================================
-- Purpose: Restricts write access (INSERT, UPDATE, DELETE) on core tables
-- to only administrators and faculty. Normal residents will only have read access.
-- =============================================================================

-- 1. Create a helper function to check admin/faculty status.
-- SECURITY DEFINER allows it to read from the profiles table regardless of the caller's RLS.
CREATE OR REPLACE FUNCTION public.is_admin_or_faculty()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
  user_role TEXT;
  user_pgy TEXT;
BEGIN
  user_email := auth.jwt() ->> 'email';
  
  -- Check super-admin emails
  IF user_email IN ('jonathan.carbungco@ascension.org', 'j.carbungco1@gmail.com') THEN
    RETURN true;
  END IF;
  
  -- Check profiles table
  SELECT role, pgy INTO user_role, user_pgy FROM public.profiles WHERE id = auth.uid();
  
  IF user_role IN ('admin', 'faculty') OR user_pgy = 'Faculty' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop existing permissive ALL policies
DROP POLICY IF EXISTS "Enable insert/update/delete for authenticated users" ON public.questions;
DROP POLICY IF EXISTS "Enable insert/update/delete for authenticated users" ON public.blocks;
DROP POLICY IF EXISTS "Enable insert/update/delete for authenticated users" ON public.block_schedule;
DROP POLICY IF EXISTS "authorized_roster_write_authenticated" ON public.authorized_roster;

-- Note: We assume read policies (SELECT) are already restricted to USING (true) for authenticated users.

-- 3. Recreate write policies with the new helper function
CREATE POLICY "Enable insert/update/delete for admin and faculty" 
ON public.questions FOR ALL TO authenticated 
USING (public.is_admin_or_faculty()) 
WITH CHECK (public.is_admin_or_faculty());

CREATE POLICY "Enable insert/update/delete for admin and faculty" 
ON public.blocks FOR ALL TO authenticated 
USING (public.is_admin_or_faculty()) 
WITH CHECK (public.is_admin_or_faculty());

CREATE POLICY "Enable insert/update/delete for admin and faculty" 
ON public.block_schedule FOR ALL TO authenticated 
USING (public.is_admin_or_faculty()) 
WITH CHECK (public.is_admin_or_faculty());

CREATE POLICY "authorized_roster_write_admin_faculty" 
ON public.authorized_roster FOR ALL TO authenticated 
USING (public.is_admin_or_faculty()) 
WITH CHECK (public.is_admin_or_faculty());
