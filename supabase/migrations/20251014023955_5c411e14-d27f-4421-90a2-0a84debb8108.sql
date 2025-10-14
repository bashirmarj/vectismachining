-- Add face_types column to cad_meshes table for Meviy-style face classification
ALTER TABLE public.cad_meshes 
ADD COLUMN IF NOT EXISTS face_types text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN public.cad_meshes.face_types IS 'Face type classification for each vertex (external, internal, cylindrical, planar) for Meviy-style color-coded rendering';