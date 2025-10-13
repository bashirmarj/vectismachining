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
  surface_treatments?: string[]; // Array of surface treatment names
  part_width_cm?: number;
  part_height_cm?: number;
  part_depth_cm?: number;
}

interface MachiningTimeBreakdown {
  roughing_hours: number;
  finishing_hours: number;
  tool_change_hours: number;
  positioning_hours: number;
  total_hours: number;
}

interface QuoteBreakdown {
  material_cost: number;
  machining_cost: number;
  setup_cost: number;
  finish_cost: number;
  surface_treatment_cost: number;
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
  machining_time_breakdown?: MachiningTimeBreakdown;
  removed_volume_cm3?: number;
}

// Helper function: Find best cross-section for linear inch materials
function findBestCrossSection(inputs: QuoteInputs, materialData: any): any {
  if (!materialData.cross_sections || materialData.cross_sections.length === 0) {
    return null;
  }

  const partWidthInches = (inputs.part_width_cm || 10) / 2.54;
  const partHeightInches = (inputs.part_height_cm || 10) / 2.54;
  const maxDimension = Math.max(partWidthInches, partHeightInches);

  // Find smallest cross-section that fits the part
  const sorted = [...materialData.cross_sections].sort((a: any, b: any) => {
    const aSize = a.shape === 'circular' ? a.width : Math.max(a.width, a.thickness);
    const bSize = b.shape === 'circular' ? b.width : Math.max(b.width, b.thickness);
    return aSize - bSize;
  });

  for (const cs of sorted) {
    const csSize = cs.shape === 'circular' ? cs.width : Math.max(cs.width, cs.thickness);
    if (csSize >= maxDimension) {
      return cs;
    }
  }

  // If none fit, return largest available
  return sorted[sorted.length - 1];
}

// Calculate removed material volume with improved stock estimation
function calculateRemovedVolume(inputs: QuoteInputs, materialData: any): number {
  let stockVolume = 0;
  
  // Use part bounding box + 20% margin for more realistic stock estimation
  const marginFactor = 1.2; // 20% margin for machining allowance
  const effectiveWidth = (inputs.part_width_cm || 10) * marginFactor;
  const effectiveHeight = (inputs.part_height_cm || 10) * marginFactor;
  const effectiveDepth = (inputs.part_depth_cm || 10) * marginFactor;
  
  if (materialData.pricing_method === 'linear_inch') {
    // For bar stock: use part bounding box + margin instead of full bar cross-section
    // This gives a more realistic estimate of actual material needed
    stockVolume = effectiveWidth * effectiveHeight * effectiveDepth;
    
    console.log(`📦 Linear inch stock: ${effectiveWidth.toFixed(2)} × ${effectiveHeight.toFixed(2)} × ${effectiveDepth.toFixed(2)} cm = ${stockVolume.toFixed(2)} cm³`);
  } else if (materialData.pricing_method === 'sheet') {
    // For sheet stock: calculate from part bounding box + thickness
    const sheetThicknessCm = 0.5; // Default, should come from selected sheet
    stockVolume = effectiveWidth * effectiveHeight * sheetThicknessCm;
    
    console.log(`📄 Sheet stock: ${effectiveWidth.toFixed(2)} × ${effectiveHeight.toFixed(2)} × ${sheetThicknessCm} cm = ${stockVolume.toFixed(2)} cm³`);
  } else {
    // Weight-based: use bounding box + margin for consistency
    stockVolume = effectiveWidth * effectiveHeight * effectiveDepth;
    
    console.log(`⚖️ Weight-based stock: ${effectiveWidth.toFixed(2)} × ${effectiveHeight.toFixed(2)} × ${effectiveDepth.toFixed(2)} cm = ${stockVolume.toFixed(2)} cm³`);
  }
  
  // Cap maximum stock at 3× part volume to prevent unrealistic waste calculations
  const maxAllowedStock = inputs.volume_cm3 * 3;
  if (stockVolume > maxAllowedStock) {
    console.log(`⚠️ Stock volume ${stockVolume.toFixed(2)} cm³ exceeds 3× part volume (${maxAllowedStock.toFixed(2)} cm³), capping to prevent unrealistic waste`);
    stockVolume = maxAllowedStock;
  }
  
  // Material removed = Stock volume - Part volume (minimum 20% of part volume)
  const removedVolume = Math.max(stockVolume - inputs.volume_cm3, inputs.volume_cm3 * 0.2);
  
  // Calculate waste percentage for logging
  const wastePercentage = ((removedVolume / stockVolume) * 100).toFixed(1);
  
  console.log(`📊 Stock Calculation Summary:
  • Pricing Method: ${materialData.pricing_method}
  • Stock Volume: ${stockVolume.toFixed(2)} cm³
  • Part Volume: ${inputs.volume_cm3.toFixed(2)} cm³
  • Removed Volume: ${removedVolume.toFixed(2)} cm³
  • Waste Percentage: ${wastePercentage}%`);
  
  return removedVolume;
}

