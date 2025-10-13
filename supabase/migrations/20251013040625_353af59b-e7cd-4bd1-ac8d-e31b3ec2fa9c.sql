-- Fix 1: Correct 1045 Carbon Steel density from 1.0 to proper steel density
UPDATE material_costs 
SET density = 7.85 
WHERE material_name = '1045 Carbon Steel';

-- Fix 2: Add cross-sections to 4140 Steel for consistency with linear_inch pricing
UPDATE material_costs
SET 
  cross_sections = '[
    {"width": 4, "thickness": 0.5, "cost_per_inch": 4.75, "shape": "rectangular"},
    {"width": 3, "thickness": 0.5, "cost_per_inch": 3.56, "shape": "rectangular"},
    {"width": 2, "thickness": 0.5, "cost_per_inch": 2.38, "shape": "rectangular"},
    {"width": 1, "thickness": 0.5, "cost_per_inch": 1.19, "shape": "rectangular"},
    {"width": 2, "thickness": 2, "cost_per_inch": 9.50, "shape": "rectangular"}
  ]'::jsonb,
  pricing_method = 'linear_inch'
WHERE material_name = '4140 Steel';

-- Fix 3: Ensure material-process parameters exist for 4140 Steel + CNC Lathe
INSERT INTO material_process_parameters (
  material_id, 
  process_id, 
  spindle_speed_rpm,
  feed_rate_mm_per_min,
  depth_of_cut_mm,
  cutting_speed_m_per_min,
  material_removal_rate_adjustment,
  tool_wear_multiplier,
  setup_time_multiplier,
  surface_finish_factor,
  cycle_time_multiplier
)
SELECT 
  mc.id as material_id,
  mp.id as process_id,
  1200 as spindle_speed_rpm,
  300 as feed_rate_mm_per_min,
  1.5 as depth_of_cut_mm,
  80 as cutting_speed_m_per_min,
  1.0 as material_removal_rate_adjustment,
  1.0 as tool_wear_multiplier,
  1.1 as setup_time_multiplier,
  1.0 as surface_finish_factor,
  0.95 as cycle_time_multiplier
FROM material_costs mc
CROSS JOIN manufacturing_processes mp
WHERE mc.material_name = '4140 Steel'
  AND mp.name = 'CNC Lathe'
  AND NOT EXISTS (
    SELECT 1 FROM material_process_parameters mpp
    WHERE mpp.material_id = mc.id AND mpp.process_id = mp.id
  );