-- Create a public storage bucket for email assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('email-assets', 'email-assets', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public access for email assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload email assets" ON storage.objects;

-- Create storage policy to allow public read access
CREATE POLICY "Public access for email assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');

-- Create storage policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload email assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'email-assets' AND auth.role() = 'authenticated');