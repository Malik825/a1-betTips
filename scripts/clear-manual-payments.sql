-- ============================================================
-- CLEAR MANUAL PAYMENTS (START FRESH)
-- Run this in: Supabase Dashboard -> SQL Editor
-- ============================================================

-- 1. Delete all offline manual payments (preserves live automated Moolre transactions)
DELETE FROM public.manual_payments
WHERE reference_code NOT LIKE 'moolre_%'
  AND (transaction_id IS NULL OR transaction_id NOT LIKE '9375%')
  AND (network NOT ILIKE '%moolre%' OR network IS NULL);

-- 2. Clean up any unlinked or rejected test subscriptions created during manual checkout testing
DELETE FROM public.subscriptions
WHERE status IN ('pending', 'cancelled')
  AND (proof_url IS NOT NULL OR payment_ref LIKE 'MOMO-%' OR payment_ref LIKE 'NG-%');

-- NOTE: If you wish to wipe EVERYTHING in the manual_payments table (including Moolre tests),
-- simply run:
-- TRUNCATE TABLE public.manual_payments CASCADE;
