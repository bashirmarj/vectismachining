-- Add price_per_lb column to material_costs table for weight-based pricing
ALTER TABLE public.material_costs 
ADD COLUMN IF NOT EXISTS price_per_lb NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.material_costs.price_per_lb IS 'Base price per pound for weight-based pricing (used with linear_inch pricing method)';