// Calculate Material Removal Rate (MRR) using material-process specific parameters
function calculateMRR(machiningParams: any, materialData: any): number {
  // MRR = Feed Rate × Depth of Cut × Width of Cut
  const feedRate = machiningParams.feedRate || 500;
  const depthOfCut = machiningParams.depthOfCut || 2.0;
  const widthOfCut = depthOfCut * 1.5; // Typical step-over
  
  // Base MRR in mm³/min
  const baseMRR = feedRate * depthOfCut * widthOfCut;
  
  // Adjust for material machinability and material-process specific adjustment
  const machinabilityRating = materialData.machinability_rating || 1.0;
  const materialRemovalAdj = machiningParams.materialRemovalRateAdj || 1.0;
  const adjustedMRR = baseMRR * machinabilityRating * materialRemovalAdj;
  
  // Convert mm³/min to cm³/min
  const mrrCm3PerMin = adjustedMRR / 1000;
  
  console.log(`MRR Calculation: ${feedRate} mm/min × ${depthOfCut} mm × ${widthOfCut} mm × ${machinabilityRating} machinability × ${materialRemovalAdj} process adj = ${mrrCm3PerMin.toFixed(2)} cm³/min`);
  
  return mrrCm3PerMin;
}

// Validate quote for unrealistic values
function validateQuote(
  inputs: QuoteInputs, 
  unitPrice: number, 
  removedVolume: number, 
  estimatedHours: number,
  materialCost: number
): void {
  const warnings: string[] = [];
  
  // Check 1: Excessive waste (removed volume > 5× part volume)
  const wasteRatio = removedVolume / inputs.volume_cm3;
  if (wasteRatio > 5) {
    warnings.push(`⚠️ High waste ratio: ${wasteRatio.toFixed(1)}× part volume removed`);
  }
  
  // Check 2: Unrealistic machining time (> 10 hours for single part)
  if (estimatedHours > 10) {
    warnings.push(`⚠️ High machining time: ${estimatedHours.toFixed(2)} hours (verify complexity)`);
  }
  
  // Check 3: Material cost seems very high per cm³
  const materialCostPerCm3 = materialCost / inputs.volume_cm3;
  if (materialCostPerCm3 > 2.0) {
    warnings.push(`⚠️ High material cost per cm³: $${materialCostPerCm3.toFixed(2)}/cm³`);
  }
  
  // Check 4: Very high unit price (might indicate calculation error)
  if (unitPrice > 1000) {
    warnings.push(`⚠️ Very high unit price: $${unitPrice.toFixed(2)} (verify all inputs)`);
  }
  
  if (warnings.length > 0) {
    console.log('🚨 Quote Validation Warnings:\n' + warnings.join('\n'));
  } else {
    console.log('✅ Quote validation passed - all values within expected ranges');
  }
}

