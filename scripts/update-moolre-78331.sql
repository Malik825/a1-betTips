-- ============================================================
-- Update Moolre Configuration for Approved Wallet A1TIPS Deck (78331)
-- ============================================================

ALTER TABLE admin_settings 
ADD COLUMN IF NOT EXISTS moolre_account_number TEXT DEFAULT '11090906078331',
ADD COLUMN IF NOT EXISTS moolre_webhook_secret TEXT DEFAULT '4fc9a341-d0b9-4c23-bc2f-c354f94ebea0';

UPDATE admin_settings 
SET 
  payment_gateway = 'moolre',
  moolre_api_user = 'a1tipsdeck',
  moolre_pub_key = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1c2VyaWQiOjExMDkwOSwid2FsbGV0aWQiOiI3ODMzMSIsImV4cCI6MTk1NjUyNzk5OX0.Dt8M2UCTHgBiQ2kiAlfdLIidIT9LqY8822lsEe4j2Kc',
  moolre_secret_key = 'bOYwB4Buu8zCZ9zDiscmwHKyH4C8abeBfdIp5rvvtTlrfjuv4k3PcR8eUkAkcT2l',
  moolre_account_number = '11090906078331',
  moolre_webhook_secret = '4fc9a341-d0b9-4c23-bc2f-c354f94ebea0',
  moolre_test_mode = false
WHERE id = 1;

-- Verify updated settings
SELECT 
  payment_gateway,
  moolre_api_user,
  moolre_account_number,
  moolre_webhook_secret,
  moolre_test_mode,
  LEFT(moolre_pub_key, 25) AS pub_key_preview,
  LEFT(moolre_secret_key, 12) AS secret_key_preview
FROM admin_settings 
WHERE id = 1;

