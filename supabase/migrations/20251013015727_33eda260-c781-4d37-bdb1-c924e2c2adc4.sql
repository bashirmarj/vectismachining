-- Create table for surface-based treatments (heat treatment, post-processing, surface treatments)
CREATE TABLE public.surface_treatments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('heat_treatment', 'post_process', 'surface_treatment')),
  cost_per_cm2 NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.surface_treatments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view active surface treatments"
ON public.surface_treatments
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage surface treatments"
ON public.surface_treatments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_surface_treatments_updated_at
BEFORE UPDATE ON public.surface_treatments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default surface treatments
INSERT INTO public.surface_treatments (name, category, cost_per_cm2, description) VALUES
('Heat Treatment - Stress Relief', 'heat_treatment', 0.05, 'Reduces internal stresses in metal parts'),
('Heat Treatment - Hardening', 'heat_treatment', 0.08, 'Increases hardness and wear resistance'),
('Heat Treatment - Annealing', 'heat_treatment', 0.06, 'Softens metal for easier machining'),
('Deburring', 'post_process', 0.03, 'Removes sharp edges and burrs'),
('Vibratory Finishing', 'post_process', 0.04, 'Smooths surfaces using vibratory motion'),
('Anodizing Type II', 'surface_treatment', 0.10, 'Decorative and corrosion-resistant coating'),
('Anodizing Type III (Hard Coat)', 'surface_treatment', 0.15, 'Heavy-duty wear-resistant coating'),
('Powder Coating', 'surface_treatment', 0.12, 'Durable painted finish'),
('Chromate Conversion', 'surface_treatment', 0.07, 'Corrosion protection for aluminum'),
('Electropolishing', 'surface_treatment', 0.09, 'Creates ultra-smooth, clean surface');