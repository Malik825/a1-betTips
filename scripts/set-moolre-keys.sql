-- ============================================================
-- CONFIGURE MOOLRE KEYS & FIX RLS PERMISSIONS
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Ensure table and all columns exist
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
  momo_instructions TEXT DEFAULT '',
  manual_payment_enabled BOOLEAN DEFAULT true,
  kora_public_key TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
  ADD COLUMN IF NOT EXISTS moolre_sender_id TEXT DEFAULT 'A1TIPS',
  ADD COLUMN IF NOT EXISTS moolre_test_mode BOOLEAN DEFAULT true;

-- 2. Ensure row 1 exists
INSERT INTO public.admin_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- 3. Save your Moolre Public, Private API Keys & Username
UPDATE public.admin_settings
SET
  moolre_api_user = 'a1tipsdeck',
  moolre_pub_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjExMDkwOSwid2FsbGV0aWQiOiI3NzcwMiIsImV4cCI6MTk1NjUyNzk5OX0.yz_idshPOBMpIeXVgGPNkBtTxSMUvwdd5-eQt5cVYXk',
  moolre_secret_key = 'frIolbAdaGmn0b4GiV1W9lCDnJ99hE6QPx0zTIAtLvCSzZVT01xyegUpTXjo8CTg',
  moolre_sender_id = 'A1TIPS',
  moolre_test_mode = true, -- Change to false when ready for live mode
  updated_at = NOW()
WHERE id = 1;

-- 4. Disable RLS on admin_settings to prevent "new row violates row-level security policy"
ALTER TABLE public.admin_settings DISABLE ROW LEVEL SECURITY;

-- 5. Grant permissions to authenticated admins & anonymous reads
GRANT ALL ON public.admin_settings TO authenticated;
GRANT SELECT ON public.admin_settings TO anon;

-- 6. Fallback policies if RLS is re-enabled globally
DROP POLICY IF EXISTS "Public can read admin_settings" ON public.admin_settings;
CREATE POLICY "Public can read admin_settings" ON public.admin_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can all admin_settings" ON public.admin_settings;
CREATE POLICY "Admins can all admin_settings" ON public.admin_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7. Verify the saved keys
SELECT 
  id, 
  payment_gateway, 
  moolre_api_user, 
  moolre_sender_id,
  moolre_test_mode,
  moolre_pub_key
FROM public.admin_settings
WHERE id = 1;
