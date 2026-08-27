-- Add Paystack payment reference columns to user_tickets

ALTER TABLE public.user_tickets
ADD COLUMN IF NOT EXISTS payment_ref text,
ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
