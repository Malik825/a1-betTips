-- ============================================================
-- 1. ADMIN SETTINGS (Ensures table exists before altering)
-- ============================================================
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

-- Ensure row 1 exists
INSERT INTO public.admin_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Safely add columns if admin_settings already existed
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS momo_number TEXT DEFAULT '0556224818',
  ADD COLUMN IF NOT EXISTS momo_name TEXT DEFAULT 'JOHN YEBOAH',
  ADD COLUMN IF NOT EXISTS momo_network TEXT DEFAULT 'MTN Mobile Money',
  ADD COLUMN IF NOT EXISTS momo_instructions TEXT DEFAULT 'Send payment via MoMo to the number above using your Reference Code as the reference/remarks. Once sent, enter your sender phone number and transaction ID below and submit.',
  ADD COLUMN IF NOT EXISTS manual_payment_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS kora_public_key TEXT DEFAULT '';

-- Allow read on admin_settings
GRANT SELECT ON public.admin_settings TO anon, authenticated;

-- ============================================================
-- 2. HELPER FUNCTION: is_admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- ============================================================
-- 3. MANUAL PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manual_payments (
  id TEXT PRIMARY KEY DEFAULT ('pay_' || replace(gen_random_uuid()::text, '-', '')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES vip_packages(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  sender_phone TEXT,
  sender_name TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  transaction_id TEXT,
  network TEXT NOT NULL DEFAULT 'MTN',
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- In case manual_payments was created previously without proof_url
ALTER TABLE public.manual_payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- ============================================================
-- 4. ROW LEVEL SECURITY (RLS) FOR MANUAL PAYMENTS
-- ============================================================
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manual payments" ON public.manual_payments;
CREATE POLICY "Users can view own manual payments"
ON public.manual_payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own manual payments" ON public.manual_payments;
CREATE POLICY "Users can insert own manual payments"
ON public.manual_payments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins full access on manual_payments" ON public.manual_payments;
CREATE POLICY "Admins full access on manual_payments"
ON public.manual_payments FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE ON public.manual_payments TO authenticated;

-- ============================================================
-- 5. STORAGE BUCKET & POLICIES FOR PAYMENT PROOFS
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Users can upload payment proofs" ON storage.objects;
CREATE POLICY "Users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

DROP POLICY IF EXISTS "Anyone can view payment proofs" ON storage.objects;
CREATE POLICY "Anyone can view payment proofs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'payment-proofs');
