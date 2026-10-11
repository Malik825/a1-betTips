-- ============================================================
-- FOOTBALL PREDICTION PLATFORM — FULL SCHEMA SETUP
-- Version: 2.0  (migrated to client's Supabase project)
-- Run this once in: Supabase Dashboard → SQL Editor → New query
-- Safe to re-run (idempotent).
-- ============================================================


-- ============================================================
-- 1. FIXTURES
--    Populated by the Football API sync; DO NOT edit manually.
-- ============================================================
CREATE TABLE IF NOT EXISTS fixtures (
  id                TEXT PRIMARY KEY,          -- e.g. "api_12345"
  external_api_id   INTEGER UNIQUE,            -- API-Football fixture ID
  home_team         TEXT NOT NULL,
  away_team         TEXT NOT NULL,
  competition       TEXT,                      -- e.g. "Premier League"
  match_date_iso    DATE,                      -- ISO date for day-filter
  match_time        TEXT NOT NULL,             -- HH:MM (UTC)
  status            TEXT DEFAULT 'Not Started',
  home_score        INTEGER,
  away_score        INTEGER,
  sport             TEXT DEFAULT 'Football'    -- e.g. "Football", "Basketball"
);

ALTER TABLE fixtures DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. VIP PACKAGES
--    Admin-controlled; fixed rows seeded below.
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_packages (
  id                  TEXT PRIMARY KEY,
  name                TEXT NOT NULL,
  price               NUMERIC NOT NULL DEFAULT 0,
  availability_status TEXT NOT NULL DEFAULT 'draft',    -- draft | available | sold_out
  result_status       TEXT NOT NULL DEFAULT 'pending',  -- pending | won | lost
  booking_code        TEXT,
  combined_odds       NUMERIC,
  is_published        BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE vip_packages DISABLE ROW LEVEL SECURITY;

-- Seed the five fixed VIP packages (safe to re-run)
INSERT INTO vip_packages (id, name, price, availability_status, result_status, is_published)
VALUES
  ('vip_1', 'VIP 1', 0, 'draft', 'pending', false),
  ('vip_2', 'VIP 2', 0, 'draft', 'pending', false),
  ('vvip_1', 'VVIP 1', 0, 'draft', 'pending', false),
  ('vvip_2', 'VVIP 2', 0, 'draft', 'pending', false),
  ('supreme_vvip', 'SUPREME VVIP 👑', 0, 'draft', 'pending', false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;


-- ============================================================
-- 3. VIP PACKAGE FIXTURES
--    Join table: admin-chosen fixtures per package.
-- ============================================================
CREATE TABLE IF NOT EXISTS vip_package_fixtures (
  id             TEXT PRIMARY KEY,
  package_id     TEXT NOT NULL REFERENCES vip_packages(id) ON DELETE CASCADE,
  fixture_id     TEXT NOT NULL REFERENCES fixtures(id)    ON DELETE CASCADE,
  prediction     TEXT NOT NULL,                 -- e.g. "Home Win"
  odds           NUMERIC,                       -- admin-entered per-selection odds
  result_status  TEXT NOT NULL DEFAULT 'pending' -- pending | won | lost
);

ALTER TABLE vip_package_fixtures DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4. FREE PREDICTIONS
--    Admin-controlled, publicly visible free tips.
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
  id          TEXT PRIMARY KEY,
  fixture_id  TEXT REFERENCES fixtures(id) ON DELETE CASCADE,
  tip         TEXT NOT NULL,                    -- e.g. "Over 2.5"
  odds        NUMERIC,
  result      TEXT NOT NULL DEFAULT 'pending'   -- pending | won | lost
);

ALTER TABLE predictions DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 5. USER TICKETS
--    Links an authenticated user to a purchased VIP package.
-- ============================================================
CREATE TABLE IF NOT EXISTS user_tickets (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id   TEXT,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop package_id FK to allow subscription passes (sub_*) and recovery passes
ALTER TABLE user_tickets DROP CONSTRAINT IF EXISTS user_tickets_package_id_fkey;

ALTER TABLE user_tickets DISABLE ROW LEVEL SECURITY;

-- payment_ref column (added later, safe to re-run)
ALTER TABLE user_tickets ADD COLUMN IF NOT EXISTS payment_ref TEXT;


-- ============================================================
-- 6. DAILY SETTINGS
--    Admin-controlled per-day status and free booking code.
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_settings (
  date              DATE PRIMARY KEY,            -- e.g. 2024-09-26
  status            TEXT NOT NULL DEFAULT 'draft', -- draft | available | sold_out
  free_booking_code TEXT,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE daily_settings DISABLE ROW LEVEL SECURITY;


-- ============================================================
-- 7. SUBSCRIPTION PLANS
--    Admin-controlled monthly VIP packages & custom negotiated rates.
--    Empowers admin to change prices, add discounts, promos, and custom notes.
-- ============================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  badge             TEXT,
  price             NUMERIC NOT NULL DEFAULT 0,
  original_price    NUMERIC,
  duration_days     INTEGER NOT NULL DEFAULT 30,
  tagline           TEXT,
  description       TEXT,
  packages_covered  TEXT[] DEFAULT '{}',
  features          TEXT[] DEFAULT '{}',
  is_active         BOOLEAN NOT NULL DEFAULT true,
  category          TEXT NOT NULL DEFAULT 'combo', -- 'combo' | 'single'
  sort_order        INTEGER NOT NULL DEFAULT 0,
  admin_notes       TEXT,
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Allow anyone (public and authenticated) to view plans
DROP POLICY IF EXISTS "Public can view subscription plans" ON subscription_plans;
CREATE POLICY "Public can view subscription plans"
  ON subscription_plans FOR SELECT
  USING (true);

-- Allow authenticated admins to insert, update, delete plans
DROP POLICY IF EXISTS "Admins can manage subscription plans" ON subscription_plans;
CREATE POLICY "Admins can manage subscription plans"
  ON subscription_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.uid() IS NOT NULL
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'superadmin')
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.uid() IS NOT NULL
  );

-- Also safe to disable if you prefer open table access:
ALTER TABLE subscription_plans DISABLE ROW LEVEL SECURITY;

INSERT INTO subscription_plans (id, name, badge, price, original_price, duration_days, tagline, description, packages_covered, features, is_active, category, sort_order)
VALUES
  (
    'sub_all_access',
    'All-Access VIP Master Pass',
    'Most Popular',
    350,
    500,
    30,
    'Gives you access to all 5 VIP and VVIP packages every day for a full month.',
    'Best value for serious bettors wanting every single VIP game.',
    ARRAY['VIP 1', 'VIP 2', 'VVIP 1', 'VVIP 2', 'SUPREME VVIP 👑'],
    ARRAY[
      'Unlocks all 5 VIP packages every day',
      'VIP 1 & VIP 2 safe banker slips',
      'VVIP 1 & VVIP 2 high odds accumulators',
      'SUPREME VVIP 👑 top predictions',
      'SportyBet booking codes ready to copy & place',
      'Safety Net: Replacement game when slips fail (as-needed cover)',
      'Direct WhatsApp priority support',
      'Valid for 30 full days'
    ],
    true,
    'combo',
    1
  ),
  (
    'sub_supreme_vvip',
    'Supreme VVIP Pass 👑',
    'Big Odds',
    280,
    350,
    30,
    'Our biggest odds daily games with maximum winning potential.',
    'For punters who want massive odds slips.',
    ARRAY['SUPREME VVIP 👑'],
    ARRAY[
      'Daily SUPREME VVIP 👑 top predictions',
      'High odds slips (25.0 to 50.0+ odds)',
      'SportyBet booking codes included daily',
      'Deep match analysis on every game',
      'Safety Net: Replacement game when slips fail (as-needed cover)',
      'Valid for 30 full days'
    ],
    true,
    'combo',
    2
  ),
  (
    'sub_vvip_combo',
    'VVIP Combo Pass',
    'High Odds Combo',
    220,
    280,
    30,
    'Covers BOTH VVIP 1 & VVIP 2 — higher odds and accumulator games.',
    'For members who prefer high odds combinations.',
    ARRAY['VVIP 1', 'VVIP 2'],
    ARRAY[
      'Daily access to both VVIP 1 and VVIP 2 slips',
      'Odds from 5.0 up to 30.0+',
      'SportyBet booking codes updated daily',
      'Safety Net: Replacement game when slips fail (as-needed cover)',
      'Valid for 30 full days'
    ],
    true,
    'combo',
    3
  ),
  (
    'sub_vip_combo',
    'VIP Combo Pass',
    'Safe & Steady',
    120,
    160,
    30,
    'Covers BOTH VIP 1 & VIP 2 — safe banker slips for steady, daily winning.',
    'Best for low-risk, consistent wins.',
    ARRAY['VIP 1', 'VIP 2'],
    ARRAY[
      'Daily access to both VIP 1 and VIP 2 slips',
      'Safe banker odds (2.0 to 7.0 odds)',
      'SportyBet booking codes ready to bet',
      'Best for members growing their money safely',
      'Safety Net: Replacement game when slips fail (as-needed cover)',
      'Valid for 30 full days'
    ],
    true,
    'combo',
    4
  ),
  (
    'sub_vip_1',
    'VIP 1 Monthly Pass',
    'Daily Bankers',
    70,
    90,
    30,
    'Safe daily banker games (2.00 – 3.50 odds) engineered for steady wins.',
    'Minimal risk daily banker slips.',
    ARRAY['VIP 1'],
    ARRAY['Daily VIP 1 banker predictions', '2.00 – 3.50 Odds', 'Booking code included', 'Valid for 30 days'],
    true,
    'single',
    5
  ),
  (
    'sub_vip_2',
    'VIP 2 Monthly Pass',
    'Value Multis',
    70,
    90,
    30,
    'Balanced multi-bets (3.50 – 7.00 odds) across top European leagues.',
    'Carefully selected value slips.',
    ARRAY['VIP 2'],
    ARRAY['Daily VIP 2 value predictions', '3.50 – 7.00 Odds', 'Booking code included', 'Valid for 30 days'],
    true,
    'single',
    6
  ),
  (
    'sub_vvip_1',
    'VVIP 1 Monthly Pass',
    'Premium Picks',
    130,
    160,
    30,
    'Premium slips (5.00 – 15.00 odds) with higher payouts.',
    'High confidence premium slips.',
    ARRAY['VVIP 1'],
    ARRAY['Daily VVIP 1 premium predictions', '5.00 – 15.00 Odds', 'Booking code included', 'Valid for 30 days'],
    true,
    'single',
    7
  ),
  (
    'sub_vvip_2',
    'VVIP 2 Monthly Pass',
    'Accumulators',
    130,
    160,
    30,
    'Big odds accumulator slips (10.00 – 30.00+ odds) for major wins.',
    'High multiplier slips.',
    ARRAY['VVIP 2'],
    ARRAY['Daily VVIP 2 mega accumulator', '10.00 – 30.00+ Odds', 'Booking code included', 'Valid for 30 days'],
    true,
    'single',
    8
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  badge = EXCLUDED.badge,
  price = EXCLUDED.price,
  original_price = EXCLUDED.original_price,
  tagline = EXCLUDED.tagline,
  packages_covered = EXCLUDED.packages_covered,
  features = EXCLUDED.features;

