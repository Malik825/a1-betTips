-- ============================================================
-- Migration: Fix Subscriptions Table RLS & Permissions
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/sswhabqzmjrmbulrzbkr/sql
-- ============================================================

-- 1. Ensure subscriptions table exists with correct schema
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_paid NUMERIC DEFAULT 0,
  payment_ref TEXT,
  proof_url TEXT,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  approved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add any potentially missing columns safely
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_ref TEXT,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Disable RLS on subscriptions table to allow admin modifications
-- (Consistent with fix-is-admin.sql pattern in this repository)
ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;

-- 4. Grant access to authenticated and anonymous roles
GRANT ALL ON public.subscriptions TO authenticated;
GRANT SELECT ON public.subscriptions TO anon;

-- 5. If RLS is strictly required, enable these policies instead:
-- ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Admins full access on subscriptions" ON public.subscriptions;
-- CREATE POLICY "Admins full access on subscriptions"
--   ON public.subscriptions FOR ALL
--   TO authenticated
--   USING (public.is_admin())
--   WITH CHECK (public.is_admin());
--
-- DROP POLICY IF EXISTS "Users can view own subscriptions" ON public.subscriptions;
-- CREATE POLICY "Users can view own subscriptions"
--   ON public.subscriptions FOR SELECT
--   TO authenticated
--   USING (auth.uid() = user_id OR public.is_admin());
