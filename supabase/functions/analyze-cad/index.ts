import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  file_name: string;
  file_size: number;
  quantity: number;
}

interface AnalysisResult {
  volume_cm3: number;
  surface_area_cm2: number;
  complexity_score: number;
  confidence: number;
  method: string;
}

function estimateFromFile(fileName: string, fileSize: number): AnalysisResult {
  console.log(`Analyzing file: ${fileName}, size: ${fileSize} bytes`);
  
  // Convert bytes to KB
  const fileSizeKB = fileSize / 1024;
  
  // STL/STEP files: estimate volume from file size
  // Rough heuristic: 1KB ≈ 1cm³ for STL files
  // This is a simplified estimation - real CAD analysis would parse geometry
  const estimatedVolume = Math.max(fileSizeKB * 0.8, 10); // Minimum 10cm³
  
  // Surface area estimate (assume 6:1 ratio for typical machined parts)
  const estimatedSurfaceArea = estimatedVolume * 6;
  
  // Complexity from file name patterns and size
  let complexity = 5; // default medium complexity
  
  const lowerName = fileName.toLowerCase();
  
  // Simple parts indicators
  if (lowerName.match(/simple|basic|bracket|plate|block|washer/i)) {
    complexity = 3;
  }
  // Complex parts indicators
  else if (lowerName.match(/complex|assembly|multi|intricate|detailed/i)) {
    complexity = 7;
  }
  // Very large files tend to be more complex
  else if (fileSizeKB > 5000) {
    complexity = 8;
  }
  // Small files are usually simpler
  else if (fileSizeKB < 100) {
    complexity = 4;
  }
  
  console.log(`Estimated - Volume: ${estimatedVolume}cm³, Surface: ${estimatedSurfaceArea}cm², Complexity: ${complexity}/10`);
  
  return {
    volume_cm3: Number(estimatedVolume.toFixed(2)),
    surface_area_cm2: Number(estimatedSurfaceArea.toFixed(2)),
    complexity_score: complexity,
    confidence: 0.6, // medium confidence for heuristic method
    method: 'file_heuristic'
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { file_name, file_size, quantity }: AnalysisRequest = await req.json();
    
    if (!file_name || !file_size) {
      throw new Error('Missing required parameters: file_name and file_size');
    }

    console.log(`CAD Analysis request for: ${file_name}`);
    
    // Perform heuristic analysis
    const analysis = estimateFromFile(file_name, file_size);
    
    return new Response(
      JSON.stringify({
        success: true,
        ...analysis,
        quantity: quantity || 1
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
    console.error('Error in analyze-cad function:', error);
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
