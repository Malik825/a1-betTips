-- ============================================================
-- Create daily_settings table for free bet status + booking code
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================
-- ============================================================

-- Helper function to check if user is admin (prevents 42883 error)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS public.daily_settings (
  date DATE PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'available', 'sold_out')),
  free_booking_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.daily_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read
DROP POLICY IF EXISTS "Anyone can read daily_settings" ON public.daily_settings;
CREATE POLICY "Anyone can read daily_settings"
  ON public.daily_settings FOR SELECT USING (true);

-- Only admins can write
DROP POLICY IF EXISTS "Admins can manage daily_settings" ON public.daily_settings;
CREATE POLICY "Admins can manage daily_settings"
  ON public.daily_settings FOR ALL USING (public.is_admin());

-- Upsert today as draft so admin can see it immediately
INSERT INTO public.daily_settings (date, status)
VALUES (CURRENT_DATE, 'draft')
ON CONFLICT (date) DO NOTHING;
