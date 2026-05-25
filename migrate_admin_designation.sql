-- =============================================================================
-- migrate_admin_designation.sql
-- =============================================================================
-- Purpose: Support assigning Admin roles directly from the Roster Manager UI.
-- 1. Adds `role` column to `authorized_roster`.
-- 2. Updates the `profiles` table RLS to allow existing Admins to edit other profiles.
-- =============================================================================

-- 1. Add `role` column to `authorized_roster`
ALTER TABLE public.authorized_roster
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'resident';

-- 2. Add an explicit UPDATE policy for profiles allowing Admins to edit others
-- Note: 'profiles_update_self' already exists for users to update their own names.
-- Here we allow Admins to update roles/names of other users.

DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;

CREATE POLICY "profiles_update_admin" 
ON public.profiles 
FOR UPDATE 
TO authenticated 
USING (public.is_admin_or_faculty()) 
WITH CHECK (public.is_admin_or_faculty());

-- NOTE: `is_admin_or_faculty()` was created in `tighten_rls_policies.sql` 
-- and safely checks if the logged-in user is an admin without causing infinite recursion.
