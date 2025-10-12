import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

interface QuoteInputs {
  volume_cm3: number;
  surface_area_cm2: number;
  complexity_score: number;
  quantity: number;
  process?: string;
  material?: string;
  finish?: string;
}

interface QuoteBreakdown {
  material_cost: number;
  machining_cost: number;
  setup_cost: number;
  finish_cost: number;
  discount_applied: string;
}

interface QuoteResult {
  unit_price: number;
  total_price: number;
  breakdown: QuoteBreakdown;
  estimated_hours: number;
  lead_time_days: number;
  confidence: number;
  process: string;
  material: string;
  finish: string;
}

async function calculateQuote(inputs: QuoteInputs): Promise<QuoteResult> {
  console.log('Calculating quote with inputs:', inputs);
  
  // Set defaults
  const processName = inputs.process || 'CNC Machining';
  const materialName = inputs.material || 'Aluminum 6061';
  const finishName = inputs.finish || 'As-machined';
  
  // 1. Fetch process rates from database
  const { data: processData, error: processError } = await supabase
    .from('manufacturing_processes')
    .select('*')
    .eq('name', processName)
    .eq('is_active', true)
    .single();
  
  if (processError || !processData) {
    console.error('Error fetching process:', processError);
    throw new Error(`Process "${processName}" not found`);
  }
  
  // 2. Fetch material rates from database
  const { data: materialData, error: materialError } = await supabase
    .from('material_costs')
    .select('*')
    .eq('material_name', materialName)
    .eq('is_active', true)
    .single();
  
  if (materialError || !materialData) {
    console.error('Error fetching material:', materialError);
    throw new Error(`Material "${materialName}" not found`);
  }
  
  // 3. Material Cost - calculate based on pricing method
  let materialCost = 0;
  
  if (materialData.pricing_method === 'linear_inch') {
    // For linear inch pricing, use first cross-section as default
    // In a real scenario, you'd match dimensions or let user select
    const crossSections = materialData.cross_sections as any[] || [];
    if (crossSections.length > 0) {
      // Estimate length from volume (this is simplified - real CAD analysis would provide actual length)
      const avgCrossSection = crossSections[0];
      const crossSectionArea = avgCrossSection.width * avgCrossSection.thickness; // in square inches
      const estimatedLengthInches = (inputs.volume_cm3 * 0.0610237) / crossSectionArea; // convert cm³ to cubic inches
      materialCost = estimatedLengthInches * avgCrossSection.cost_per_inch;
      console.log(`Linear pricing: ${estimatedLengthInches.toFixed(2)} inches × $${avgCrossSection.cost_per_inch}/inch = $${materialCost.toFixed(2)}`);
    } else {
      // Fallback to weight-based if no cross-sections defined
      materialCost = inputs.volume_cm3 * materialData.cost_per_cubic_cm;
    }
  } else {
    // Weight-based pricing (default)
    materialCost = inputs.volume_cm3 * materialData.cost_per_cubic_cm;
  }
  
  // 4. Machining Time Estimation
  // Formula: surface_area / cutting_speed × complexity_multiplier
  const complexityMultiplier = 1 + ((inputs.complexity_score - 5) / 10);
  const estimatedHours = (inputs.surface_area_cm2 / 100) * complexityMultiplier * processData.complexity_multiplier;
  
  // 5. Machining Cost
  const machiningCost = estimatedHours * processData.base_rate_per_hour;
  
  // 6. Setup Cost (amortized over quantity)
  const setupCostPerUnit = processData.setup_cost / inputs.quantity;
  
  // 7. Finish Cost (if applicable)
  const finishCost = finishName !== 'As-machined' 
    ? inputs.surface_area_cm2 * 0.05 
    : 0;
  
  // 8. Quantity Discount
  let discount = 0;
  if (inputs.quantity >= 1000) discount = 0.20;
  else if (inputs.quantity >= 100) discount = 0.15;
  else if (inputs.quantity >= 50) discount = 0.10;
  else if (inputs.quantity >= 10) discount = 0.05;
  
  // 9. Calculate final unit price
  const subtotal = materialCost + machiningCost + setupCostPerUnit + finishCost;
  const unitPrice = subtotal * (1 - discount);
  
  // Apply minimum price floor
  const finalUnitPrice = Math.max(unitPrice, 10.00); // $10 minimum
  
  // 10. Lead Time (simple formula: 1 day per 8 hours of work, min 5 days)
  const totalHours = estimatedHours * inputs.quantity;
  const leadTimeDays = Math.max(5, Math.ceil(totalHours / 8) + 2);
  
  console.log('Quote calculated:', {
    unit_price: finalUnitPrice,
    material_cost: materialCost,
    machining_cost: machiningCost,
    setup_cost: setupCostPerUnit,
    discount
  });
  
  return {
    unit_price: Number(finalUnitPrice.toFixed(2)),
    total_price: Number((finalUnitPrice * inputs.quantity).toFixed(2)),
    breakdown: {
      material_cost: Number(materialCost.toFixed(2)),
      machining_cost: Number(machiningCost.toFixed(2)),
      setup_cost: Number(setupCostPerUnit.toFixed(2)),
      finish_cost: Number(finishCost.toFixed(2)),
      discount_applied: discount > 0 ? `${(discount * 100).toFixed(0)}%` : 'None'
    },
    estimated_hours: Number(estimatedHours.toFixed(2)),
    lead_time_days: leadTimeDays,
    confidence: 0.75,
    process: processName,
    material: materialName,
    finish: finishName
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const inputs: QuoteInputs = await req.json();
    
    if (!inputs.volume_cm3 || !inputs.surface_area_cm2 || !inputs.complexity_score || !inputs.quantity) {
      throw new Error('Missing required parameters');
    }

    const quote = await calculateQuote(inputs);
    
    return new Response(
      JSON.stringify({
        success: true,
        ...quote
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error('Error in calculate-preliminary-quote function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);
