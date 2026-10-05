-- ============================================================
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- Project: sswhabqzmjrmbulrzbkr
-- ============================================================

-- 1. Create the storage bucket
--    public = true  → getPublicUrl() works directly in the admin panel.
--    The path already includes the user UUID + timestamp, making it
--    unguessable. Flip to false and use signed URLs if you need strict privacy.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  true,                           -- public bucket → publicUrl works
  5242880,                        -- 5 MB max per file
  ARRAY['image/jpeg','image/png','image/webp','image/gif','image/jpg']
)
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 5242880,
      allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','image/jpg'];

-- ============================================================
-- 2. RLS policies for storage.objects
-- ============================================================

-- 2a. Authenticated users can INSERT their own proofs
--     Path must start with their own user ID folder: <uid>/<timestamp>.<ext>
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Users can upload own payment proofs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can upload own payment proofs"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'payment-proofs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    $policy$;
  END IF;
END $$;

-- 2b. Anyone can read objects from this public bucket
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Public read payment proofs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Public read payment proofs"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'payment-proofs');
    $policy$;
  END IF;
END $$;

-- 2c. Authenticated users can DELETE their own proofs (optional)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND policyname = 'Users can delete own payment proofs'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Users can delete own payment proofs"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'payment-proofs'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
    $policy$;
  END IF;
END $$;

-- ============================================================
-- 3. Make sure the proof_url column exists in manual_payments
-- ============================================================
ALTER TABLE manual_payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT;
