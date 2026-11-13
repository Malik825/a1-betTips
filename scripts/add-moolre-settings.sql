-- ============================================================
-- ADD MOOLRE GATEWAY COLUMNS TO admin_settings
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run (idempotent via ADD COLUMN IF NOT EXISTS)
-- ============================================================

ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS moolre_api_user     TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_pub_key      TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_secret_key   TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_sender_id    TEXT    DEFAULT '',
  ADD COLUMN IF NOT EXISTS moolre_test_mode    BOOLEAN DEFAULT true;

-- Ensure the singleton row exists
INSERT INTO public.admin_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

