-- ============================================================
-- SEED SUPER-ADMIN USER
-- Run this in: Supabase Dashboard → SQL Editor
--
-- What it does:
--   1. Creates a superadmin account in auth.users (if not exists)
--   2. Confirms their email automatically
--   3. Sets role = 'superadmin' in both auth metadata + public.profiles
--   4. Creates/upserts their profile row
--
-- After running:
--   - Login with the email/password below at /admin/login
--   - IMPORTANT: change the password after first login
-- ============================================================

DO $$
DECLARE
  v_superadmin_email TEXT := 'superadmin@a1tipsdeck.com';
  v_superadmin_pass  TEXT := 'A1Admin@2024!';          -- Change this after first login
  v_superadmin_name  TEXT := 'Super Admin';
  v_user_id          UUID;
BEGIN

  -- ── 1. Check if the user already exists ──────────────────────
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_superadmin_email;

  -- ── 2. Create if missing ─────────────────────────────────────
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change_token_new,
      recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_superadmin_email,
      crypt(v_superadmin_pass, gen_salt('bf')),
      NOW(),                                             -- auto-confirmed
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email'],
        'role', 'superadmin'
      ),
      jsonb_build_object('name', v_superadmin_name),
      NOW(),
      NOW(),
      '',
      '',
      ''
    );

    RAISE NOTICE 'Created new superadmin user: % (id: %)', v_superadmin_email, v_user_id;
  ELSE
    -- ── 3. Promote existing user to superadmin ────────────────
    UPDATE auth.users
    SET
      raw_app_meta_data   = raw_app_meta_data || '{"role": "superadmin"}'::jsonb,
      email_confirmed_at  = COALESCE(email_confirmed_at, NOW()),
      updated_at          = NOW()
    WHERE id = v_user_id;

    RAISE NOTICE 'Promoted existing user to superadmin: % (id: %)', v_superadmin_email, v_user_id;
  END IF;

  -- ── 4. Upsert the profile row ────────────────────────────────
  INSERT INTO public.profiles (id, email, username, role, created_at)
  VALUES (v_user_id, v_superadmin_email, v_superadmin_name, 'superadmin', NOW())
  ON CONFLICT (id) DO UPDATE
    SET role     = 'superadmin',
        email    = v_superadmin_email,
        username = v_superadmin_name;

  RAISE NOTICE 'Profile upserted for %', v_superadmin_email;
END;
$$;

-- ── 5. Verify ────────────────────────────────────────────────────
SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL                AS email_confirmed,
  u.raw_app_meta_data  ->> 'role'                 AS auth_role,
  p.role                                          AS profile_role,
  p.username
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'superadmin@a1tipsdeck.com';
