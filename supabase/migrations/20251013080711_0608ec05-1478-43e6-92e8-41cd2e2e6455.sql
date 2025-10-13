-- Create table for storing CAD mesh data (tessellated geometry)
CREATE TABLE public.cad_meshes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid REFERENCES public.quotation_submissions(id) ON DELETE CASCADE,
  line_item_id uuid REFERENCES public.quote_line_items(id) ON DELETE CASCADE,
  file_hash text NOT NULL,
  file_name text NOT NULL,
  vertices float8[] NOT NULL,
  indices int4[] NOT NULL,
  normals float8[] NOT NULL,
  triangle_count integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(file_hash)
);

-- Create indexes for performance
CREATE INDEX idx_cad_meshes_file_hash ON public.cad_meshes(file_hash);
CREATE INDEX idx_cad_meshes_line_item ON public.cad_meshes(line_item_id);
CREATE INDEX idx_cad_meshes_quotation ON public.cad_meshes(quotation_id);

-- Enable RLS
ALTER TABLE public.cad_meshes ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Admins can manage all meshes
CREATE POLICY "Admins can view all meshes"
  ON public.cad_meshes FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert meshes"
  ON public.cad_meshes FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update meshes"
  ON public.cad_meshes FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete meshes"
  ON public.cad_meshes FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));