-- Add industrial routing columns to quote_line_items table
ALTER TABLE quote_line_items 
ADD COLUMN IF NOT EXISTS recommended_routings text[],
ADD COLUMN IF NOT EXISTS routing_reasoning text[],
ADD COLUMN IF NOT EXISTS machining_operations jsonb,
ADD COLUMN IF NOT EXISTS estimated_machining_cost numeric;