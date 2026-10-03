-- ============================================================
-- Migration: Create vip_history table for archiving past settled VIP packages
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/sswhabqzmjrmbulrzbkr/sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.vip_history (
  id TEXT PRIMARY KEY,
  package_id TEXT NOT NULL,
  package_name TEXT NOT NULL,
  booking_code TEXT,
  combined_odds NUMERIC,
  result_status TEXT NOT NULL DEFAULT 'won', -- won | lost
  settled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  selections JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for speedy ordering by date
CREATE INDEX IF NOT EXISTS idx_vip_history_settled_date ON public.vip_history (settled_date DESC);
CREATE INDEX IF NOT EXISTS idx_vip_history_package_id ON public.vip_history (package_id);

-- Disable RLS for easy reads by all visitors
ALTER TABLE public.vip_history DISABLE ROW LEVEL SECURITY;

-- Grant permissions to anon and authenticated roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vip_history TO anon, authenticated, service_role;
