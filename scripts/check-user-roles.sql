-- ============================================================
-- CHECK USER ROLES & PERMISSIONS
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Inspect ALL users and their roles in both auth.users and public.profiles
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  u.raw_app_meta_data->>'role'     AS auth_app_role,
  u.raw_user_meta_data->>'role'    AS auth_user_role,
  p.role                           AS profile_role,
  p.username,
  u.created_at
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- ============================================================
-- 2. QUICK ROLE FIX / PROMOTION (Run if your user shows NULL or user)
-- Replace 'YOUR_EMAIL_HERE' with your actual login email:
-- ============================================================
/*
DO $$
DECLARE
  target_email TEXT := 'YOUR_EMAIL_HERE'; -- <-- PUT YOUR ACTUAL EMAIL HERE
  target_user_id UUID;
BEGIN
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NOT NULL THEN
    -- Update auth.users app_metadata (for JWT token)
    UPDATE auth.users
    SET 
      raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "superadmin"}'::jsonb,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = target_user_id;

    -- Upsert public.profiles
    INSERT INTO public.profiles (id, email, role)
    VALUES (target_user_id, target_email, 'superadmin')
    ON CONFLICT (id) DO UPDATE SET role = 'superadmin', email = target_email;

    RAISE NOTICE 'User % is now superadmin!', target_email;
  ELSE
    RAISE NOTICE 'User % not found in auth.users!', target_email;
  END IF;
END;
$$;
*/
