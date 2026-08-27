-- ============================================================
-- FULL DATABASE RESET & REBUILD SCRIPT
-- WARNING: THIS WILL DELETE ALL DATA IN THE PUBLIC SCHEMA
-- ============================================================

-- 1. NUKE EVERYTHING
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Restore Supabase default role grants (these are lost when schema is dropped)
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA public TO postgres, service_role;
GRANT ALL ON SCHEMA public TO public;

-- Ensure future objects created in this schema are also accessible
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
-- ============================================================
-- FOOTBALL PREDICTION PLATFORM — FULL SCHEMA SETUP
-- Version: 2.0  (migrated to client's Supabase project)
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (idempotent).
-- ============================================================


-- ============================================================
-- 1. FIXTURES
--    Populated by the Football API sync; DO NOT edit manually.
-- ============================================================
CREATE TABLE IF NOT EXISTS fixtures (
  id                TEXT PRIMARY KEY,          -- e.g. "api_12345"
  external_api_id   INTEGER UNIQUE,            -- API-Football fixture ID
  home_team         TEXT NOT NULL,
  away_team         TEXT NOT NULL,
  competition       TEXT,                      -- e.g. "Premier League"
  match_date_iso    DATE,                      -- ISO date for day-filter
  match_time        TEXT NOT NULL,             -- HH:MM (UTC)
  status            TEXT DEFAULT 'Not Started',
  home_score        INTEGER,
  away_score        INTEGER,
  sport             TEXT DEFAULT 'Football'    -- e.g. "Football", "Basketball"
);

ALTER TABLE fixtures DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. VIP PACKAGES
--    Admin-controlled; three fixed rows seeded below.
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_packages (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  price               NUMERIC NOT NULL DEFAULT 0,
  availability_status TEXT NOT NULL DEFAULT 'draft',    -- draft | available | sold_out
  result_status       TEXT NOT NULL DEFAULT 'pending',  -- pending | won | lost
  booking_code        TEXT,
  combined_odds       NUMERIC,
  is_published        BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE vip_packages DISABLE ROW LEVEL SECURITY;

-- Seed the three fixed VIP packages (safe to re-run)
INSERT INTO vip_packages (id, name, price, availability_status, result_status, is_published)
VALUES
  ('vip_1', 'VIP 1', 0, 'draft', 'pending', false),
  ('vip_2', 'VIP 2', 0, 'draft', 'pending', false),
  ('vip_3', 'VIP 3', 0, 'draft', 'pending', false)
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- 3. VIP PACKAGE FIXTURES
--    Join table: admin-chosen fixtures per package.
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_package_fixtures (
  id             TEXT PRIMARY KEY,
  package_id     TEXT NOT NULL REFERENCES vip_packages(id) ON DELETE CASCADE,
  fixture_id     TEXT NOT NULL REFERENCES fixtures(id)    ON DELETE CASCADE,
  prediction     TEXT NOT NULL,                 -- e.g. "Home Win"
  odds           NUMERIC,                       -- admin-entered per-selection odds
  result_status  TEXT NOT NULL DEFAULT 'pending' -- pending | won | lost
);

ALTER TABLE vip_package_fixtures DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. FREE PREDICTIONS
--    Admin-controlled, publicly visible free tips.
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id          TEXT PRIMARY KEY,
  fixture_id  TEXT REFERENCES fixtures(id) ON DELETE CASCADE,
  tip         TEXT NOT NULL,                    -- e.g. "Over 2.5"
  odds        NUMERIC,
  result      TEXT NOT NULL DEFAULT 'pending'   -- pending | won | lost
);

ALTER TABLE predictions DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 5. USER TICKETS
--    Links an authenticated user to a purchased VIP package.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tickets (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id   TEXT REFERENCES vip_packages(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_tickets DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- Create daily_settings table for free bet status + booking code
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
-- ============================================================

-- Helper function to check if user is admin (prevents 42883 error)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.daily_settings (
  date DATE PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'available', 'sold_out')),
  free_booking_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.daily_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read
DROP POLICY IF EXISTS "Anyone can read daily_settings" ON public.daily_settings;
CREATE POLICY "Anyone can read daily_settings"
  ON public.daily_settings FOR SELECT USING (true);

-- Only admins can write
DROP POLICY IF EXISTS "Admins can manage daily_settings" ON public.daily_settings;
CREATE POLICY "Admins can manage daily_settings"
  ON public.daily_settings FOR ALL USING (public.is_admin());

-- Upsert today as draft so admin can see it immediately
INSERT INTO public.daily_settings (date, status)
VALUES (CURRENT_DATE, 'draft')
ON CONFLICT (date) DO NOTHING;


-- ============================================================
-- SYNC AUTH USERS TO PROFILES
-- Run this in: Supabase Dashboard → SQL Editor
--
-- What it does:
--   1. Creates the profiles table if it doesn't exist.
--   2. Ensures all required columns are present.
--   3. Inserts any existing users from auth.users into public.profiles
--      that are missing.
--   4. Sets up a trigger to automatically create a profile when
--      a new user signs up in the future.
-- ============================================================

-- 1. Create profiles table (safe on a fresh database)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  username    TEXT,
  status      TEXT DEFAULT 'active',
  is_vip      BOOLEAN DEFAULT false,
  role        TEXT DEFAULT 'user',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure any missing columns exist (safe to re-run on an existing table)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS is_vip BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. Sync existing users from auth.users to public.profiles
-- (ON CONFLICT will update existing rows, so usernames get backfilled too)
INSERT INTO public.profiles (id, email, username, role, created_at)
SELECT 
  id, 
  email, 
  raw_user_meta_data->>'name',
  COALESCE(raw_app_meta_data->>'role', 'user'),
  created_at
FROM auth.users
ON CONFLICT (id) DO UPDATE 
SET email = EXCLUDED.email, username = EXCLUDED.username, role = EXCLUDED.role;

-- 3. Create a function to automatically create a profile for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    COALESCE(NEW.raw_app_meta_data->>'role', 'user'),
    NEW.created_at
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email, username = EXCLUDED.username;
  RETURN NEW;
END;
$$;

-- 4. Create a trigger to call the function on sign up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


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
CREATE OR REPLACE VIEW public.secure_daily_settings AS
SELECT 
  date,
  status,
  updated_at,
  -- Only show booking code if admin OR user is logged in
  CASE 
    WHEN public.is_admin() THEN free_booking_code
    WHEN auth.uid() IS NOT NULL THEN free_booking_code
    ELSE NULL
  END as free_booking_code
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
CREATE OR REPLACE VIEW public.secure_vip_packages AS
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


-- ============================================================
-- SEED ADMIN USER
-- Run this in: Supabase Dashboard → SQL Editor
--
-- What it does:
--   1. If the user (a1tips5521@gmail.com) already exists →
--      sets their role to "admin" in app_metadata and
--      confirms their email.
--   2. If the user does NOT exist yet →
--      creates them with the password hash and sets role.
--
-- NOTE: If the user doesn't exist yet, sign up normally via
--       the app first, then re-run this script to promote them.
-- ============================================================

-- Step 1: Promote existing user to admin (confirm email + set role)
UPDATE auth.users
SET
  raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'a1tips5521@gmail.com';

-- Step 2: Verify the result
SELECT
  id,
  email,
  email_confirmed_at IS NOT NULL AS email_confirmed,
  raw_app_meta_data->>'role'    AS role,
  created_at
FROM auth.users
WHERE email = 'a1tips5521@gmail.com';

