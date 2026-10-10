-- ============================================================
-- RECOVERY PACKAGE SYSTEM SETUP
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/sswhabqzmjrmbulrzbkr/sql
-- ============================================================

-- 1. Ensure vip_packages table & target_packages column exist
CREATE TABLE IF NOT EXISTS public.vip_packages (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  price               NUMERIC NOT NULL DEFAULT 0,
  availability_status TEXT NOT NULL DEFAULT 'draft',
  result_status       TEXT NOT NULL DEFAULT 'pending',
  booking_code        TEXT,
  combined_odds       NUMERIC,
  is_published        BOOLEAN NOT NULL DEFAULT false,
  target_packages     TEXT DEFAULT 'all',
  expires_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vip_packages ADD COLUMN IF NOT EXISTS target_packages TEXT DEFAULT 'all';
ALTER TABLE public.vip_packages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.vip_packages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Ensure public access to vip_packages
ALTER TABLE public.vip_packages DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.vip_packages TO anon, authenticated, service_role;

-- 2. Seed recovery package
INSERT INTO public.vip_packages (id, name, price, availability_status, result_status, is_published, target_packages)
VALUES ('recovery', 'Recovery Package 🔄', 0, 'draft', 'pending', false, 'all')
ON CONFLICT (id) DO UPDATE SET
  name = 'Recovery Package 🔄',
  target_packages = COALESCE(public.vip_packages.target_packages, 'all');

-- 3. Create recovery_requests table
CREATE TABLE IF NOT EXISTS public.recovery_requests (
  id TEXT PRIMARY KEY DEFAULT ('rec_' || replace(gen_random_uuid()::text, '-', '')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_id TEXT NOT NULL,
  original_package_id TEXT NOT NULL,
  recovery_package_id TEXT NOT NULL DEFAULT 'recovery',
  sender_name TEXT,
  sender_phone TEXT,
  proof_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_ticket_recovery UNIQUE (user_id, ticket_id)
);

-- Ensure permissions (disable RLS to match existing project conventions)
ALTER TABLE public.recovery_requests DISABLE ROW LEVEL SECURITY;
GRANT ALL ON public.recovery_requests TO anon, authenticated, service_role;

-- 4. Ensure payment-proofs bucket is ready
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 5. Force reload PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
