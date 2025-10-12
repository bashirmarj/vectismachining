-- Add sheet_configurations column to material_costs
ALTER TABLE material_costs 
ADD COLUMN IF NOT EXISTS sheet_configurations JSONB DEFAULT '[]'::jsonb;

-- Add default_nesting_efficiency column to material_costs
ALTER TABLE material_costs 
ADD COLUMN IF NOT EXISTS default_nesting_efficiency NUMERIC DEFAULT 0.75;

-- Add part dimensions to quote_line_items
ALTER TABLE quote_line_items
ADD COLUMN IF NOT EXISTS part_width_cm NUMERIC,
ADD COLUMN IF NOT EXISTS part_height_cm NUMERIC,
ADD COLUMN IF NOT EXISTS part_depth_cm NUMERIC;