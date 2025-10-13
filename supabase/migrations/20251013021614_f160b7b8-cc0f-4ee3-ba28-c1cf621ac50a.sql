-- Update surface treatment prices to Canadian industry standards (2024-2025)

-- Heat Treatment Category
UPDATE surface_treatments 
SET cost_per_cm2 = 0.08, updated_at = NOW()
WHERE name = 'Stress Relief';

UPDATE surface_treatments 
SET cost_per_cm2 = 0.10, updated_at = NOW()
WHERE name = 'Annealing';

UPDATE surface_treatments 
SET cost_per_cm2 = 0.12, updated_at = NOW()
WHERE name = 'Hardening';

-- Post Process Category
UPDATE surface_treatments 
SET cost_per_cm2 = 0.04, updated_at = NOW()
WHERE name = 'Deburring';

UPDATE surface_treatments 
SET cost_per_cm2 = 0.06, updated_at = NOW()
WHERE name = 'Vibratory Finishing';

-- Surface Treatment Category
UPDATE surface_treatments 
SET cost_per_cm2 = 0.09, updated_at = NOW()
WHERE name = 'Chromate Conversion';

UPDATE surface_treatments 
SET cost_per_cm2 = 0.18, updated_at = NOW()
WHERE name = 'Anodizing Type II';

UPDATE surface_treatments 
SET cost_per_cm2 = 0.20, updated_at = NOW()
WHERE name = 'Electropolishing';

UPDATE surface_treatments 
SET cost_per_cm2 = 0.22, updated_at = NOW()
WHERE name = 'Powder Coating';

UPDATE surface_treatments 
SET cost_per_cm2 = 0.32, updated_at = NOW()
WHERE name = 'Anodizing Type III (Hard Coat)';