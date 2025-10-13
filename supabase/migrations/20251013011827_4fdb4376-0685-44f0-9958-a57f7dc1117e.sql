-- Phase 1: Extend manufacturing_processes table with machining parameters
ALTER TABLE manufacturing_processes
ADD COLUMN IF NOT EXISTS feed_rate_mm_per_min NUMERIC DEFAULT 500,
ADD COLUMN IF NOT EXISTS spindle_speed_rpm NUMERIC DEFAULT 3000,
ADD COLUMN IF NOT EXISTS depth_of_cut_mm NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS tool_change_time_minutes NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS rapid_feed_rate_mm_per_min NUMERIC DEFAULT 5000;

-- Phase 1: Extend material_costs table with material machinability properties
ALTER TABLE material_costs
ADD COLUMN IF NOT EXISTS machinability_rating NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS hardness_brinell NUMERIC,
ADD COLUMN IF NOT EXISTS cutting_speed_m_per_min NUMERIC DEFAULT 100;

-- Phase 4: Set default machinability ratings for common materials
UPDATE material_costs
SET machinability_rating = CASE
  WHEN material_name ILIKE '%aluminum%' OR material_name ILIKE '%6061%' THEN 1.0
  WHEN material_name ILIKE '%brass%' THEN 0.9
  WHEN material_name ILIKE '%1045%' OR material_name ILIKE '%mild steel%' THEN 0.65
  WHEN material_name ILIKE '%stainless%' OR material_name ILIKE '%304%' THEN 0.55
  WHEN material_name ILIKE '%tool steel%' OR material_name ILIKE '%titanium%' THEN 0.5
  WHEN material_name ILIKE '%hardened%' OR material_name ILIKE '%inconel%' THEN 0.3
  ELSE 1.0
END
WHERE machinability_rating IS NULL OR machinability_rating = 1.0;

COMMENT ON COLUMN manufacturing_processes.feed_rate_mm_per_min IS 'Feed rate in millimeters per minute for machining operations';
COMMENT ON COLUMN manufacturing_processes.spindle_speed_rpm IS 'Spindle speed in revolutions per minute';
COMMENT ON COLUMN manufacturing_processes.depth_of_cut_mm IS 'Depth of cut in millimeters for typical operations';
COMMENT ON COLUMN manufacturing_processes.tool_change_time_minutes IS 'Average time in minutes for a tool change';
COMMENT ON COLUMN manufacturing_processes.rapid_feed_rate_mm_per_min IS 'Rapid positioning feed rate in mm/min';

COMMENT ON COLUMN material_costs.machinability_rating IS 'Material machinability rating: 1.0 = easy (aluminum), 0.7 = medium (steel), 0.5 = hard (tool steel), 0.3 = very hard (hardened steel)';
COMMENT ON COLUMN material_costs.hardness_brinell IS 'Material hardness in Brinell scale';
COMMENT ON COLUMN material_costs.cutting_speed_m_per_min IS 'Recommended cutting speed in meters per minute';