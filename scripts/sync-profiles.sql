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
