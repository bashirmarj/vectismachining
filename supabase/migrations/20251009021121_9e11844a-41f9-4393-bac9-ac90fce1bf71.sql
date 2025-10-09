-- Fix critical security issues by ensuring RLS is enabled and no public access exists

-- 1. Ensure RLS is enabled on quotation_submissions table
ALTER TABLE public.quotation_submissions ENABLE ROW LEVEL SECURITY;

-- Verify admin-only SELECT policy exists (should already exist)
-- This ensures only admins can view quotation submissions
DROP POLICY IF EXISTS "Admins can view all quotation submissions" ON public.quotation_submissions;
CREATE POLICY "Admins can view all quotation submissions"
ON public.quotation_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add INSERT policy for quotation submissions (allow public to submit)
DROP POLICY IF EXISTS "Anyone can submit quotations" ON public.quotation_submissions;
CREATE POLICY "Anyone can submit quotations"
ON public.quotation_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. Ensure RLS is enabled on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles should only be readable by the owner or admins
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Ensure RLS is enabled on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User roles should only be readable by the owner or admins
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));