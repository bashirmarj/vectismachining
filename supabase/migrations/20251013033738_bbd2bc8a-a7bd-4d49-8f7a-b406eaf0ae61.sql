-- Update material prices with Canadian market pricing (CAD per pound)
-- Aluminum Alloys
UPDATE material_costs SET price_per_lb = 4.50 WHERE material_name = 'Aluminum 6061';
UPDATE material_costs SET price_per_lb = 6.25 WHERE material_name = 'Aluminum 2024-T3';
UPDATE material_costs SET price_per_lb = 8.50 WHERE material_name = 'Aluminum 7075-T6';

-- Steel Alloys
UPDATE material_costs SET price_per_lb = 2.50 WHERE material_name = 'Mild Steel 1018';
UPDATE material_costs SET price_per_lb = 2.25 WHERE material_name = 'A36 Steel';
UPDATE material_costs SET price_per_lb = 4.75 WHERE material_name = '4140 Steel';
UPDATE material_costs SET price_per_lb = 3.50 WHERE material_name = '1045';
UPDATE material_costs SET price_per_lb = 5.25 WHERE material_name = 'CRS 1080 (High Carbon)';
UPDATE material_costs SET price_per_lb = 3.25 WHERE material_name = 'CRS - Cold Rolled Strip';

-- Stainless Steel
UPDATE material_costs SET price_per_lb = 6.50 WHERE material_name = '304 Stainless Steel';
UPDATE material_costs SET price_per_lb = 8.75 WHERE material_name = '316 Stainless Steel';
UPDATE material_costs SET price_per_lb = 7.25 WHERE material_name = '303 Stainless Steel';

-- Tool Steels
UPDATE material_costs SET price_per_lb = 9.50 WHERE material_name = 'O1 Tool Steel';
UPDATE material_costs SET price_per_lb = 12.00 WHERE material_name = 'D2';

-- Non-Ferrous Metals
UPDATE material_costs SET price_per_lb = 7.50 WHERE material_name = 'Brass C360';
UPDATE material_costs SET price_per_lb = 9.25 WHERE material_name = 'Copper ETP C110';
UPDATE material_costs SET price_per_lb = 28.00 WHERE material_name = 'Titanium Grade 5';

-- Engineering Plastics
UPDATE material_costs SET price_per_lb = 8.50 WHERE material_name = 'Delrin (Acetal)';
UPDATE material_costs SET price_per_lb = 6.75 WHERE material_name = 'Nylon 6/6';
UPDATE material_costs SET price_per_lb = 85.00 WHERE material_name = 'PEEK';