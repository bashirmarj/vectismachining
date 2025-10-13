// Browser-based CAD geometry analysis using occt-import-js
import * as occtimportjs from 'occt-import-js';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Triangle {
  normal: Vector3;
  vertices: [Vector3, Vector3, Vector3];
}

export interface DetectedHole {
  type: 'hole';
  diameter_mm: number;
  depth_mm: number;
  through: boolean;
  position: [number, number, number];
  axis: [number, number, number];
  orientation: string;
}

export interface DetectedGroove {
  type: 'groove';
  inner_diameter_mm: number;
  outer_diameter_mm: number;
  depth_mm: number;
  location: 'external' | 'internal';
  orientation: string;
}

export interface DetectedFlat {
  type: 'flat';
  orientation: string;
  area_mm2: number;
  width_mm: number;
  length_mm: number;
}

export interface PrimaryDimensions {
  major_diameter_mm?: number;
  minor_diameter_mm?: number;
  length_mm: number;
  width_mm?: number;
  height_mm?: number;
  primary_axis: 'X' | 'Y' | 'Z';
}

export interface DetailedFeatures {
  holes: DetectedHole[];
  grooves: DetectedGroove[];
  flat_surfaces: DetectedFlat[];
  primary_dimensions: PrimaryDimensions;
}

export interface DetectedFeatures {
  is_cylindrical: boolean;
  has_keyway: boolean;
  has_flat_surfaces: boolean;
  has_internal_holes: boolean;
  requires_precision_boring: boolean;
  cylindricity_score: number;
  flat_surface_percentage: number;
  internal_surface_percentage: number;
}

export interface FeatureTree {
  common_dimensions: Array<{
    label: string;
    value: number;
    unit: string;
  }>;
  oriented_sections: Array<{
    orientation: string;
    features: Array<DetectedHole | DetectedGroove | DetectedFlat>;
  }>;
}

export interface GeometryAnalysisResult {
  volume_cm3: number;
  surface_area_cm2: number;
  complexity_score: number;
  confidence: number;
  method: string;
  part_width_cm: number;
  part_height_cm: number;
  part_depth_cm: number;
  triangle_count: number;
  detected_features: DetectedFeatures;
  recommended_processes: string[];
  detailed_features?: DetailedFeatures;
  feature_tree?: FeatureTree;
  triangles?: Triangle[]; // For 3D rendering
}

let occtInstance: any = null;
let occtInitializing: Promise<any> | null = null;

// Initialize OpenCascade WebAssembly with proper configuration
async function getOCCT(): Promise<any> {
  if (occtInstance) {
    return occtInstance;
  }
  
  // If already initializing, wait for that promise
  if (occtInitializing) {
    return occtInitializing;
  }
  
  occtInitializing = (async () => {
    try {
      console.log('Initializing OpenCascade WASM...');
      
      // occt-import-js exports a function that returns a promise
      // In ES6 modules, we need to access it correctly
      const initFunction = (occtimportjs as any).default || occtimportjs;
      
      const instance = await initFunction({
        locateFile: (path: string) => {
          // Help the WASM loader find the right file
          if (path.endsWith('.wasm')) {
            // Use node_modules path for development
            return `/node_modules/occt-import-js/dist/${path}`;
          }
          return path;
        }
      });
      
      console.log('OpenCascade WASM initialized successfully');
      occtInstance = instance;
      occtInitializing = null;
      return instance;
    } catch (error) {
      occtInitializing = null;
      console.error('OpenCascade initialization failed:', error);
      throw new Error('Failed to initialize 3D engine. Please refresh the page and try again.');
    }
  })();
  
  return occtInitializing;
}

// Parse STEP/IGES file using occt-import-js
export async function parseCADFile(file: File): Promise<GeometryAnalysisResult | null> {
  const fileName = file.name.toLowerCase();
  
  // Check if it's a supported format
  if (fileName.endsWith('.stl')) {
    return parseSTLFile(file);
  } else if (fileName.endsWith('.step') || fileName.endsWith('.stp') || 
             fileName.endsWith('.iges') || fileName.endsWith('.igs')) {
    return parseSTEPIGESFile(file);
  }
  
  return null;
}

