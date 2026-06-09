-- =============================================================================
-- 20260609_fix_privilege_escalation.sql
-- =============================================================================
-- Purpose: Closes a critical privilege escalation vulnerability where residents
-- could grant themselves admin access by updating their own profile role.
-- 
-- The is_admin_or_faculty() function now strictly checks the authorized_roster 
-- table (which residents cannot write to) instead of the profiles table.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_or_faculty()
RETURNS BOOLEAN AS $$
DECLARE
  user_email TEXT;
  auth_role TEXT;
  auth_pgy TEXT;
BEGIN
  user_email := auth.jwt() ->> 'email';
  
  -- Check super-admin emails
  IF user_email IN ('jonathan.carbungco@ascension.org', 'j.carbungco1@gmail.com') THEN
    RETURN true;
  END IF;
  
  -- SECURE: Check authorized_roster table instead of profiles
  -- This table is read-only to non-admins, preventing privilege escalation via profile modification
  SELECT role, pgy INTO auth_role, auth_pgy 
  FROM public.authorized_roster 
  WHERE email = user_email;
  
  IF auth_role IN ('admin', 'faculty', 'gme_staff') OR auth_pgy = 'Faculty' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
