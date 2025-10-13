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

interface DetectedFeatures {
  is_cylindrical: boolean;
  has_keyway: boolean;
  has_flat_surfaces: boolean;
  has_internal_holes: boolean;
  requires_precision_boring: boolean;
  cylindricity_score: number;
  flat_surface_percentage: number;
  internal_surface_percentage: number;
}

interface AnalysisResult {
  volume_cm3: number;
  surface_area_cm2: number;
  complexity_score: number;
  confidence: number;
  method: string;
  part_width_cm?: number;
  part_height_cm?: number;
  part_depth_cm?: number;
  triangle_count?: number;
  feature_count?: number;
  detected_features?: DetectedFeatures;
  recommended_processes?: string[];
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

interface Triangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

// Parse binary STL file
function parseSTLBinary(buffer: ArrayBuffer): Triangle[] {
  const view = new DataView(buffer);
  let offset = 80; // Skip 80-byte header
  
  const triangleCount = view.getUint32(offset, true);
  offset += 4;
  
  const triangles: Triangle[] = [];
  
  for (let i = 0; i < triangleCount; i++) {
    const normal: Vector3 = {
      x: view.getFloat32(offset, true),
      y: view.getFloat32(offset + 4, true),
      z: view.getFloat32(offset + 8, true)
    };
    offset += 12;
    
    const vertices: [Vector3, Vector3, Vector3] = [
      {
        x: view.getFloat32(offset, true),
        y: view.getFloat32(offset + 4, true),
        z: view.getFloat32(offset + 8, true)
      },
      {
        x: view.getFloat32(offset + 12, true),
        y: view.getFloat32(offset + 16, true),
        z: view.getFloat32(offset + 20, true)
      },
      {
        x: view.getFloat32(offset + 24, true),
        y: view.getFloat32(offset + 28, true),
        z: view.getFloat32(offset + 32, true)
      }
    ];
    offset += 36;
    offset += 2; // Skip attribute byte count
    
    triangles.push({ normal, vertices });
  }
  
  return triangles;
}

// Calculate actual volume using signed tetrahedron method
function calculateVolume(triangles: Triangle[]): number {
  let volume = 0;
  
  for (const triangle of triangles) {
    const [v1, v2, v3] = triangle.vertices;
    // Volume of tetrahedron from origin to triangle
    volume += (v1.x * v2.y * v3.z - v1.x * v3.y * v2.z - 
               v2.x * v1.y * v3.z + v2.x * v3.y * v1.z + 
               v3.x * v1.y * v2.z - v3.x * v2.y * v1.z) / 6;
  }
  
  return Math.abs(volume) / 1000; // Convert mm³ to cm³
}

// Calculate surface area from triangles
function calculateSurfaceArea(triangles: Triangle[]): number {
  let area = 0;
  
  for (const triangle of triangles) {
    const [v1, v2, v3] = triangle.vertices;
    const edge1 = {
      x: v2.x - v1.x,
      y: v2.y - v1.y,
      z: v2.z - v1.z
    };
    const edge2 = {
      x: v3.x - v1.x,
      y: v3.y - v1.y,
      z: v3.z - v1.z
    };
    
    // Cross product
    const cross = {
      x: edge1.y * edge2.z - edge1.z * edge2.y,
      y: edge1.z * edge2.x - edge1.x * edge2.z,
      z: edge1.x * edge2.y - edge1.y * edge2.x
    };
    
    // Triangle area is half the magnitude of cross product
    area += Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2;
  }
  
  return area / 100; // Convert mm² to cm²
}

// Calculate bounding box
function getBoundingBox(triangles: Triangle[]): { min: Vector3; max: Vector3 } {
  const min: Vector3 = { x: Infinity, y: Infinity, z: Infinity };
  const max: Vector3 = { x: -Infinity, y: -Infinity, z: -Infinity };
  
  for (const triangle of triangles) {
    for (const vertex of triangle.vertices) {
      min.x = Math.min(min.x, vertex.x);
      min.y = Math.min(min.y, vertex.y);
      min.z = Math.min(min.z, vertex.z);
      max.x = Math.max(max.x, vertex.x);
      max.y = Math.max(max.y, vertex.y);
      max.z = Math.max(max.z, vertex.z);
    }
  }
  
  return { min, max };
}

// Calculate complexity from geometry
function calculateComplexity(triangles: Triangle[], bbox: { min: Vector3; max: Vector3 }): number {
  const triangleCount = triangles.length;
  
  // Base complexity from triangle count
  let complexity = Math.min(Math.log10(triangleCount) * 2, 10);
  
  // Analyze surface normal variation (more varied = more complex)
  const normalVariations = new Set<string>();
  for (const triangle of triangles) {
    const normalKey = `${triangle.normal.x.toFixed(1)},${triangle.normal.y.toFixed(1)},${triangle.normal.z.toFixed(1)}`;
    normalVariations.add(normalKey);
  }
  const normalComplexity = Math.min(normalVariations.size / 100, 3);
  
  // Analyze aspect ratio (tall/thin parts are more complex)
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const depth = bbox.max.z - bbox.min.z;
  const aspectRatio = Math.max(width, height, depth) / Math.min(width, height, depth);
  const aspectComplexity = Math.min(aspectRatio / 5, 2);
  
  return Math.min(Math.round(complexity + normalComplexity + aspectComplexity), 10);
}

// Detect if part is cylindrical (suitable for lathe)
function isCylindricalPart(triangles: Triangle[], bbox: { min: Vector3; max: Vector3 }): { is_cylindrical: boolean; score: number } {
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const depth = bbox.max.z - bbox.min.z;
  
  // Check if two dimensions are similar (cylindrical cross-section)
  const aspectRatioXY = Math.max(width, height) / Math.min(width, height);
  const aspectRatioXZ = Math.max(width, depth) / Math.min(width, depth);
  const aspectRatioYZ = Math.max(height, depth) / Math.min(height, depth);
  
  // Find the best cylindrical match
  const cylindricalScore = Math.min(aspectRatioXY, aspectRatioXZ, aspectRatioYZ);
  
  // Check normal distribution - cylindrical parts have many radial normals
  let radialNormals = 0;
  for (const tri of triangles) {
    const n = tri.normal;
    // Radial normals have strong X or Y component, weak Z (for vertical cylinder)
    const radialStrength = Math.sqrt(n.x * n.x + n.y * n.y);
    if (radialStrength > 0.7) radialNormals++;
  }
  const radialPercentage = radialNormals / triangles.length;
  
  // Cylindrical if aspect ratio is good AND has radial normals
  const is_cylindrical = cylindricalScore < 1.3 && radialPercentage > 0.4;
  
  return { is_cylindrical, score: is_cylindrical ? (1 - (cylindricalScore - 1)) : 0 };
}

// Detect keyway or slot features
function hasKeyway(triangles: Triangle[]): boolean {
  let horizontalSurfaces = 0;
  let verticalWalls = 0;
  let totalArea = 0;
  
  for (const tri of triangles) {
    const n = tri.normal;
    const area = getTriangleArea(tri);
    totalArea += area;
    
    // Horizontal surface (normal pointing up/down)
    if (Math.abs(n.z) > 0.9) horizontalSurfaces += area;
    
    // Vertical wall (normal pointing sideways)
    if (Math.abs(n.x) > 0.9 || Math.abs(n.y) > 0.9) verticalWalls += area;
  }
  
  // Keyways have sharp transitions: significant vertical walls + horizontal floors
  const wallPercentage = verticalWalls / totalArea;
  const floorPercentage = horizontalSurfaces / totalArea;
  
  // Keyway detection: at least 15% vertical walls and some horizontal floors
  return wallPercentage > 0.15 && floorPercentage > 0.05;
}

// Detect flat surfaces requiring milling
function hasFlatSurfaces(triangles: Triangle[]): { has_flat: boolean; percentage: number } {
  let flatArea = 0;
  let totalArea = 0;
  
  for (const tri of triangles) {
    const n = tri.normal;
    const area = getTriangleArea(tri);
    totalArea += area;
    
    // Flat surfaces have normals aligned with major axes
    if (Math.abs(n.x) > 0.95 || Math.abs(n.y) > 0.95 || Math.abs(n.z) > 0.95) {
      flatArea += area;
    }
  }
  
  const percentage = flatArea / totalArea;
  // If >20% of surface is flat, it likely needs milling
  return { has_flat: percentage > 0.2, percentage };
}

// Detect internal holes requiring boring
function hasInternalHoles(triangles: Triangle[], bbox: { min: Vector3; max: Vector3 }): { has_holes: boolean; percentage: number } {
  // Calculate part centroid
  const centroid = {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2
  };
  
  let inwardArea = 0;
  let totalArea = 0;
  
  for (const tri of triangles) {
    const area = getTriangleArea(tri);
    totalArea += area;
    
    // Get triangle centroid
    const triCentroid = {
      x: (tri.vertices[0].x + tri.vertices[1].x + tri.vertices[2].x) / 3,
      y: (tri.vertices[0].y + tri.vertices[1].y + tri.vertices[2].y) / 3,
      z: (tri.vertices[0].z + tri.vertices[1].z + tri.vertices[2].z) / 3
    };
    
    // Vector from tri to part center
    const toCenter = {
      x: centroid.x - triCentroid.x,
      y: centroid.y - triCentroid.y,
      z: centroid.z - triCentroid.z
    };
    
    // Dot product: if normal points toward center, it's an internal surface
    const dotProduct = tri.normal.x * toCenter.x + tri.normal.y * toCenter.y + tri.normal.z * toCenter.z;
    if (dotProduct > 0) inwardArea += area;
  }
  
  const percentage = inwardArea / totalArea;
  // If >25% of surfaces point inward, likely has internal holes
  return { has_holes: percentage > 0.25, percentage };
}

// Helper: Calculate triangle area
function getTriangleArea(tri: Triangle): number {
  const [v1, v2, v3] = tri.vertices;
  const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
  const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
  
  const cross = {
    x: edge1.y * edge2.z - edge1.z * edge2.y,
    y: edge1.z * edge2.x - edge1.x * edge2.z,
    z: edge1.x * edge2.y - edge1.y * edge2.x
  };
  
  return Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z) / 2;
}

