-- Phase 1: Add material-specific machining parameter columns to material_costs
ALTER TABLE material_costs
ADD COLUMN IF NOT EXISTS spindle_speed_rpm_min INTEGER,
ADD COLUMN IF NOT EXISTS spindle_speed_rpm_max INTEGER,
ADD COLUMN IF NOT EXISTS feed_rate_mm_per_min_min INTEGER,
ADD COLUMN IF NOT EXISTS feed_rate_mm_per_min_max INTEGER,
ADD COLUMN IF NOT EXISTS depth_of_cut_mm_min NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS depth_of_cut_mm_max NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS cutting_speed_m_per_min_min INTEGER,
ADD COLUMN IF NOT EXISTS cutting_speed_m_per_min_max INTEGER,
ADD COLUMN IF NOT EXISTS tool_life_factor NUMERIC(10,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS chip_load_per_tooth NUMERIC(10,3),
ADD COLUMN IF NOT EXISTS recommended_coolant TEXT,
ADD COLUMN IF NOT EXISTS work_hardening_factor NUMERIC(10,2) DEFAULT 1.0;

-- Phase 2: Clean up and update existing materials with correct industry data

-- Aluminum 6061 (most common)
UPDATE material_costs 
SET 
  hardness_brinell = 95,
  density = 2.70,
  machinability_rating = 1.0,
  cutting_speed_m_per_min = 300,
  spindle_speed_rpm_min = 5000,
  spindle_speed_rpm_max = 8000,
  feed_rate_mm_per_min_min = 800,
  feed_rate_mm_per_min_max = 1200,
  depth_of_cut_mm_min = 3.0,
  depth_of_cut_mm_max = 5.0,
  cutting_speed_m_per_min_min = 200,
  cutting_speed_m_per_min_max = 400,
  tool_life_factor = 1.0,
  chip_load_per_tooth = 0.15,
  recommended_coolant = 'Flood coolant or air blast',
  work_hardening_factor = 1.0
WHERE material_name = 'Aluminum 6061';

-- Brass C360 (free machining)
UPDATE material_costs 
SET 
  hardness_brinell = 100,
  density = 8.50,
  machinability_rating = 0.9,
  cutting_speed_m_per_min = 225,
  spindle_speed_rpm_min = 4000,
  spindle_speed_rpm_max = 7000,
  feed_rate_mm_per_min_min = 700,
  feed_rate_mm_per_min_max = 1000,
  depth_of_cut_mm_min = 3.0,
  depth_of_cut_mm_max = 4.0,
  cutting_speed_m_per_min_min = 150,
  cutting_speed_m_per_min_max = 300,
  tool_life_factor = 0.95,
  chip_load_per_tooth = 0.12,
  recommended_coolant = 'Dry or light mist',
  work_hardening_factor = 1.0
WHERE material_name = 'Brass C360';

-- Copper ETP C110
UPDATE material_costs 
SET 
  hardness_brinell = 85,
  density = 8.94,
  machinability_rating = 1.0,
  cutting_speed_m_per_min = 185,
  spindle_speed_rpm_min = 3500,
  spindle_speed_rpm_max = 6000,
  feed_rate_mm_per_min_min = 600,
  feed_rate_mm_per_min_max = 900,
  depth_of_cut_mm_min = 2.5,
  depth_of_cut_mm_max = 4.0,
  cutting_speed_m_per_min_min = 120,
  cutting_speed_m_per_min_max = 250,
  tool_life_factor = 0.9,
  chip_load_per_tooth = 0.10,
  recommended_coolant = 'Light mist or dry',
  work_hardening_factor = 1.1
WHERE material_name = 'Copper ETP C110';

-- Mild Steel 1018
UPDATE material_costs 
SET 
  hardness_brinell = 126,
  density = 7.87,
  machinability_rating = 0.65,
  cutting_speed_m_per_min = 115,
  spindle_speed_rpm_min = 2000,
  spindle_speed_rpm_max = 4000,
  feed_rate_mm_per_min_min = 400,
  feed_rate_mm_per_min_max = 700,
  depth_of_cut_mm_min = 2.0,
  depth_of_cut_mm_max = 3.0,
  cutting_speed_m_per_min_min = 80,
  cutting_speed_m_per_min_max = 150,
  tool_life_factor = 0.75,
  chip_load_per_tooth = 0.08,
  recommended_coolant = 'Flood coolant',
  work_hardening_factor = 1.0
WHERE material_name = 'Mild Steel 1018';

-- Steel 1045 (medium carbon)
UPDATE material_costs 
SET 
  hardness_brinell = 163,
  density = 7.85,
  machinability_rating = 0.65,
  cutting_speed_m_per_min = 100,
  spindle_speed_rpm_min = 1800,
  spindle_speed_rpm_max = 3500,
  feed_rate_mm_per_min_min = 350,
  feed_rate_mm_per_min_max = 600,
  depth_of_cut_mm_min = 1.5,
  depth_of_cut_mm_max = 2.5,
  cutting_speed_m_per_min_min = 70,
  cutting_speed_m_per_min_max = 130,
  tool_life_factor = 0.7,
  chip_load_per_tooth = 0.07,
  recommended_coolant = 'Flood coolant',
  work_hardening_factor = 1.0
WHERE material_name = 'Steel 1045';

-- CRS - Cold Rolled Strip
UPDATE material_costs 
SET 
  hardness_brinell = 120,
  density = 7.85,
  machinability_rating = 1.0,
  cutting_speed_m_per_min = 107,
  spindle_speed_rpm_min = 2000,
  spindle_speed_rpm_max = 3800,
  feed_rate_mm_per_min_min = 380,
  feed_rate_mm_per_min_max = 650,
  depth_of_cut_mm_min = 2.0,
  depth_of_cut_mm_max = 3.0,
  cutting_speed_m_per_min_min = 75,
  cutting_speed_m_per_min_max = 140,
  tool_life_factor = 0.8,
  chip_load_per_tooth = 0.08,
  recommended_coolant = 'Flood coolant',
  work_hardening_factor = 1.0
WHERE material_name = 'CRS - Cold Rolled Strip';

-- Stainless Steel 316 (work hardening)
UPDATE material_costs 
SET 
  hardness_brinell = 217,
  density = 8.00,
  machinability_rating = 0.55,
  cutting_speed_m_per_min = 60,
  spindle_speed_rpm_min = 1200,
  spindle_speed_rpm_max = 2500,
  feed_rate_mm_per_min_min = 250,
  feed_rate_mm_per_min_max = 450,
  depth_of_cut_mm_min = 1.0,
  depth_of_cut_mm_max = 2.0,
  cutting_speed_m_per_min_min = 40,
  cutting_speed_m_per_min_max = 80,
  tool_life_factor = 0.6,
  chip_load_per_tooth = 0.06,
  recommended_coolant = 'Heavy flood coolant',
  work_hardening_factor = 1.4
WHERE material_name = 'Stainless Steel 316';

-- D2 Tool Steel (fix machinability rating)
UPDATE material_costs 
SET 
  hardness_brinell = 220,
  density = 7.70,
  machinability_rating = 0.4,
  cutting_speed_m_per_min = 37,
  spindle_speed_rpm_min = 800,
  spindle_speed_rpm_max = 1600,
  feed_rate_mm_per_min_min = 150,
  feed_rate_mm_per_min_max = 300,
  depth_of_cut_mm_min = 0.5,
  depth_of_cut_mm_max = 1.5,
  cutting_speed_m_per_min_min = 25,
  cutting_speed_m_per_min_max = 50,
  tool_life_factor = 0.5,
  chip_load_per_tooth = 0.04,
  recommended_coolant = 'Heavy flood coolant with EP additives',
  work_hardening_factor = 1.0
WHERE material_name = 'D2 Tool Steel';

-- Titanium Grade 5 (Ti-6Al-4V)
UPDATE material_costs 
SET 
  hardness_brinell = 334,
  density = 4.43,
  machinability_rating = 0.5,
  cutting_speed_m_per_min = 45,
  spindle_speed_rpm_min = 900,
  spindle_speed_rpm_max = 1900,
  feed_rate_mm_per_min_min = 200,
  feed_rate_mm_per_min_max = 400,
  depth_of_cut_mm_min = 0.5,
  depth_of_cut_mm_max = 1.5,
  cutting_speed_m_per_min_min = 30,
  cutting_speed_m_per_min_max = 60,
  tool_life_factor = 0.45,
  chip_load_per_tooth = 0.05,
  recommended_coolant = 'High-pressure flood coolant',
  work_hardening_factor = 1.3
WHERE material_name = 'Titanium Grade 5';

-- Fix or remove "New Material 2" - mark as inactive
UPDATE material_costs 
SET is_active = false
WHERE material_name = 'New Material 2';

-- CRS 1080 - Update to high carbon cold rolled steel
UPDATE material_costs 
SET 
  material_name = 'CRS 1080 (High Carbon)',
  hardness_brinell = 200,
  density = 7.85,
  machinability_rating = 0.55,
  cutting_speed_m_per_min = 85,
  spindle_speed_rpm_min = 1500,
  spindle_speed_rpm_max = 3000,
  feed_rate_mm_per_min_min = 300,
  feed_rate_mm_per_min_max = 550,
  depth_of_cut_mm_min = 1.5,
  depth_of_cut_mm_max = 2.5,
  cutting_speed_m_per_min_min = 60,
  cutting_speed_m_per_min_max = 110,
  tool_life_factor = 0.65,
  chip_load_per_tooth = 0.06,
  recommended_coolant = 'Flood coolant',
  work_hardening_factor = 1.0
WHERE material_name = 'CRS 1080';

-- Phase 3: Add high-priority new materials

-- Aluminum 7075-T6 (Aircraft grade)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density, 
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  'Aluminum 7075-T6', 0.15, 0.08, 2.81,
  0.7, 150, 265,
  4500, 7500,
  700, 1100,
  2.5, 4.0,
  180, 350,
  0.85, 0.12, 'Flood coolant or air blast',
  1.0, true, 'weight'
);