// Calculate detailed machining time breakdown
function calculateMachiningTime(
  removedVolume: number,
  inputs: QuoteInputs,
  processData: any,
  materialData: any,
  machiningParams: any
): MachiningTimeBreakdown {
  const mrr = calculateMRR(machiningParams, materialData);
  
  // Split into roughing (80% of volume) and finishing (20% + surface area)
  const roughingVolume = removedVolume * 0.80;
  const finishingVolume = removedVolume * 0.20;
  
  // Roughing: Use full MRR
  const roughingMinutes = roughingVolume / mrr;
  
  // Finishing: Use 30% of MRR (slower, more precise cuts)
  const finishingMRR = mrr * 0.30;
  const finishingMinutes = finishingVolume / finishingMRR;
  
  // Add time for surface finishing based on surface area
  const complexityMultiplier = 1 + ((inputs.complexity_score - 5) / 10);
  const surfaceFinishingMinutes = (inputs.surface_area_cm2 / 50) * complexityMultiplier;
  
  // Tool changes: estimate 1 change per 50 cm³ removed, adjusted by tool wear multiplier
  const toolWearMultiplier = machiningParams.toolWearMultiplier || 1.0;
  const toolChanges = Math.ceil((removedVolume / 50) * toolWearMultiplier);
  const toolChangeMinutes = toolChanges * (processData.tool_change_time_minutes || 2.0);
  
  // Non-cutting time (positioning, measuring): 20% overhead
  const cuttingTimeMinutes = roughingMinutes + finishingMinutes + surfaceFinishingMinutes;
  const positioningMinutes = cuttingTimeMinutes * 0.20;
  
  const totalMinutes = cuttingTimeMinutes + toolChangeMinutes + positioningMinutes;
  
  const breakdown: MachiningTimeBreakdown = {
    roughing_hours: roughingMinutes / 60,
    finishing_hours: (finishingMinutes + surfaceFinishingMinutes) / 60,
    tool_change_hours: toolChangeMinutes / 60,
    positioning_hours: positioningMinutes / 60,
    total_hours: totalMinutes / 60
  };
  
  console.log('Machining time breakdown:', {
    roughing: `${breakdown.roughing_hours.toFixed(2)} hrs`,
    finishing: `${breakdown.finishing_hours.toFixed(2)} hrs`,
    tool_changes: `${breakdown.tool_change_hours.toFixed(2)} hrs`,
    positioning: `${breakdown.positioning_hours.toFixed(2)} hrs`,
    total: `${breakdown.total_hours.toFixed(2)} hrs`
  });
  
  return breakdown;
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

  // 3. Fetch material-process specific parameters
  const { data: materialProcessParams } = await supabase
    .from('material_process_parameters')
    .select('*')
    .eq('material_id', materialData.id)
    .eq('process_id', processData.id)
    .maybeSingle();

  console.log('Material-process parameters:', materialProcessParams);

  // Use material-process specific parameters if available, otherwise fall back to material defaults
  const machiningParams = materialProcessParams ? {
    spindleSpeed: materialProcessParams.spindle_speed_rpm,
    feedRate: materialProcessParams.feed_rate_mm_per_min,
    depthOfCut: materialProcessParams.depth_of_cut_mm,
    cuttingSpeed: materialProcessParams.cutting_speed_m_per_min,
    materialRemovalRateAdj: materialProcessParams.material_removal_rate_adjustment || 1.0,
    toolWearMultiplier: materialProcessParams.tool_wear_multiplier || 1.0,
    setupTimeMultiplier: materialProcessParams.setup_time_multiplier || 1.0,
  } : {
    // Fallback to material defaults or process defaults
    spindleSpeed: materialData.spindle_speed_rpm_max || processData.spindle_speed_rpm || 3000,
    feedRate: materialData.feed_rate_mm_per_min_max || processData.feed_rate_mm_per_min || 500,
    depthOfCut: materialData.depth_of_cut_mm_max || processData.depth_of_cut_mm || 2.0,
    cuttingSpeed: materialData.cutting_speed_m_per_min_max || 100,
    materialRemovalRateAdj: 1.0,
    toolWearMultiplier: materialData.tool_life_factor || 1.0,
    setupTimeMultiplier: 1.0,
  };

  console.log('Using machining parameters:', machiningParams);
  
  // 3. Material Cost - calculate based on pricing method
  let materialCost = 0;
  
  if (materialData.pricing_method === 'linear_inch') {
    // For linear inch pricing, find the best cross-section based on part dimensions
    const crossSections = materialData.cross_sections as any[] || [];
    if (crossSections.length > 0 && inputs.part_width_cm && inputs.part_height_cm && inputs.part_depth_cm) {
      // Convert part dimensions from cm to inches
      const partWidthIn = inputs.part_width_cm / 2.54;
      const partHeightIn = inputs.part_height_cm / 2.54;
      const partDepthIn = inputs.part_depth_cm / 2.54;
      
      // Find the smallest cross-section that can accommodate the part
      // Assuming the part needs to fit within the cross-section dimensions
      let bestCrossSection = null;
      let bestCost = Infinity;
      
      for (const cs of crossSections) {
        const isCircular = cs.shape === 'circular';
        
        // Check if part can be made from this cross-section (considering rotation)
        const partDims = [partWidthIn, partHeightIn, partDepthIn].sort((a, b) => b - a);
        
        let fits = false;
        
        if (isCircular) {
          // For circular cross-sections (round bars), check if part fits within circle diameter
          // The two largest dimensions must fit diagonally within the circular cross-section
          const diameter = cs.width; // For circular, width represents diameter
          const diagonalRequired = Math.sqrt(partDims[0] ** 2 + partDims[1] ** 2);
          fits = diagonalRequired <= diameter;
        } else {
          // For rectangular cross-sections (flat bars)
          const csDims = [cs.width, cs.thickness].sort((a, b) => b - a);
          fits = partDims[0] <= csDims[0] && partDims[1] <= csDims[1];
        }
        
        if (fits) {
          // Calculate material needed (length is the third dimension)
          const lengthNeeded = partDims[2];
          const materialCostForCS = lengthNeeded * cs.cost_per_inch * inputs.quantity;
          
          if (materialCostForCS < bestCost) {
            bestCost = materialCostForCS;
            bestCrossSection = {
              ...cs,
              lengthNeeded,
              totalCost: materialCostForCS
            };
          }
        }
      }
      
      if (bestCrossSection) {
        materialCost = bestCrossSection.totalCost / inputs.quantity;
        const shapeLabel = bestCrossSection.shape === 'circular' 
          ? `Ø ${bestCrossSection.width}"`
          : `${bestCrossSection.width}" × ${bestCrossSection.thickness}"`;
        console.log(`Linear pricing: Selected ${shapeLabel} cross-section, ${bestCrossSection.lengthNeeded.toFixed(2)} inches × $${bestCrossSection.cost_per_inch}/inch = $${materialCost.toFixed(2)} per unit`);
      } else {
        // No cross-section fits - use volume-based fallback
        console.log('No suitable cross-section found, using volume-based fallback');
        materialCost = inputs.volume_cm3 * materialData.cost_per_cubic_cm;
      }
    } else if (crossSections.length > 0) {
      // Fallback to first cross-section if no part dimensions available
      const avgCrossSection = crossSections[0];
      const crossSectionArea = avgCrossSection.width * avgCrossSection.thickness; // in square inches
      const estimatedLengthInches = (inputs.volume_cm3 * 0.0610237) / crossSectionArea; // convert cm³ to cubic inches
      materialCost = estimatedLengthInches * avgCrossSection.cost_per_inch;
      console.log(`Linear pricing (no dimensions): ${estimatedLengthInches.toFixed(2)} inches × $${avgCrossSection.cost_per_inch}/inch = $${materialCost.toFixed(2)}`);
    } else {
      // Fallback to weight-based if no cross-sections defined
      materialCost = inputs.volume_cm3 * materialData.cost_per_cubic_cm;
    }
  } else if (materialData.pricing_method === 'sheet') {
    // Sheet-based pricing with nesting efficiency
    const sheetConfigs = materialData.sheet_configurations as any[] || [];
    const nestingEfficiency = materialData.default_nesting_efficiency || 0.75;
    
    if (sheetConfigs.length > 0 && inputs.part_width_cm && inputs.part_height_cm) {
      // Find the most economical sheet size
      let bestCost = Infinity;
      let bestSheetInfo = null;
      
      for (const sheet of sheetConfigs) {
        // Convert all to cm for consistency
        const sheetWidthCm = sheet.unit === 'inch' ? sheet.width * 2.54 : sheet.width;
        const sheetHeightCm = sheet.unit === 'inch' ? sheet.height * 2.54 : sheet.height;
        
        // Calculate how many parts fit per sheet (with rotation consideration)
        const partsPerSheetOption1 = Math.floor(sheetWidthCm / inputs.part_width_cm) * 
                                     Math.floor(sheetHeightCm / inputs.part_height_cm);
        const partsPerSheetOption2 = Math.floor(sheetWidthCm / inputs.part_height_cm) * 
                                     Math.floor(sheetWidthCm / inputs.part_width_cm);
        const partsPerSheet = Math.max(partsPerSheetOption1, partsPerSheetOption2) * nestingEfficiency;
        
        if (partsPerSheet > 0) {
          const sheetsNeeded = Math.ceil(inputs.quantity / partsPerSheet);
          const totalCost = sheetsNeeded * sheet.cost_per_sheet;
          const costPerPart = totalCost / inputs.quantity;
          
          if (costPerPart < bestCost) {
            bestCost = costPerPart;
            bestSheetInfo = {
              sheet,
              partsPerSheet: Math.floor(partsPerSheet),
              sheetsNeeded,
              totalCost,
              utilization: (inputs.quantity / (sheetsNeeded * partsPerSheet)) * 100
            };
          }
        }
      }
      
      if (bestSheetInfo) {
        materialCost = bestSheetInfo.totalCost / inputs.quantity;
        console.log(`Sheet pricing: ${bestSheetInfo.sheetsNeeded} sheets × $${bestSheetInfo.sheet.cost_per_sheet}/sheet = $${bestSheetInfo.totalCost.toFixed(2)} (${bestSheetInfo.partsPerSheet} parts/sheet, ${bestSheetInfo.utilization.toFixed(1)}% utilization)`);
      } else {
        // Fallback if part is too large for any sheet
        console.log('Part too large for available sheets, using volume-based fallback');
        materialCost = inputs.volume_cm3 * materialData.cost_per_cubic_cm;
      }
    } else {
      // Fallback to weight-based if no sheets or part dimensions
      materialCost = inputs.volume_cm3 * materialData.cost_per_cubic_cm;
    }
  } else {
    // Weight-based pricing (default)
    materialCost = inputs.volume_cm3 * materialData.cost_per_cubic_cm;
  }
  
  // 4. Calculate material removal volume
  const removedVolume = calculateRemovedVolume(inputs, materialData);

  // 5. Calculate machining time with detailed breakdown
  const timeBreakdown = calculateMachiningTime(
    removedVolume,
    inputs,
    processData,
    materialData,
    machiningParams
  );

  // 6. Machining Cost (using detailed time calculation)
  const machiningCost = timeBreakdown.total_hours * processData.base_rate_per_hour;
  const estimatedHours = timeBreakdown.total_hours;
  
  console.log(`Machining: ${timeBreakdown.total_hours.toFixed(2)} hours × $${processData.base_rate_per_hour}/hr = $${machiningCost.toFixed(2)}`);
  
  // 7. Setup Cost (amortized over quantity, adjusted by setup time multiplier)
  const setupTimeMultiplier = machiningParams.setupTimeMultiplier || 1.0;
  const setupCostPerUnit = (processData.setup_cost * setupTimeMultiplier) / inputs.quantity;
  
  // 8. Finish Cost (if applicable)
  const finishCost = finishName !== 'As-machined' 
    ? inputs.surface_area_cm2 * 0.05 
    : 0;
  
  // 9. Surface Treatment Cost (based on surface area)
  let surfaceTreatmentCost = 0;
  if (inputs.surface_treatments && inputs.surface_treatments.length > 0) {
    // Fetch all requested surface treatments
    const { data: treatments, error: treatmentError } = await supabase
      .from('surface_treatments')
      .select('*')
      .in('name', inputs.surface_treatments)
      .eq('is_active', true);
    
    if (!treatmentError && treatments) {
      for (const treatment of treatments) {
        const treatmentCost = inputs.surface_area_cm2 * treatment.cost_per_cm2;
        surfaceTreatmentCost += treatmentCost;
        console.log(`Surface treatment "${treatment.name}": ${inputs.surface_area_cm2.toFixed(2)} cm² × $${treatment.cost_per_cm2}/cm² = $${treatmentCost.toFixed(2)}`);
      }
    }
  }
  
  // 10. Quantity Discount
  let discount = 0;
  if (inputs.quantity >= 1000) discount = 0.20;
  else if (inputs.quantity >= 100) discount = 0.15;
  else if (inputs.quantity >= 50) discount = 0.10;
  else if (inputs.quantity >= 10) discount = 0.05;
  
  // 11. Calculate final unit price
  const subtotal = materialCost + machiningCost + setupCostPerUnit + finishCost + surfaceTreatmentCost;
  const unitPrice = subtotal * (1 - discount);
  
  // Apply minimum price floor
  const finalUnitPrice = Math.max(unitPrice, 10.00); // $10 minimum
  
  // 12. Lead Time (simple formula: 1 day per 8 hours of work, min 5 days)
  const totalHours = estimatedHours * inputs.quantity;
  const leadTimeDays = Math.max(5, Math.ceil(totalHours / 8) + 2);
  
  console.log('Quote calculated:', {
    unit_price: finalUnitPrice,
    material_cost: materialCost,
    machining_cost: machiningCost,
    setup_cost: setupCostPerUnit,
    surface_treatment_cost: surfaceTreatmentCost,
    discount
  });
  
  // Validate quote for unrealistic values
  validateQuote(inputs, finalUnitPrice, removedVolume, estimatedHours, materialCost);
  
  return {
    unit_price: Number(finalUnitPrice.toFixed(2)),
    total_price: Number((finalUnitPrice * inputs.quantity).toFixed(2)),
    breakdown: {
      material_cost: Number(materialCost.toFixed(2)),
      machining_cost: Number(machiningCost.toFixed(2)),
      setup_cost: Number(setupCostPerUnit.toFixed(2)),
      finish_cost: Number(finishCost.toFixed(2)),
      surface_treatment_cost: Number(surfaceTreatmentCost.toFixed(2)),
      discount_applied: discount > 0 ? `${(discount * 100).toFixed(0)}%` : 'None'
    },
    estimated_hours: Number(estimatedHours.toFixed(2)),
    lead_time_days: leadTimeDays,
    confidence: 0.75,
    process: processName,
    material: materialName,
    finish: finishName,
    machining_time_breakdown: {
      roughing_hours: Number(timeBreakdown.roughing_hours.toFixed(2)),
      finishing_hours: Number(timeBreakdown.finishing_hours.toFixed(2)),
      tool_change_hours: Number(timeBreakdown.tool_change_hours.toFixed(2)),
      positioning_hours: Number(timeBreakdown.positioning_hours.toFixed(2)),
      total_hours: Number(timeBreakdown.total_hours.toFixed(2))
    },
    removed_volume_cm3: Number(removedVolume.toFixed(2))
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
