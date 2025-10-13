-- Create material_process_parameters junction table
CREATE TABLE IF NOT EXISTS public.material_process_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID REFERENCES public.material_costs(id) ON DELETE CASCADE NOT NULL,
  process_id UUID REFERENCES public.manufacturing_processes(id) ON DELETE CASCADE NOT NULL,
  
  -- Material-specific parameters for this process
  spindle_speed_rpm INTEGER,
  feed_rate_mm_per_min INTEGER,
  depth_of_cut_mm NUMERIC(10,2),
  cutting_speed_m_per_min INTEGER,
  
  -- Process-specific adjustments
  material_removal_rate_adjustment NUMERIC(10,2) DEFAULT 1.0,
  tool_wear_multiplier NUMERIC(10,2) DEFAULT 1.0,
  surface_finish_factor NUMERIC(10,2) DEFAULT 1.0,
  
  -- Time factors
  setup_time_multiplier NUMERIC(10,2) DEFAULT 1.0,
  cycle_time_multiplier NUMERIC(10,2) DEFAULT 1.0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one parameter set per material-process combination
  UNIQUE(material_id, process_id)
);

-- Enable RLS
ALTER TABLE public.material_process_parameters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view material process parameters"
ON public.material_process_parameters
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage material process parameters"
ON public.material_process_parameters
FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_material_process_parameters_updated_at
BEFORE UPDATE ON public.material_process_parameters
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert industry-standard parameters for VMC Machining process
-- First, get the VMC Machining process ID
DO $$
DECLARE
  vmc_process_id UUID;
  lathe_process_id UUID;
  edm_process_id UUID;