// Determine required processes based on detected features
function detectRequiredProcesses(features: DetectedFeatures, complexity: number): string[] {
  const processes: string[] = [];
  
  // 1. Check if cylindrical (base process for lathe work)
  if (features.is_cylindrical) {
    processes.push('CNC Lathe');
  }
  
  // 2. Check for keyway
  if (features.has_keyway) {
    processes.push('Key way');
  }
  
  // 3. Check for flat surfaces or if not cylindrical (needs milling)
  if (features.has_flat_surfaces || (!features.is_cylindrical && features.flat_surface_percentage > 0.1)) {
    processes.push('VMC Machining');
  }
  
  // 4. Check for precision internal holes
  if (features.requires_precision_boring) {
    processes.push('Boring Station');
  }
  
  // Fallback: if no process detected or only keyway, default to VMC
  if (processes.length === 0 || (processes.length === 1 && processes[0] === 'Key way')) {
    processes.push('VMC Machining');
  }
  
  console.log('Detected processes:', processes);
  return processes;
}

// Analyze STL file
async function analyzeSTL(fileData: ArrayBuffer): Promise<AnalysisResult> {
  console.log('Parsing STL geometry...');
  
  const triangles = parseSTLBinary(fileData);
  const volume = calculateVolume(triangles);
  const surfaceArea = calculateSurfaceArea(triangles);
  const bbox = getBoundingBox(triangles);
  const complexity = calculateComplexity(triangles, bbox);
  
  const part_width_cm = Number(((bbox.max.x - bbox.min.x) / 10).toFixed(2));
  const part_height_cm = Number(((bbox.max.y - bbox.min.y) / 10).toFixed(2));
  const part_depth_cm = Number(((bbox.max.z - bbox.min.z) / 10).toFixed(2));
  
  // Detect features
  const cylindrical = isCylindricalPart(triangles, bbox);
  const keyway = hasKeyway(triangles);
  const flatSurfaces = hasFlatSurfaces(triangles);
  const internalHoles = hasInternalHoles(triangles, bbox);
  
  const detected_features: DetectedFeatures = {
    is_cylindrical: cylindrical.is_cylindrical,
    has_keyway: keyway,
    has_flat_surfaces: flatSurfaces.has_flat,
    has_internal_holes: internalHoles.has_holes,
    requires_precision_boring: internalHoles.has_holes && internalHoles.percentage > 0.35,
    cylindricity_score: cylindrical.score,
    flat_surface_percentage: flatSurfaces.percentage,
    internal_surface_percentage: internalHoles.percentage
  };
  
  const recommended_processes = detectRequiredProcesses(detected_features, complexity);
  
  console.log(`STL Analysis - Volume: ${volume.toFixed(2)}cm³, Surface: ${surfaceArea.toFixed(2)}cm², Complexity: ${complexity}/10, Triangles: ${triangles.length}`);
  console.log(`Dimensions: ${part_width_cm} × ${part_height_cm} × ${part_depth_cm} cm`);
  console.log(`Features:`, detected_features);
  console.log(`Recommended processes:`, recommended_processes);
  
  return {
    volume_cm3: Number(volume.toFixed(2)),
    surface_area_cm2: Number(surfaceArea.toFixed(2)),
    complexity_score: complexity,
    confidence: 0.9,
    method: 'stl_geometry',
    part_width_cm,
    part_height_cm,
    part_depth_cm,
    triangle_count: triangles.length,
    detected_features,
    recommended_processes
  };
}