-- Aluminum 2024-T3 (Aircraft structures)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  'Aluminum 2024-T3', 0.12, 0.07, 2.78,
  0.8, 120, 290,
  5000, 8000,
  750, 1150,
  2.5, 4.5,
  200, 380,
  0.9, 0.13, 'Flood coolant or air blast',
  1.0, true, 'weight'
);

-- 303 Stainless Steel (Free machining)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  '303 Stainless Steel', 0.18, 0.10, 8.03,
  0.78, 170, 85,
  1800, 3500,
  350, 600,
  1.5, 2.5,
  60, 110,
  0.75, 0.07, 'Flood coolant',
  1.1, true, 'weight'
);

-- 304 Stainless Steel (General purpose)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  '304 Stainless Steel', 0.16, 0.09, 8.00,
  0.45, 190, 70,
  1400, 2800,
  280, 500,
  1.0, 2.0,
  50, 90,
  0.65, 0.06, 'Heavy flood coolant',
  1.3, true, 'weight'
);

-- 4140 Steel (Alloy steel - pre-hardened)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  '4140 Steel', 0.14, 0.08, 7.85,
  0.65, 250, 90,
  1700, 3300,
  320, 580,
  1.2, 2.2,
  60, 120,
  0.7, 0.06, 'Flood coolant',
  1.0, true, 'weight'
);

