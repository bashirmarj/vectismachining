-- Add vertex_colors column to cad_meshes table
ALTER TABLE public.cad_meshes 
ADD COLUMN vertex_colors text[] DEFAULT '{}'::text[];

-- Add comment to explain the column
COMMENT ON COLUMN public.cad_meshes.vertex_colors IS 'One face type classification per unique vertex: internal, cylindrical, planar, or external';