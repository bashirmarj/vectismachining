-- Fix actual security issues

-- 1. Add admin view policy for user_roles table
-- Admins need to see all role assignments, not just their own
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. Make the profiles anonymous denial more explicit with RESTRICTIVE policy
-- Drop the existing permissive policy and recreate as restrictive
DROP POLICY IF EXISTS "Deny anonymous access to profiles" ON public.profiles;

CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR ALL
TO anon
USING (false);

-- Note: contact_submissions intentionally has NO anonymous INSERT policy.
-- This is CORRECT SECURITY ARCHITECTURE:
-- - Edge function uses service role key which bypasses RLS
-- - Rate limiting is enforced in edge function before database insert
-- - Users cannot bypass rate limiting via direct database access
-- - Only admins can view submissions (SELECT policy already exists)