// Enhanced heuristic analysis for non-STL files
function enhancedHeuristic(fileName: string, fileSize: number): AnalysisResult {
  console.log(`Enhanced heuristic analysis: ${fileName}, size: ${fileSize} bytes`);
  
  const fileSizeKB = fileSize / 1024;
  const lowerName = fileName.toLowerCase();
  
  // Better volume estimation based on file type
  let volumeMultiplier = 0.8;
  if (lowerName.endsWith('.step') || lowerName.endsWith('.stp')) {
    volumeMultiplier = 1.2; // STEP files are more verbose
  } else if (lowerName.endsWith('.iges') || lowerName.endsWith('.igs')) {
    volumeMultiplier = 1.0;
  }
  
  const estimatedVolume = Math.max(fileSizeKB * volumeMultiplier, 10);
  const estimatedSurfaceArea = estimatedVolume * 6;
  
  // Enhanced complexity scoring
  let complexity = 5;
  
  // File name patterns
  if (lowerName.match(/simple|basic|bracket|plate|block|washer/i)) complexity -= 2;
  if (lowerName.match(/complex|assembly|multi|intricate|detailed/i)) complexity += 2;
  
  // File size indicators
  if (fileSizeKB > 5000) complexity += 2;
  else if (fileSizeKB < 100) complexity -= 1;
  
  // File entropy estimate (larger files relative to volume = more complex)
  const entropyFactor = fileSizeKB / estimatedVolume;
  if (entropyFactor > 5) complexity += 1;
  
  complexity = Math.max(1, Math.min(10, complexity));
  
  // Better dimension estimation
  const cubeSide = Math.pow(estimatedVolume, 1/3);
  const variationFactor = 0.6 + (Math.random() * 0.8); // More realistic variation
  const part_width_cm = Number((cubeSide * variationFactor).toFixed(2));
  const part_height_cm = Number((cubeSide * (0.8 + Math.random() * 0.6)).toFixed(2));
  const part_depth_cm = Number((cubeSide * (0.7 + Math.random() * 0.7)).toFixed(2));
  
  // Heuristic feature detection based on filename patterns
  const is_cylindrical = lowerName.match(/shaft|pulley|cylinder|rod|tube|bearing|bushing/i) !== null;
  const has_keyway = lowerName.match(/keyway|key|slot|groove/i) !== null;
  const has_flat_surfaces = lowerName.match(/bracket|plate|block|housing|mount/i) !== null;
  
  const detected_features: DetectedFeatures = {
    is_cylindrical,
    has_keyway,
    has_flat_surfaces,
    has_internal_holes: lowerName.match(/housing|bearing|bushing/i) !== null,
    requires_precision_boring: false,
    cylindricity_score: is_cylindrical ? 0.8 : 0,
    flat_surface_percentage: has_flat_surfaces ? 0.4 : 0.1,
    internal_surface_percentage: 0
  };
  
  const recommended_processes = detectRequiredProcesses(detected_features, complexity);
  
  console.log(`Enhanced Heuristic - Volume: ${estimatedVolume.toFixed(2)}cm³, Surface: ${estimatedSurfaceArea.toFixed(2)}cm², Complexity: ${complexity}/10`);
  console.log(`Heuristic Features:`, detected_features);
  console.log(`Recommended processes:`, recommended_processes);
  
  return {
    volume_cm3: Number(estimatedVolume.toFixed(2)),
    surface_area_cm2: Number(estimatedSurfaceArea.toFixed(2)),
    complexity_score: complexity,
    confidence: 0.7,
    method: 'enhanced_heuristic',
    part_width_cm,
    part_height_cm,
    part_depth_cm,
    detected_features,
    recommended_processes
  };
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let file_name: string;
    let file_size: number;
    let file_data: ArrayBuffer | null = null;
    let quantity: number = 1;

    // Handle both JSON (metadata only) and multipart/form-data (with file)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      file_name = formData.get('file_name') as string || file?.name || '';
      file_size = file?.size || 0;
      quantity = parseInt(formData.get('quantity') as string) || 1;
      
      if (file) {
        file_data = await file.arrayBuffer();
      }
    } else {
      const body = await req.json();
      file_name = body.file_name;
      file_size = body.file_size;
      quantity = body.quantity || 1;
    }
    
    if (!file_name || !file_size) {
      throw new Error('Missing required parameters: file_name and file_size');
    }

    console.log(`CAD Analysis request for: ${file_name} (${file_size} bytes)`);
    
    let analysis: AnalysisResult;
    
    // Use real STL parsing if we have the file data and it's an STL
    if (file_data && file_name.toLowerCase().endsWith('.stl')) {
      try {
        analysis = await analyzeSTL(file_data);
      } catch (error) {
        console.error('STL parsing failed, falling back to heuristic:', error);
        analysis = enhancedHeuristic(file_name, file_size);
      }
    } else {
      // Use enhanced heuristic for other formats or when no file data
      analysis = enhancedHeuristic(file_name, file_size);
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        ...analysis,
        quantity,
        detected_features: analysis.detected_features,
        recommended_processes: analysis.recommended_processes
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
