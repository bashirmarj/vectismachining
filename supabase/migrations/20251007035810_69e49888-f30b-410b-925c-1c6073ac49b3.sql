-- Fix security issues identified in scan

-- 1. Profiles table: Explicitly deny anonymous access
-- This prevents unauthorized queries while allowing authenticated users to view their own data
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false);

-- 2. User roles: Allow admins to manage all roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Note: contact_submissions table intentionally has no INSERT policy for anonymous users.
-- The edge function uses service role key which bypasses RLS for proper rate limiting enforcement.
-- This is the correct security model - users must go through the edge function, not direct DB access.