// Parse STL file (existing functionality)
async function parseSTLFile(file: File): Promise<GeometryAnalysisResult> {
  const arrayBuffer = await file.arrayBuffer();
  const triangles = parseSTLBinary(arrayBuffer);
  
  return analyzeTriangles(triangles, 'STL (Real Geometry)');
}

// Parse STEP/IGES file using OpenCascade
async function parseSTEPIGESFile(file: File): Promise<GeometryAnalysisResult> {
  console.log(`Starting STEP/IGES parsing for ${file.name}...`);
  
  const occt = await getOCCT();
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);
  
  console.log(`File loaded: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`);
  
  // Read the CAD file
  const fileType = file.name.toLowerCase().endsWith('.step') || file.name.toLowerCase().endsWith('.stp') 
    ? 'step' : 'iges';
  
  console.log(`Parsing as ${fileType.toUpperCase()}...`);
  
  let result;
  try {
    if (fileType === 'step') {
      result = occt.ReadStepFile(uint8Array, null);
    } else {
      result = occt.ReadIgesFile(uint8Array, null);
    }
  } catch (error) {
    console.error('OCCT parsing error:', error);
    throw new Error(`Failed to parse ${fileType.toUpperCase()} file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  if (!result.success || !result.meshes || result.meshes.length === 0) {
    throw new Error(`No valid geometry found in ${fileType.toUpperCase()} file`);
  }
  
  console.log(`Successfully read ${fileType.toUpperCase()}, found ${result.meshes.length} mesh(es)`);
  
  // Convert OCCT mesh to our triangle format
  const triangles: Triangle[] = [];
  
  for (const mesh of result.meshes) {
    const positions = mesh.attributes.position.array; // Float32Array of vertices
    const normals = mesh.attributes.normal?.array; // Float32Array of normals
    const indices = mesh.index?.array; // Uint32Array of triangle indices
    
    if (indices) {
      // Indexed geometry
      for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i] * 3;
        const i2 = indices[i + 1] * 3;
        const i3 = indices[i + 2] * 3;
        
        const v1: Vector3 = { x: positions[i1], y: positions[i1 + 1], z: positions[i1 + 2] };
        const v2: Vector3 = { x: positions[i2], y: positions[i2 + 1], z: positions[i2 + 2] };
        const v3: Vector3 = { x: positions[i3], y: positions[i3 + 1], z: positions[i3 + 2] };
        
        // Calculate normal if not provided
        let normal: Vector3;
        if (normals) {
          normal = { x: normals[i1], y: normals[i1 + 1], z: normals[i1 + 2] };
        } else {
          normal = calculateNormal(v1, v2, v3);
        }
        
        triangles.push({ normal, vertices: [v1, v2, v3] });
      }
    } else {
      // Non-indexed geometry
      for (let i = 0; i < positions.length; i += 9) {
        const v1: Vector3 = { x: positions[i], y: positions[i + 1], z: positions[i + 2] };
        const v2: Vector3 = { x: positions[i + 3], y: positions[i + 4], z: positions[i + 5] };
        const v3: Vector3 = { x: positions[i + 6], y: positions[i + 7], z: positions[i + 8] };
        
        let normal: Vector3;
        if (normals) {
          normal = { x: normals[i], y: normals[i + 1], z: normals[i + 2] };
        } else {
          normal = calculateNormal(v1, v2, v3);
        }
        
        triangles.push({ normal, vertices: [v1, v2, v3] });
      }
    }
  }
  
  return analyzeTriangles(triangles, `${fileType.toUpperCase()} (Real Geometry)`);
}

// Calculate normal from three vertices
function calculateNormal(v1: Vector3, v2: Vector3, v3: Vector3): Vector3 {
  const edge1 = { x: v2.x - v1.x, y: v2.y - v1.y, z: v2.z - v1.z };
  const edge2 = { x: v3.x - v1.x, y: v3.y - v1.y, z: v3.z - v1.z };
  
  const cross = {
    x: edge1.y * edge2.z - edge1.z * edge2.y,
    y: edge1.z * edge2.x - edge1.x * edge2.z,
    z: edge1.x * edge2.y - edge1.y * edge2.x
  };
  
  const length = Math.sqrt(cross.x * cross.x + cross.y * cross.y + cross.z * cross.z);
  
  return {
    x: cross.x / length,
    y: cross.y / length,
    z: cross.z / length
  };
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

// Analyze triangles to extract geometry data
function analyzeTriangles(triangles: Triangle[], method: string): GeometryAnalysisResult {
  const bbox = getBoundingBox(triangles);
  const volume_cm3 = calculateVolume(triangles);
  const surface_area_cm2 = calculateSurfaceArea(triangles);
  const complexity_score = calculateComplexity(triangles, bbox);
  
  const part_width_cm = (bbox.max.x - bbox.min.x) / 10;
  const part_height_cm = (bbox.max.y - bbox.min.y) / 10;
  const part_depth_cm = (bbox.max.z - bbox.min.z) / 10;
  
  const cylindricalResult = isCylindricalPart(triangles, bbox);
  const flatSurfacesResult = hasFlatSurfaces(triangles);
  const internalHolesResult = hasInternalHoles(triangles, bbox);
  const has_keyway = hasKeyway(triangles);
  
  const detected_features: DetectedFeatures = {
    is_cylindrical: cylindricalResult.is_cylindrical,
    has_keyway,
    has_flat_surfaces: flatSurfacesResult.has_flat,
    has_internal_holes: internalHolesResult.has_holes,
    requires_precision_boring: internalHolesResult.has_holes,
    cylindricity_score: cylindricalResult.score,
    flat_surface_percentage: flatSurfacesResult.percentage,
    internal_surface_percentage: internalHolesResult.percentage
  };
  
  const recommended_processes = detectRequiredProcesses(detected_features, complexity_score);
  const detailed_features = detectDetailedFeatures(triangles, bbox, detected_features);
  const feature_tree = buildFeatureTree(detailed_features);
  
  return {
    volume_cm3,
    surface_area_cm2,
    complexity_score,
    confidence: 0.95, // High confidence for real geometry
    method,
    part_width_cm,
    part_height_cm,
    part_depth_cm,
    triangle_count: triangles.length,
    detected_features,
    recommended_processes,
    detailed_features,
    feature_tree,
    triangles // Include for 3D rendering
  };
}

// Calculate volume using signed tetrahedron method
function calculateVolume(triangles: Triangle[]): number {
  let volume = 0;
  
  for (const triangle of triangles) {
    const [v1, v2, v3] = triangle.vertices;
    volume += (v1.x * v2.y * v3.z - v1.x * v3.y * v2.z - 
               v2.x * v1.y * v3.z + v2.x * v3.y * v1.z + 
               v3.x * v1.y * v2.z - v3.x * v2.y * v1.z) / 6;
  }
  
  return Math.abs(volume) / 1000; // Convert mm³ to cm³
}

// Calculate surface area
function calculateSurfaceArea(triangles: Triangle[]): number {
  let area = 0;
  
  for (const triangle of triangles) {
    area += getTriangleArea(triangle);
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
  
  let complexity = Math.min(Math.log10(triangleCount) * 2, 10);
  
  const normalVariations = new Set<string>();
  for (const triangle of triangles) {
    const normalKey = `${triangle.normal.x.toFixed(1)},${triangle.normal.y.toFixed(1)},${triangle.normal.z.toFixed(1)}`;
    normalVariations.add(normalKey);
  }
  const normalComplexity = Math.min(normalVariations.size / 100, 3);
  
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const depth = bbox.max.z - bbox.min.z;
  const aspectRatio = Math.max(width, height, depth) / Math.min(width, height, depth);
  const aspectComplexity = Math.min(aspectRatio / 5, 2);
  
  return Math.min(Math.round(complexity + normalComplexity + aspectComplexity), 10);
}

// Detect if part is cylindrical
function isCylindricalPart(triangles: Triangle[], bbox: { min: Vector3; max: Vector3 }): { is_cylindrical: boolean; score: number } {
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const depth = bbox.max.z - bbox.min.z;
  
  const aspectRatioXY = Math.max(width, height) / Math.min(width, height);
  const aspectRatioXZ = Math.max(width, depth) / Math.min(width, depth);
  const aspectRatioYZ = Math.max(height, depth) / Math.min(height, depth);
  
  const cylindricalScore = Math.min(aspectRatioXY, aspectRatioXZ, aspectRatioYZ);
  
  let radialNormals = 0;
  for (const tri of triangles) {
    const n = tri.normal;
    const radialStrength = Math.sqrt(n.x * n.x + n.y * n.y);
    if (radialStrength > 0.7) radialNormals++;
  }
  const radialPercentage = radialNormals / triangles.length;
  
  const is_cylindrical = cylindricalScore < 1.3 && radialPercentage > 0.4;
  
  return { is_cylindrical, score: is_cylindrical ? (1 - (cylindricalScore - 1)) : 0 };
}

// Detect keyway features
function hasKeyway(triangles: Triangle[]): boolean {
  let horizontalSurfaces = 0;
  let verticalWalls = 0;
  let totalArea = 0;
  
  for (const tri of triangles) {
    const n = tri.normal;
    const area = getTriangleArea(tri);
    totalArea += area;
    
    if (Math.abs(n.z) > 0.9) horizontalSurfaces += area;
    if (Math.abs(n.x) > 0.9 || Math.abs(n.y) > 0.9) verticalWalls += area;
  }
  
  const wallPercentage = verticalWalls / totalArea;
  const floorPercentage = horizontalSurfaces / totalArea;
  
  return wallPercentage > 0.15 && floorPercentage > 0.05;
}

// Detect flat surfaces
function hasFlatSurfaces(triangles: Triangle[]): { has_flat: boolean; percentage: number } {
  let flatArea = 0;
  let totalArea = 0;
  
  for (const tri of triangles) {
    const n = tri.normal;
    const area = getTriangleArea(tri);
    totalArea += area;
    
    if (Math.abs(n.x) > 0.95 || Math.abs(n.y) > 0.95 || Math.abs(n.z) > 0.95) {
      flatArea += area;
    }
  }
  
  const percentage = flatArea / totalArea;
  return { has_flat: percentage > 0.2, percentage };
}

// Detect internal holes
function hasInternalHoles(triangles: Triangle[], bbox: { min: Vector3; max: Vector3 }): { has_holes: boolean; percentage: number } {
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
    
    const triCentroid = {
      x: (tri.vertices[0].x + tri.vertices[1].x + tri.vertices[2].x) / 3,
      y: (tri.vertices[0].y + tri.vertices[1].y + tri.vertices[2].y) / 3,
      z: (tri.vertices[0].z + tri.vertices[1].z + tri.vertices[2].z) / 3
    };
    
    const toCenter = {
      x: centroid.x - triCentroid.x,
      y: centroid.y - triCentroid.y,
      z: centroid.z - triCentroid.z
    };
    
    const dotProduct = tri.normal.x * toCenter.x + tri.normal.y * toCenter.y + tri.normal.z * toCenter.z;
    if (dotProduct > 0) inwardArea += area;
  }
  
  const percentage = inwardArea / totalArea;
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

// Determine required processes
function detectRequiredProcesses(features: DetectedFeatures, complexity: number): string[] {
  const processes: string[] = [];
  
  if (features.is_cylindrical) {
    processes.push('CNC Lathe');
    
    const isSimpleTurnedPart = complexity <= 3 && 
                                !features.has_keyway && 
                                !features.has_flat_surfaces && 
                                !features.has_internal_holes &&
                                !features.requires_precision_boring;
    
    if (!isSimpleTurnedPart) {
      processes.push('VMC Machining');
    }
  } else {
    processes.push('VMC Machining');
  }
  
  if (features.has_keyway && !processes.includes('Key way')) {
    processes.push('Key way');
  }
  
  return processes.length > 0 ? processes : ['VMC Machining'];
}

// Detect detailed features
function detectDetailedFeatures(
  triangles: Triangle[], 
  bbox: { min: Vector3; max: Vector3 },
  features: DetectedFeatures
): DetailedFeatures {
  const holes: DetectedHole[] = [];
  const grooves: DetectedGroove[] = [];
  const flat_surfaces: DetectedFlat[] = [];
  
  // Detect flat surfaces by orientation
  const flatsByOrientation: Map<string, { area: number; triangles: Triangle[] }> = new Map();
  
  for (const tri of triangles) {
    const n = tri.normal;
    
    // Classify by dominant normal direction
    let orientation = '';
    if (Math.abs(n.z) > 0.95) orientation = n.z > 0 ? 'Top' : 'Bottom';
    else if (Math.abs(n.x) > 0.95) orientation = n.x > 0 ? 'Right' : 'Left';
    else if (Math.abs(n.y) > 0.95) orientation = n.y > 0 ? 'Front' : 'Back';
    
    if (orientation) {
      const existing = flatsByOrientation.get(orientation) || { area: 0, triangles: [] };
      existing.area += getTriangleArea(tri);
      existing.triangles.push(tri);
      flatsByOrientation.set(orientation, existing);
    }
  }
  
  // Create flat surface features
  for (const [orientation, data] of flatsByOrientation.entries()) {
    if (data.area > 100) { // Minimum area threshold (100 mm²)
      flat_surfaces.push({
        type: 'flat',
        orientation,
        area_mm2: data.area,
        width_mm: 0, // Would need more analysis
        length_mm: 0
      });
    }
  }
  
  // Calculate primary dimensions
  const width = bbox.max.x - bbox.min.x;
  const height = bbox.max.y - bbox.min.y;
  const depth = bbox.max.z - bbox.min.z;
  
  let primary_axis: 'X' | 'Y' | 'Z' = 'Z';
  let length_mm = depth;
  
  if (features.is_cylindrical) {
    // For cylindrical parts, longest dimension is the axis
    if (width >= height && width >= depth) {
      primary_axis = 'X';
      length_mm = width;
    } else if (height >= width && height >= depth) {
      primary_axis = 'Y';
      length_mm = height;
    }
  }
  
  const primary_dimensions: PrimaryDimensions = {
    length_mm,
    width_mm: width,
    height_mm: height,
    primary_axis
  };
  
  if (features.is_cylindrical) {
    const diameter = Math.min(width, height, depth);
    primary_dimensions.major_diameter_mm = diameter;
  }
  
  return {
    holes,
    grooves,
    flat_surfaces,
    primary_dimensions
  };
}

// Build feature tree
function buildFeatureTree(features: DetailedFeatures): FeatureTree {
  const common_dimensions: Array<{label: string; value: number; unit: string}> = [];
  
  const dims = features.primary_dimensions;
  if (dims.major_diameter_mm) {
    common_dimensions.push({
      label: 'Outer Diameter',
      value: dims.major_diameter_mm,
      unit: 'mm'
    });
  }
  
  if (dims.length_mm) {
    common_dimensions.push({
      label: 'Length',
      value: dims.length_mm,
      unit: 'mm'
    });
  }
  
  if (dims.width_mm && !dims.major_diameter_mm) {
    common_dimensions.push({
      label: 'Width',
      value: dims.width_mm,
      unit: 'mm'
    });
  }
  
  if (dims.height_mm && !dims.major_diameter_mm) {
    common_dimensions.push({
      label: 'Height',
      value: dims.height_mm,
      unit: 'mm'
    });
  }
  
  // Group features by orientation
  const orientationMap: Map<string, Array<DetectedHole | DetectedGroove | DetectedFlat>> = new Map();
  
  for (const hole of features.holes) {
    const key = hole.orientation || 'Axial';
    const existing = orientationMap.get(key) || [];
    existing.push(hole);
    orientationMap.set(key, existing);
  }
  
  for (const groove of features.grooves) {
    const key = groove.orientation || 'External';
    const existing = orientationMap.get(key) || [];
    existing.push(groove);
    orientationMap.set(key, existing);
  }
  
  for (const flat of features.flat_surfaces) {
    const key = flat.orientation;
    const existing = orientationMap.get(key) || [];
    existing.push(flat);
    orientationMap.set(key, existing);
  }
  
  const oriented_sections: Array<{
    orientation: string;
    features: Array<DetectedHole | DetectedGroove | DetectedFlat>;
  }> = [];
  
  for (const [orientation, featureList] of orientationMap.entries()) {
    oriented_sections.push({
      orientation,
      features: featureList
    });
  }
  
  return {
    common_dimensions,
    oriented_sections
  };
}
