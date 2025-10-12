-- Create material categories table
CREATE TABLE IF NOT EXISTS public.material_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add category_id to material_costs
ALTER TABLE public.material_costs 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.material_categories(id) ON DELETE SET NULL;

-- Enable RLS on material_categories
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for material_categories
CREATE POLICY "Anyone can view material categories"
ON public.material_categories
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage material categories"
ON public.material_categories
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default material categories
INSERT INTO public.material_categories (name, description, display_order) VALUES
  ('Steel', 'Carbon steel and low-alloy steel materials', 1),
  ('Tool Steel', 'High-carbon steel for tooling applications', 2),
  ('Aluminum', 'Aluminum and aluminum alloy materials', 3),
  ('Copper', 'Pure copper materials', 4),
  ('Brass', 'Copper-zinc alloy materials', 5),
  ('Titanium', 'Titanium and titanium alloy materials', 6),
  ('Stainless Steel', 'Corrosion-resistant steel alloys', 7),
  ('Other Metals', 'Other metallic materials', 99)
ON CONFLICT (name) DO NOTHING;