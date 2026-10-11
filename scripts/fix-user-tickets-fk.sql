-- ============================================================
-- FIX: user_tickets.package_id foreign key constraint
-- ============================================================
-- PROBLEM:
--   user_tickets.package_id has a foreign key constraint
--   (user_tickets_package_id_fkey) referencing vip_packages(id).
--   When a user acquires a subscription pass (e.g. "sub_all_access",
--   "sub_vip_1", etc.) or a recovery pass ("recovery"), inserting or
--   updating user_tickets violates this constraint because those IDs
--   do not live in the standard vip_packages table.
--
-- FIX:
--   1. Drop user_tickets_package_id_fkey constraint so package_id can hold
--      both vip_packages IDs, subscription IDs (sub_*), and recovery IDs.
--   2. Ensure "recovery" package row exists in vip_packages just in case
--      queries perform an INNER/LEFT JOIN on vip_packages.
--   3. Reload PostgREST schema cache.
--
-- Safe to re-run multiple times.
-- ============================================================

-- Step 1: Drop foreign key constraint on package_id
ALTER TABLE public.user_tickets
  DROP CONSTRAINT IF EXISTS user_tickets_package_id_fkey;

-- Step 2: Ensure the recovery row is safely seeded in vip_packages
INSERT INTO public.vip_packages (id, name, price, availability_status, result_status, is_published)
VALUES ('recovery', 'Recovery Package 🔄', 0, 'draft', 'pending', false)
ON CONFLICT (id) DO NOTHING;

-- Step 3: Reload schema cache
NOTIFY pgrst, 'reload schema';

-- Step 4: Verify remaining constraints on user_tickets
SELECT
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'user_tickets';
