-- ============================================================
-- Migration: Add expires_at to vip_packages
-- Run once in the Supabase SQL editor.
-- ============================================================

-- 1. Add the expires_at column (nullable — NULL means never expires)
ALTER TABLE public.vip_packages
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL;

-- 2. Recreate the secure view so it:
--    • Exposes expires_at to the frontend
--    • Auto-derives availability_status as 'expired' when the date has passed
--      (overrides whatever the admin set, only for the public-facing view)
DROP VIEW IF EXISTS public.secure_vip_packages;
CREATE OR REPLACE VIEW public.secure_vip_packages AS
SELECT
  id,
  name,
  price,
  -- If expires_at is set and in the past, override status to 'expired'
  CASE
    WHEN expires_at IS NOT NULL AND expires_at < now() THEN 'expired'
    ELSE availability_status
  END AS availability_status,
  combined_odds,
  result_status,
  is_published,
  expires_at,
  -- Only expose booking code to admins or users who bought the package
  CASE
    WHEN public.is_admin() THEN booking_code
    WHEN EXISTS (
      SELECT 1 FROM public.user_tickets
      WHERE user_id = auth.uid() AND package_id = vip_packages.id
    ) THEN booking_code
    ELSE NULL
  END AS booking_code
FROM public.vip_packages;

-- Re-grant access (view replacement revokes permissions)
GRANT SELECT ON public.secure_vip_packages TO authenticated, anon;
