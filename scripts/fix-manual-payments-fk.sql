-- ============================================================
-- FIX: manual_payments.package_id foreign key
-- ============================================================
-- PROBLEM:
--   manual_payments.package_id had a FK → vip_packages(id).
--   Subscription payments use IDs like "sub_all_access" which live
--   in subscription_plans, NOT vip_packages → FK violation on insert.
--
-- FIX:
--   Drop the FK constraint. package_id stays as TEXT and can hold
--   both vip_packages IDs and subscription_plans IDs.
--   Application logic already handles the two cases by prefix (sub_*).
--
-- SAFE TO RE-RUN (IF NOT EXISTS / DROP IF EXISTS guards).
-- ============================================================

-- Step 1: Drop the offending FK constraint
ALTER TABLE public.manual_payments
  DROP CONSTRAINT IF EXISTS manual_payments_package_id_fkey;

-- Step 2: Fix the is_admin() function that is defined in
--         create-manual-payments.sql with the WRONG check
--         (it used is_admin = true instead of role = 'admin').
--         This override makes it consistent with setup-rls.sql.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND (role = 'admin' OR role = 'superadmin')
  );
$$;

-- Step 3: Verify – run this to confirm the constraint is gone
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'manual_payments';
