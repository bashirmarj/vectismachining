-- Add pricing method and cross sections to material_costs table
ALTER TABLE material_costs 
ADD COLUMN IF NOT EXISTS pricing_method text DEFAULT 'weight' CHECK (pricing_method IN ('weight', 'linear_inch'));

ALTER TABLE material_costs 
ADD COLUMN IF NOT EXISTS cross_sections jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN material_costs.pricing_method IS 'Pricing calculation method: weight (volume-based) or linear_inch (cross-section based)';
COMMENT ON COLUMN material_costs.cross_sections IS 'Array of cross-section profiles with width, thickness, and cost_per_inch for linear pricing';