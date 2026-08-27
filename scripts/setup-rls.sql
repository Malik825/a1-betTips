-- ============================================================
-- SETUP DATABASE RLS POLICIES & SECURITY
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 1. PROFILES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
USING (public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" 
ON public.profiles FOR UPDATE 
USING (public.is_admin());

-- ============================================================
-- 2. FIXTURES & PREDICTIONS (Free Tips)
-- ============================================================
ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- Public can read
DROP POLICY IF EXISTS "Anyone can read fixtures" ON public.fixtures;
CREATE POLICY "Anyone can read fixtures" ON public.fixtures FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read predictions" ON public.predictions;
CREATE POLICY "Anyone can read predictions" ON public.predictions FOR SELECT USING (true);

-- Admins can do everything else
DROP POLICY IF EXISTS "Admins full access fixtures" ON public.fixtures;
CREATE POLICY "Admins full access fixtures" ON public.fixtures FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins full access predictions" ON public.predictions;
CREATE POLICY "Admins full access predictions" ON public.predictions FOR ALL USING (public.is_admin());

-- ============================================================
-- 2.5. SECURE DAILY SETTINGS (Free Bet)
-- ============================================================
-- CREATE SECURE VIEW FOR DAILY SETTINGS (Masks Free Booking Code)
DROP VIEW IF EXISTS public.secure_daily_settings;
CREATE VIEW public.secure_daily_settings AS
SELECT 
  date,
  status,
  updated_at,
  -- Only show booking code to logged-in users
  CASE 
    WHEN auth.uid() IS NOT NULL THEN free_booking_code
    ELSE NULL
  END AS free_booking_code
FROM public.daily_settings;

GRANT SELECT ON public.secure_daily_settings TO authenticated, anon;

-- ============================================================
-- 3. USER TICKETS
-- ============================================================
ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tickets" ON public.user_tickets;
CREATE POLICY "Users can view own tickets" 
ON public.user_tickets FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins full access tickets" ON public.user_tickets;
CREATE POLICY "Admins full access tickets" 
ON public.user_tickets FOR ALL 
USING (public.is_admin());

-- ============================================================
-- 4. VIP PACKAGES
-- ============================================================
ALTER TABLE public.vip_packages ENABLE ROW LEVEL SECURITY;

-- Anyone can read basic package details
DROP POLICY IF EXISTS "Anyone can read vip packages" ON public.vip_packages;
CREATE POLICY "Anyone can read vip packages" 
ON public.vip_packages FOR SELECT 
USING (true);

-- Admins full access
DROP POLICY IF EXISTS "Admins full access vip packages" ON public.vip_packages;
CREATE POLICY "Admins full access vip packages" 
ON public.vip_packages FOR ALL 
USING (public.is_admin());

-- CREATE SECURE VIEW FOR VIP PACKAGES (Masks Booking Code)
-- The frontend will use this view instead of the table directly.
DROP VIEW IF EXISTS public.secure_vip_packages;
CREATE VIEW public.secure_vip_packages AS
SELECT 
  id,
  name,
  price,
  availability_status,
  combined_odds,
  result_status,
  is_published,
  -- Only show booking code if admin OR user has purchased a ticket
  CASE 
    WHEN public.is_admin() THEN booking_code
    WHEN EXISTS (
      SELECT 1 FROM public.user_tickets 
      WHERE user_id = auth.uid() AND package_id = vip_packages.id
    ) THEN booking_code
    ELSE NULL
  END as booking_code
FROM public.vip_packages;

-- Ensure view is accessible to PostgREST
GRANT SELECT ON public.secure_vip_packages TO authenticated, anon;

-- ============================================================
-- 5. VIP PACKAGE FIXTURES
-- ============================================================
ALTER TABLE public.vip_package_fixtures ENABLE ROW LEVEL SECURITY;

-- Anyone can read VIP fixtures
DROP POLICY IF EXISTS "Anyone can read VIP fixtures" ON public.vip_package_fixtures;
CREATE POLICY "Anyone can read VIP fixtures" 
ON public.vip_package_fixtures FOR SELECT 
USING (true);

-- Admins full access
DROP POLICY IF EXISTS "Admins full access VIP fixtures" ON public.vip_package_fixtures;
CREATE POLICY "Admins full access VIP fixtures" 
ON public.vip_package_fixtures FOR ALL 
USING (public.is_admin());
