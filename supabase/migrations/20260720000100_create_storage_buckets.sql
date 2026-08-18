-- Create the candidate-documents storage bucket.
--
-- Root cause of broken uploads in production: every earlier migration only
-- created storage POLICIES on storage.objects, never the bucket itself, so
-- persistIntakeBatch's uploads failed with "Bucket not found". Verified
-- against the live project on 2026-07-20 (GET /storage/v1/bucket/candidate-documents → 404).
--
-- Idempotent: safe to run on projects where the bucket already exists.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-documents',
  'candidate-documents',
  false, -- private: access only via signed URLs + storage RLS policies
  26214400, -- 25 MB per file, matches MAX_FILE_BYTES in src/lib/docintel/types.ts
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/heic',
    'image/tiff',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/rtf'
  ]
)
ON CONFLICT (id) DO NOTHING;
