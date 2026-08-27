-- ============================================================
-- DISABLE RLS ON PUBLIC CONTENT TABLES
-- Run this in: Supabase Dashboard → SQL Editor
--
-- These tables contain public/admin-only content.
-- RLS is unnecessary complexity here — security is handled
-- at the application level (only admins reach the admin panel).
-- Only user_tickets needs RLS since it contains per-user data.
-- ============================================================

-- Disable RLS on public content tables (no per-user private data)
ALTER TABLE public.fixtures            DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_packages        DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vip_package_fixtures DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_settings      DISABLE ROW LEVEL SECURITY;

-- Keep RLS enabled only on user_tickets (private per-user data)
-- and profiles (private per-user data)
ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;

-- Ensure public read access on all tables
GRANT SELECT ON public.fixtures             TO anon, authenticated;
GRANT SELECT ON public.predictions          TO anon, authenticated;
GRANT SELECT ON public.vip_packages         TO anon, authenticated;
GRANT SELECT ON public.vip_package_fixtures TO anon, authenticated;
GRANT SELECT ON public.daily_settings       TO anon, authenticated;

-- Ensure authenticated users can write to all tables
-- (admin UI uses authenticated session; anon users only need SELECT)
GRANT INSERT, UPDATE, DELETE ON public.fixtures             TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.predictions          TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vip_packages         TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.vip_package_fixtures TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.daily_settings       TO authenticated;

-- Grant on sequences too (needed for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Verify all tables are accessible
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
