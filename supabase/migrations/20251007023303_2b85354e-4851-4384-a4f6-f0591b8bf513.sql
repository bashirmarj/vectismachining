-- Create storage bucket for part files
INSERT INTO storage.buckets (id, name, public)
VALUES ('part-files', 'part-files', false);

-- Allow authenticated users to upload their own files
CREATE POLICY "Users can upload their own part files"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'part-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view their own files
CREATE POLICY "Users can view their own part files"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'part-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);