-- =============================================================================
-- fix_rls.sql
-- =============================================================================
-- Purpose: 
-- 1. Makes the helper function STABLE so it is only evaluated once per query 
--    instead of once per row (which was causing massive slowdowns on the Content tab).
-- 2. Replaces the restrictive FOR ALL policies with permissive SELECT policies 
--    (so residents can see questions in the Custom Block builder) while keeping
--    write access restricted to admins/faculty.
-- =============================================================================

-- 1. Make the helper function STABLE
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
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Drop the restrictive FOR ALL policies
DROP POLICY IF EXISTS "Enable insert/update/delete for admin and faculty" ON public.questions;
DROP POLICY IF EXISTS "Enable insert/update/delete for admin and faculty" ON public.blocks;
DROP POLICY IF EXISTS "Enable insert/update/delete for admin and faculty" ON public.block_schedule;
DROP POLICY IF EXISTS "authorized_roster_write_admin_faculty" ON public.authorized_roster;

-- 3. Create permissive SELECT policies (so residents can read questions, blocks, schedule, and roster)
CREATE POLICY "Enable select for authenticated" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable select for authenticated" ON public.blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable select for authenticated" ON public.block_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable select for authenticated" ON public.authorized_roster FOR SELECT TO authenticated USING (true);

-- 4. Create restricted write policies (INSERT, UPDATE, DELETE)
-- questions
CREATE POLICY "Enable insert for admin and faculty" ON public.questions FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable update for admin and faculty" ON public.questions FOR UPDATE TO authenticated USING (public.is_admin_or_faculty()) WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable delete for admin and faculty" ON public.questions FOR DELETE TO authenticated USING (public.is_admin_or_faculty());

-- blocks
CREATE POLICY "Enable insert for admin and faculty" ON public.blocks FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable update for admin and faculty" ON public.blocks FOR UPDATE TO authenticated USING (public.is_admin_or_faculty()) WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable delete for admin and faculty" ON public.blocks FOR DELETE TO authenticated USING (public.is_admin_or_faculty());

-- block_schedule
CREATE POLICY "Enable insert for admin and faculty" ON public.block_schedule FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable update for admin and faculty" ON public.block_schedule FOR UPDATE TO authenticated USING (public.is_admin_or_faculty()) WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable delete for admin and faculty" ON public.block_schedule FOR DELETE TO authenticated USING (public.is_admin_or_faculty());

-- authorized_roster
CREATE POLICY "Enable insert for admin and faculty" ON public.authorized_roster FOR INSERT TO authenticated WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable update for admin and faculty" ON public.authorized_roster FOR UPDATE TO authenticated USING (public.is_admin_or_faculty()) WITH CHECK (public.is_admin_or_faculty());
CREATE POLICY "Enable delete for admin and faculty" ON public.authorized_roster FOR DELETE TO authenticated USING (public.is_admin_or_faculty());