BEGIN
  -- Get process IDs
  SELECT id INTO vmc_process_id FROM public.manufacturing_processes WHERE name = 'VMC Machining' LIMIT 1;
  SELECT id INTO lathe_process_id FROM public.manufacturing_processes WHERE name = 'CNC Lathe' LIMIT 1;
  SELECT id INTO edm_process_id FROM public.manufacturing_processes WHERE name = 'Wire EDM' LIMIT 1;

  -- VMC Machining parameters for all materials
  
  -- Aluminum 6061
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 7000, 1000, 4.0, 250, 1.2, 0.8, 1.0
  FROM public.material_costs WHERE material_name = 'Aluminum 6061' AND is_active = true LIMIT 1;

  -- Aluminum 7075-T6
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 6000, 900, 3.0, 220, 1.0, 0.9, 1.0
  FROM public.material_costs WHERE material_name = 'Aluminum 7075-T6' AND is_active = true LIMIT 1;

  -- Aluminum 2024-T3
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 6500, 950, 3.5, 240, 1.1, 0.85, 1.0
  FROM public.material_costs WHERE material_name = 'Aluminum 2024-T3' AND is_active = true LIMIT 1;

  -- Steel 1018 (Mild Steel)
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 3000, 550, 2.5, 110, 0.7, 1.2, 1.1
  FROM public.material_costs WHERE material_name = 'Mild Steel 1018' AND is_active = true LIMIT 1;

  -- Steel 1045
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 2500, 475, 2.0, 90, 0.65, 1.3, 1.15
  FROM public.material_costs WHERE material_name = 'Steel 1045' AND is_active = true LIMIT 1;

  -- 4140 Steel
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 2200, 425, 1.8, 85, 0.6, 1.4, 1.2
  FROM public.material_costs WHERE material_name = '4140 Steel' AND is_active = true LIMIT 1;

  -- A36 Steel
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 2800, 525, 2.3, 105, 0.72, 1.15, 1.08
  FROM public.material_costs WHERE material_name = 'A36 Steel' AND is_active = true LIMIT 1;

  -- CRS (Cold Rolled Steel)
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 2900, 540, 2.4, 108, 0.7, 1.18, 1.09
  FROM public.material_costs WHERE material_name = 'CRS - Cold Rolled Strip' AND is_active = true LIMIT 1;

  -- 303 Stainless Steel
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 2200, 450, 1.8, 80, 0.78, 1.1, 1.05
  FROM public.material_costs WHERE material_name = '303 Stainless Steel' AND is_active = true LIMIT 1;

  -- 304 Stainless Steel
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 2000, 400, 1.5, 70, 0.5, 1.5, 1.2
  FROM public.material_costs WHERE material_name = '304 Stainless Steel' AND is_active = true LIMIT 1;

  -- Stainless Steel 316
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 1800, 350, 1.5, 65, 0.55, 1.6, 1.25
  FROM public.material_costs WHERE material_name = 'Stainless Steel 316' AND is_active = true LIMIT 1;

  -- D2 Tool Steel
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 1200, 225, 1.0, 45, 0.4, 2.5, 1.4
  FROM public.material_costs WHERE material_name = 'D2 Tool Steel' AND is_active = true LIMIT 1;

  -- O1 Tool Steel
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 1400, 270, 1.2, 55, 0.5, 2.0, 1.3
  FROM public.material_costs WHERE material_name = 'O1 Tool Steel' AND is_active = true LIMIT 1;

  -- Titanium Grade 5
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 1400, 300, 1.0, 50, 0.45, 2.2, 1.5
  FROM public.material_costs WHERE material_name = 'Titanium Grade 5' AND is_active = true LIMIT 1;

  -- Brass C360
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 5500, 850, 3.5, 200, 1.1, 0.75, 0.95
  FROM public.material_costs WHERE material_name = 'Brass C360' AND is_active = true LIMIT 1;

  -- Copper ETP C110
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 4500, 750, 3.0, 180, 1.0, 0.85, 1.0
  FROM public.material_costs WHERE material_name = 'Copper ETP C110' AND is_active = true LIMIT 1;

  -- Delrin (Acetal)
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 10000, 1500, 5.0, 400, 1.5, 0.5, 0.85
  FROM public.material_costs WHERE material_name = 'Delrin (Acetal)' AND is_active = true LIMIT 1;

  -- Nylon 6/6
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 9000, 1350, 4.5, 350, 1.3, 0.6, 0.9
  FROM public.material_costs WHERE material_name = 'Nylon 6/6' AND is_active = true LIMIT 1;

  -- PEEK
  INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
  SELECT id, vmc_process_id, 8000, 1200, 4.0, 300, 1.2, 0.7, 0.92
  FROM public.material_costs WHERE material_name = 'PEEK' AND is_active = true LIMIT 1;

  -- CNC Lathe parameters (if process exists)
  IF lathe_process_id IS NOT NULL THEN
    -- Aluminum 6061
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, lathe_process_id, 2500, 250, 2.5, 250, 1.2, 0.8, 1.0
    FROM public.material_costs WHERE material_name = 'Aluminum 6061' AND is_active = true LIMIT 1;

    -- Steel 1018
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, lathe_process_id, 1200, 200, 2.0, 110, 0.7, 1.2, 1.1
    FROM public.material_costs WHERE material_name = 'Mild Steel 1018' AND is_active = true LIMIT 1;

    -- Stainless Steel 316
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, lathe_process_id, 800, 150, 1.2, 65, 0.55, 1.6, 1.25
    FROM public.material_costs WHERE material_name = 'Stainless Steel 316' AND is_active = true LIMIT 1;

    -- Titanium Grade 5
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, lathe_process_id, 600, 120, 0.8, 50, 0.45, 2.2, 1.5
    FROM public.material_costs WHERE material_name = 'Titanium Grade 5' AND is_active = true LIMIT 1;

    -- Brass C360
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, lathe_process_id, 2200, 220, 2.2, 200, 1.1, 0.75, 0.95
    FROM public.material_costs WHERE material_name = 'Brass C360' AND is_active = true LIMIT 1;
  END IF;

  -- Wire EDM parameters (if process exists)
  IF edm_process_id IS NOT NULL THEN
    -- Aluminum 6061
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, edm_process_id, NULL, 8, NULL, NULL, 1.3, 0.9, 1.2
    FROM public.material_costs WHERE material_name = 'Aluminum 6061' AND is_active = true LIMIT 1;

    -- Steel 1045
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, edm_process_id, NULL, 5, NULL, NULL, 1.0, 1.0, 1.3
    FROM public.material_costs WHERE material_name = 'Steel 1045' AND is_active = true LIMIT 1;

    -- Stainless Steel 316
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, edm_process_id, NULL, 4, NULL, NULL, 0.8, 1.1, 1.4
    FROM public.material_costs WHERE material_name = 'Stainless Steel 316' AND is_active = true LIMIT 1;

    -- Titanium Grade 5
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, edm_process_id, NULL, 3, NULL, NULL, 0.7, 1.2, 1.5
    FROM public.material_costs WHERE material_name = 'Titanium Grade 5' AND is_active = true LIMIT 1;

    -- D2 Tool Steel
    INSERT INTO public.material_process_parameters (material_id, process_id, spindle_speed_rpm, feed_rate_mm_per_min, depth_of_cut_mm, cutting_speed_m_per_min, material_removal_rate_adjustment, tool_wear_multiplier, setup_time_multiplier)
    SELECT id, edm_process_id, NULL, 2, NULL, NULL, 0.6, 1.3, 1.6
    FROM public.material_costs WHERE material_name = 'D2 Tool Steel' AND is_active = true LIMIT 1;
  END IF;
END $$;