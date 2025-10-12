-- Create enum for manufacturing processes (if needed for future expansion)
-- For MVP, we'll keep it simple with TEXT fields

-- 1. Manufacturing Processes Table
CREATE TABLE IF NOT EXISTS public.manufacturing_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  base_rate_per_hour NUMERIC NOT NULL,
  setup_cost NUMERIC NOT NULL,
  complexity_multiplier NUMERIC DEFAULT 1.0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert the three core processes
INSERT INTO public.manufacturing_processes (name, base_rate_per_hour, setup_cost, complexity_multiplier) VALUES
('CNC Machining', 75.00, 150.00, 1.0),
('Wire EDM', 95.00, 200.00, 1.2),
('Heat Treatment', 50.00, 100.00, 0.8)
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.manufacturing_processes ENABLE ROW LEVEL SECURITY;

-- Policies for manufacturing_processes
CREATE POLICY "Anyone can view active manufacturing processes"
  ON public.manufacturing_processes FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage manufacturing processes"
  ON public.manufacturing_processes FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Material Costs Table
CREATE TABLE IF NOT EXISTS public.material_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name TEXT NOT NULL UNIQUE,
  cost_per_cubic_cm NUMERIC NOT NULL,
  cost_per_square_cm NUMERIC NOT NULL,
  density NUMERIC,
  finish_options JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common materials
INSERT INTO public.material_costs (material_name, cost_per_cubic_cm, cost_per_square_cm, density, finish_options) VALUES
('Aluminum 6061', 0.15, 0.02, 2.7, '["As-machined", "Anodized Type II", "Anodized Type III", "Powder Coated", "Bead Blasted"]'::jsonb),
('Stainless Steel 316', 0.35, 0.04, 8.0, '["As-machined", "Passivated", "Electropolished", "Bead Blasted"]'::jsonb),
('Mild Steel 1018', 0.12, 0.015, 7.87, '["As-machined", "Zinc Plated", "Black Oxide", "Powder Coated"]'::jsonb),
('Brass C360', 0.25, 0.03, 8.5, '["As-machined", "Polished", "Chrome Plated"]'::jsonb),
('Titanium Grade 5', 1.50, 0.15, 4.43, '["As-machined", "Anodized", "Bead Blasted"]'::jsonb)
ON CONFLICT (material_name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.material_costs ENABLE ROW LEVEL SECURITY;

-- Policies for material_costs
CREATE POLICY "Anyone can view active material costs"
  ON public.material_costs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage material costs"
  ON public.material_costs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Update quote_line_items Table with new columns
ALTER TABLE public.quote_line_items
  ADD COLUMN IF NOT EXISTS estimated_volume_cm3 NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_surface_area_cm2 NUMERIC,
  ADD COLUMN IF NOT EXISTS estimated_complexity_score INTEGER,
  ADD COLUMN IF NOT EXISTS material_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machining_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS finish_cost NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selected_process TEXT,
  ADD COLUMN IF NOT EXISTS material_type TEXT,
  ADD COLUMN IF NOT EXISTS finish_type TEXT,
  ADD COLUMN IF NOT EXISTS estimated_machine_time_hours NUMERIC,
  ADD COLUMN IF NOT EXISTS preliminary_unit_price NUMERIC;