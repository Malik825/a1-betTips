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
--    Admin-controlled; three fixed rows seeded below.
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

-- Seed the three fixed VIP packages (safe to re-run)
INSERT INTO vip_packages (id, name, price, availability_status, result_status, is_published)
VALUES
  ('vip_1', 'VIP 1', 0, 'draft', 'pending', false),
  ('vip_2', 'VIP 2', 0, 'draft', 'pending', false),
  ('vip_3', 'VIP 3', 0, 'draft', 'pending', false)
ON CONFLICT (id) DO NOTHING;


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
  package_id   TEXT REFERENCES vip_packages(id) ON DELETE CASCADE,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_tickets DISABLE ROW LEVEL SECURITY;
