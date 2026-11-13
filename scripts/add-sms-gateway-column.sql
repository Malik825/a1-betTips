-- ============================================================
-- ADD GATEWAY TRACKING TO sms_campaigns
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run (idempotent via ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE public.sms_campaigns
  ADD COLUMN IF NOT EXISTS gateway   TEXT    DEFAULT 'moolre',
  ADD COLUMN IF NOT EXISTS test_mode BOOLEAN DEFAULT false;

