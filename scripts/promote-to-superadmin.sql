-- ============================================================
-- PROMOTE USER TO SUPERADMIN
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Replace with your actual account email
-- e.g. 'a1tips5521@gmail.com' or whatever email you log in with
DO $$
DECLARE
  v_email TEXT := 'YOUR_EMAIL_HERE'; -- <=== PUT YOUR LOG IN EMAIL HERE
  v_user_id UUID;
BEGIN
  -- Find the user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE LOWER(email) = LOWER(v_email);

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found with email: %', v_email;
  END IF;

  -- 1. Update auth.users app_metadata (stored in Supabase auth JWT token)
  UPDATE auth.users
  SET
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "superadmin"}'::jsonb,
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    updated_at = NOW()
  WHERE id = v_user_id;

  -- 2. Update or insert in public.profiles table
  INSERT INTO public.profiles (id, email, role, created_at)
  VALUES (v_user_id, v_email, 'superadmin', NOW())
  ON CONFLICT (id) DO UPDATE
    SET role = 'superadmin', email = EXCLUDED.email;

  RAISE NOTICE 'SUCCESS! User % (ID: %) is now a superadmin.', v_email, v_user_id;
END;
$$;

-- STEP 2: Verify the change took effect
SELECT
  u.id,
  u.email,
  u.raw_app_meta_data->>'role' AS auth_role,
  p.role                       AS profile_role
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE LOWER(u.email) = LOWER('YOUR_EMAIL_HERE'); -- <=== PUT SAME EMAIL HERE
