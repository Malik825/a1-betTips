-- ============================================================
-- 1. MANUAL PAYMENTS TABLE
--    Tracks manual Mobile Money (MoMo) payments submitted by users
-- ============================================================
CREATE TABLE IF NOT EXISTS public.manual_payments (
  id TEXT PRIMARY KEY DEFAULT ('pay_' || replace(gen_random_uuid()::text, '-', '')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL REFERENCES vip_packages(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  sender_phone TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  reference_code TEXT NOT NULL,
  transaction_id TEXT,
  network TEXT NOT NULL DEFAULT 'MTN',
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ============================================================
ALTER TABLE public.manual_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own manual payments" ON public.manual_payments;
CREATE POLICY "Users can view own manual payments"
ON public.manual_payments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

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

-- ============================================================
-- 3. ADMIN SETTINGS EXTENSIONS FOR MOMO
-- ============================================================
ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS payment_gateway TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS momo_number TEXT DEFAULT '0550000000',
  ADD COLUMN IF NOT EXISTS momo_name TEXT DEFAULT 'A1 Predictions',
  ADD COLUMN IF NOT EXISTS momo_network TEXT DEFAULT 'MTN Mobile Money',
  ADD COLUMN IF NOT EXISTS momo_instructions TEXT DEFAULT 'Send payment via MoMo to the number above using your Reference Code as the reference/remarks. Once sent, enter your sender phone number and transaction ID below and submit.',
  ADD COLUMN IF NOT EXISTS manual_payment_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS kora_public_key TEXT DEFAULT '';