-- A36 Steel (Structural/mild steel)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  'A36 Steel', 0.10, 0.06, 7.85,
  0.72, 120, 115,
  2200, 4200,
  420, 720,
  2.0, 3.0,
  80, 150,
  0.78, 0.08, 'Flood coolant',
  1.0, true, 'weight'
);

-- O1 Tool Steel (Oil hardening)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  'O1 Tool Steel', 0.20, 0.11, 7.85,
  0.50, 200, 55,
  1100, 2200,
  220, 420,
  0.8, 1.8,
  40, 70,
  0.55, 0.05, 'Heavy flood coolant with EP additives',
  1.0, true, 'weight'
);

-- Delrin (Acetal - Engineering plastic)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  'Delrin (Acetal)', 0.08, 0.05, 1.42,
  1.2, 80, 450,
  8000, 12000,
  1200, 1800,
  4.0, 6.0,
  300, 600,
  1.1, 0.20, 'Air blast or dry',
  1.0, true, 'weight'
);

-- Nylon 6/6 (Wear-resistant plastic)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  'Nylon 6/6', 0.07, 0.04, 1.14,
  1.1, 75, 375,
  7000, 11000,
  1000, 1600,
  3.5, 5.5,
  250, 500,
  1.05, 0.18, 'Air blast or dry',
  1.0, true, 'weight'
);

-- PEEK (High-performance plastic)
INSERT INTO material_costs (
  material_name, cost_per_cubic_cm, cost_per_square_cm, density,
  machinability_rating, hardness_brinell, cutting_speed_m_per_min,
  spindle_speed_rpm_min, spindle_speed_rpm_max,
  feed_rate_mm_per_min_min, feed_rate_mm_per_min_max,
  depth_of_cut_mm_min, depth_of_cut_mm_max,
  cutting_speed_m_per_min_min, cutting_speed_m_per_min_max,
  tool_life_factor, chip_load_per_tooth, recommended_coolant,
  work_hardening_factor, is_active, pricing_method
) VALUES (
  'PEEK', 0.25, 0.15, 1.32,
  0.9, 100, 300,
  6000, 10000,
  900, 1500,
  3.0, 5.0,
  200, 400,
  0.95, 0.16, 'Air blast or dry',
  1.0, true, 'weight'
);