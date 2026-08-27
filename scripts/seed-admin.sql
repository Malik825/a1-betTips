-- ============================================================
-- SEED ADMIN USER
-- Run this in: Supabase Dashboard → SQL Editor
--
-- What it does:
--   1. Sets role to "admin" in auth.users app_metadata
--   2. Sets role to "admin" in public.profiles (this is what is_admin() checks)
--   3. Confirms the user's email
-- ============================================================

-- Step 1: Promote existing user to admin in auth.users
UPDATE auth.users
SET
  raw_app_meta_data = raw_app_meta_data || '{"role": "admin"}'::jsonb,
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  updated_at = NOW()
WHERE email = 'a1tips5521@gmail.com';

-- Step 2: Also set role = 'admin' in public.profiles
-- (this is what is_admin() actually checks — without this, RLS blocks all admin writes)
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'a1tips5521@gmail.com';

-- Step 3: If profile row doesn't exist yet, insert it
INSERT INTO public.profiles (id, email, role, created_at)
SELECT id, email, 'admin', created_at
FROM auth.users
WHERE email = 'a1tips5521@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- Step 4: Verify both are set correctly
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  u.raw_app_meta_data->>'role' AS auth_role,
  p.role AS profile_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'a1tips5521@gmail.com';
