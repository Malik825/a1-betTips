-- ============================================================
-- Fix manual_payments NOT NULL constraints
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Allow sender_phone to be nullable (since phone is no longer asked on checkout)
ALTER TABLE public.manual_payments
  ALTER COLUMN sender_phone DROP NOT NULL;

-- 2. Allow reference_code to be nullable (since we verify by sender name and screenshot)
ALTER TABLE public.manual_payments
  ALTER COLUMN reference_code DROP NOT NULL;

-- 3. Ensure proof_url exists
ALTER TABLE public.manual_payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT;
