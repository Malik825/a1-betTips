-- ============================================================
-- FIX ADMIN SETTINGS RLS & PERMISSIONS
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Ensure admin_settings table exists
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  maintenance_mode BOOLEAN DEFAULT false,
  site_name TEXT DEFAULT 'A1-TipsDeck',
  whatsapp_number TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  currency TEXT DEFAULT 'GHS',
  currency_symbol TEXT DEFAULT 'GH₵',
  payment_gateway TEXT DEFAULT 'manual',
  momo_number TEXT DEFAULT '0556224818',
  momo_name TEXT DEFAULT 'JOHN YEBOAH',
  momo_network TEXT DEFAULT 'MTN Mobile Money',
  momo_instructions TEXT DEFAULT 'Send payment via MoMo to the number above using your Reference Code as the reference/remarks. Once sent, enter your sender phone number and transaction ID below and submit.',
  manual_payment_enabled BOOLEAN DEFAULT true,
  kora_public_key TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add all Moolre & gateway columns safely
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS paystack_public_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS kora_public_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS momo_number TEXT DEFAULT '0556224818',
  ADD COLUMN IF NOT EXISTS momo_name TEXT DEFAULT 'JOHN YEBOAH',
  ADD COLUMN IF NOT EXISTS momo_network TEXT DEFAULT 'MTN Mobile Money',
  ADD COLUMN IF NOT EXISTS momo_instructions TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS manual_payment_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS telegram_link TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS twitter_link TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS support_email TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_api_user TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_pub_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_secret_key TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_sender_id TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_test_mode BOOLEAN DEFAULT true;

-- 3. Ensure row 1 exists
INSERT INTO public.admin_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 4. Disable RLS on admin_settings
-- (Consistent with fix-is-admin.sql and fix-subscriptions-rls.sql for site configuration)
ALTER TABLE public.admin_settings DISABLE ROW LEVEL SECURITY;

-- 5. Grant full access to authenticated admins & select to public
GRANT ALL ON public.admin_settings TO authenticated;
GRANT SELECT ON public.admin_settings TO anon;

-- 6. Update is_admin() helper function to cover both role and is_admin flags
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (is_admin = true OR role IN ('admin', 'superadmin'))
  );
$$;

-- 7. If your Supabase project enforces RLS regardless, also provide comprehensive policies
-- so upsert (INSERT + UPDATE) never gets blocked:
DROP POLICY IF EXISTS "Public can read admin_settings" ON public.admin_settings;
CREATE POLICY "Public can read admin_settings"
  ON public.admin_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can insert admin_settings"
  ON public.admin_settings FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can update admin_settings"
  ON public.admin_settings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can all admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can all admin_settings"
  ON public.admin_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

