-- ============================================================
-- Migration: Fix VIP Package Cycles, Expiration, and Access Control
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/sswhabqzmjrmbulrzbkr/sql
-- ============================================================

-- 1. Ensure updated_at exists on vip_packages
ALTER TABLE public.vip_packages
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Ensure booking_code and snapshot exist on user_tickets
ALTER TABLE public.user_tickets
  ADD COLUMN IF NOT EXISTS booking_code text,
  ADD COLUMN IF NOT EXISTS snapshot jsonb;

-- 3. Recreate the secure_vip_packages view
--    Only reveals booking_code to users who purchased the CURRENT active batch
DROP VIEW IF EXISTS public.secure_vip_packages;
CREATE OR REPLACE VIEW public.secure_vip_packages AS
SELECT
  id,
  name,
  price,
  CASE
    WHEN expires_at IS NOT NULL AND expires_at < now() THEN 'expired'
    ELSE availability_status
  END AS availability_status,
  combined_odds,
  result_status,
  is_published,
  expires_at,
  updated_at,
  -- Only expose booking code to admins or users who bought the package AFTER it was posted/updated
  CASE
    WHEN public.is_admin() THEN booking_code
    WHEN EXISTS (
      SELECT 1 FROM public.user_tickets
      WHERE user_id = auth.uid()
        AND package_id = vip_packages.id
        AND (
          vip_packages.updated_at IS NULL
          OR purchased_at >= (vip_packages.updated_at - INTERVAL '15 seconds')
        )
        AND (
          user_tickets.booking_code IS NULL
          OR user_tickets.booking_code = vip_packages.booking_code
        )
    ) THEN booking_code
    ELSE NULL
  END AS booking_code
FROM public.vip_packages;

-- Re-grant access to authenticated and anon roles
GRANT SELECT ON public.secure_vip_packages TO authenticated, anon;
