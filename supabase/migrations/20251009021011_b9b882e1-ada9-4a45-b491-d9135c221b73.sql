-- Fix security issues by adding proper INSERT policies

-- 1. Fix contact_submissions: Allow public INSERT (for contact form) but restrict SELECT to admins
-- Drop existing policy if it exists and recreate
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;

CREATE POLICY "Anyone can submit contact form"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. Fix profiles: Prevent manual INSERT (should only happen via trigger)
-- Profiles should only be created by the handle_new_user trigger
DROP POLICY IF EXISTS "Profiles can only be created via trigger" ON public.profiles;

CREATE POLICY "Profiles can only be created via trigger"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- 3. Verify quote_line_items INSERT policy exists (it should already exist)
-- This ensures only admins can create quote line items
DROP POLICY IF EXISTS "Admins can insert quote line items" ON public.quote_line_items;

CREATE POLICY "Admins can insert quote line items"
ON public.quote_line_items
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));