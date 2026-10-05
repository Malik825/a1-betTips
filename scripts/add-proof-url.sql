-- Add proof_url column to manual_payments if it doesn't exist
ALTER TABLE manual_payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT;

-- Create storage bucket for payment proofs (run once)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
-- ON CONFLICT (id) DO NOTHING;
