import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  face_types?: string[];
  triangle_count: number;
  feature_edges?: number[][][];
}

interface MeshModelProps {
  meshData: MeshData;
  sectionPlane: 'none' | 'xy' | 'xz' | 'yz';
  sectionPosition: number;
  showEdges: boolean;
  showHiddenEdges?: boolean;
  displayStyle?: 'solid' | 'wireframe' | 'translucent';
  topologyColors?: boolean;
}

// Professional solid color for CAD rendering
const SOLID_COLOR = '#5b9bd5'; // Professional CAD blue

// Fusion 360 Analysis colors
const TOPOLOGY_COLORS = {
  internal: '#FF6B6B',      // Coral Red for internal surfaces/pockets
  cylindrical: '#CCCCCC',   // Silver for outer cylindrical surfaces
  planar: '#DDDDDD',        // Light Grey for flat faces
  external: '#CCCCCC',      // Silver for other outer surfaces
  default: '#CCCCCC'        // Default silver
};

// Geometry analysis helpers for face classification
function calculateBoundingBox(vertices: number[]): { center: THREE.Vector3, max: THREE.Vector3, min: THREE.Vector3 } {
  const positions = [];
  for (let i = 0; i < vertices.length; i += 3) {
    positions.push(new THREE.Vector3(vertices[i], vertices[i+1], vertices[i+2]));
  }
  
  const box = new THREE.Box3().setFromPoints(positions);
  const center = new THREE.Vector3();
  box.getCenter(center);
  
  return { center, max: box.max, min: box.min };
}

function classifyFaceType(
  v1: THREE.Vector3, 
  v2: THREE.Vector3, 
  v3: THREE.Vector3,
  n: THREE.Vector3,
  center: THREE.Vector3,
  maxRadius: number
): string {
  // Calculate triangle center
  const faceCenter = new THREE.Vector3()
    .add(v1).add(v2).add(v3)
    .divideScalar(3);
  
  // Vector from part center to face center
  const toCenter = new THREE.Vector3()
    .subVectors(center, faceCenter)
    .normalize();
  
  // Dot product: >0 means normal points toward center (internal)
  const dot = n.dot(toCenter);
  
  // Calculate distance from center (for cylindrical detection)
  const distFromCenter = faceCenter.distanceTo(center);
  
  // Calculate edge lengths to detect surface type
  const edge1 = v2.distanceTo(v1);
  const edge2 = v3.distanceTo(v2);
  const edge3 = v1.distanceTo(v3);
  const avgEdge = (edge1 + edge2 + edge3) / 3;
  
  // Classification rules (stricter than backend):
  
  // Rule 1: Strongly inward-facing surfaces (dot > 0.7) = internal
  if (dot > 0.7) {
    return 'internal';
  }
  
  // Rule 2: Small cylindrical features close to center = internal holes
  // Check if surface is cylindrical by checking if it's curved but roughly constant distance
  const isCylindrical = Math.abs(edge1 - edge2) < avgEdge * 0.3 && 
                        Math.abs(edge2 - edge3) < avgEdge * 0.3;
  
  if (isCylindrical && distFromCenter < maxRadius * 0.4 && dot > 0.3) {
    return 'internal'; // Small holes/bores
  }
  
  // Rule 3: Outward-facing cylindrical surfaces = cylindrical (outer surface)
  if (isCylindrical && dot < -0.3) {
    return 'cylindrical';
  }
  
  // Rule 4: Nearly flat surfaces (normal variation check would go here)
  // For now, use dot product as proxy
  if (Math.abs(dot) < 0.3) {
    return 'planar'; // Perpendicular to center vector = likely planar
  }
  
  // Rule 5: Outward-facing = external
  if (dot < -0.5) {
    return 'external';
  }
  
  // Default: external (be conservative)
  return 'external';
}

export function MeshModel({ meshData, sectionPlane, sectionPosition, showEdges, showHiddenEdges = false, displayStyle = 'solid', topologyColors = true }: MeshModelProps) {
  // Create single unified geometry for professional solid rendering
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    geo.setIndex(meshData.indices);
    
    // Only compute smooth normals when NOT using topology colors
    if (!topologyColors) {
      geo.computeVertexNormals();
      geo.normalizeNormals();
    }
    geo.computeBoundingSphere();
    
    return geo;
  }, [meshData, topologyColors]);
  
  // Apply vertex colors with frontend classification
  useEffect(() => {
    if (!geometry) return;
    
    if (topologyColors && meshData.normals && meshData.normals.length > 0) {
      console.log('🎨 Recomputing face types and applying vertex colors');
      
      const vertices = meshData.vertices;
      const indices = meshData.indices;
      const normals = meshData.normals;
      const vertexCount = vertices.length / 3;
      
      // Calculate bounding box and center
      const bbox = calculateBoundingBox(vertices);
      const center = bbox.center;
      const size = bbox.max.distanceTo(bbox.min);
      const maxRadius = size / 2;
      
      console.log(`Part center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
      console.log(`Max radius: ${maxRadius.toFixed(2)}`);
      
      // Compute face type for each triangle
      const vertexFaceTypes = new Map<number, string>();
      const faceTypePriority: { [key: string]: number } = {
        'internal': 4,    // Highest priority (most specific)
        'planar': 3,
        'cylindrical': 2,
        'external': 1,
        'default': 0
      };
      
      // Analyze each triangle
      for (let i = 0; i < indices.length; i += 3) {
        const idx1 = indices[i];
        const idx2 = indices[i + 1];
        const idx3 = indices[i + 2];
        
        // Get vertices
        const v1 = new THREE.Vector3(vertices[idx1*3], vertices[idx1*3+1], vertices[idx1*3+2]);
        const v2 = new THREE.Vector3(vertices[idx2*3], vertices[idx2*3+1], vertices[idx2*3+2]);
        const v3 = new THREE.Vector3(vertices[idx3*3], vertices[idx3*3+1], vertices[idx3*3+2]);
        
        // Get average normal for this triangle
        const n1 = new THREE.Vector3(normals[idx1*3], normals[idx1*3+1], normals[idx1*3+2]);
        const n2 = new THREE.Vector3(normals[idx2*3], normals[idx2*3+1], normals[idx2*3+2]);
        const n3 = new THREE.Vector3(normals[idx3*3], normals[idx3*3+1], normals[idx3*3+2]);
        const avgNormal = new THREE.Vector3()
          .add(n1).add(n2).add(n3)
          .divideScalar(3)
          .normalize();
        
        // Classify this triangle
        const faceType = classifyFaceType(v1, v2, v3, avgNormal, center, maxRadius);
        
        // Assign to vertices with priority system
        [idx1, idx2, idx3].forEach(vertexIdx => {
          const currentType = vertexFaceTypes.get(vertexIdx);
          if (!currentType || faceTypePriority[faceType] > faceTypePriority[currentType]) {
            vertexFaceTypes.set(vertexIdx, faceType);
          }
        });
      }
      
      // Apply colors
      const colors = new Float32Array(vertexCount * 3);
      const typeCount: { [key: string]: number } = {};
      
      for (let i = 0; i < vertexCount; i++) {
        const faceType = vertexFaceTypes.get(i) || 'default';
        typeCount[faceType] = (typeCount[faceType] || 0) + 1;
        
        const colorHex = TOPOLOGY_COLORS[faceType as keyof typeof TOPOLOGY_COLORS] || TOPOLOGY_COLORS.default;
        const color = new THREE.Color(colorHex);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      
      console.log('Face type distribution:', typeCount);
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.attributes.color.needsUpdate = true;
      
      console.log('✅ Vertex colors applied with frontend classification');
    } else {
      // Remove color attribute when topology colors are disabled
      if (geometry.attributes.color) {
        console.log('🧹 Removing vertex colors from geometry');
        geometry.deleteAttribute('color');
      }
    }
  }, [geometry, topologyColors, meshData]);
  
  // Create feature edges from BREP data (true CAD edges, not mesh tessellation)
  const featureEdges = useMemo(() => {
    if (!showEdges && displayStyle !== 'wireframe') return null;
    
    // Check if backend provided BREP feature edges
    if (!meshData.feature_edges || meshData.feature_edges.length === 0) {
      console.warn('No BREP feature edges available from backend');
      return null;
    }
    
    // Convert BREP edge polylines to Three.js line segments
    const positions: number[] = [];
    
    meshData.feature_edges.forEach((edge: number[][]) => {
      // Each edge is an array of [x, y, z] points representing a polyline
      for (let i = 0; i < edge.length - 1; i++) {
        // Add line segment from point i to point i+1
        positions.push(...edge[i], ...edge[i + 1]);
      }
    });
    
    if (positions.length === 0) return null;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    return geometry;
  }, [meshData.feature_edges, showEdges, displayStyle]);

  
  // Section cut plane
  const clippingPlane = useMemo(() => {
    if (sectionPlane === 'none') return undefined;
    
    let normal: THREE.Vector3;
    switch (sectionPlane) {
      case 'xy': // Cut along Z-axis (shows XY plane)
        normal = new THREE.Vector3(0, 0, 1);
        break;
      case 'xz': // Cut along Y-axis (shows XZ plane)
        normal = new THREE.Vector3(0, 1, 0);
        break;
      case 'yz': // Cut along X-axis (shows YZ plane)
        normal = new THREE.Vector3(1, 0, 0);
        break;
      default:
        return undefined;
    }
    
    return [new THREE.Plane(normal, -sectionPosition)];
  }, [sectionPlane, sectionPosition]);
  
  // Update Three.js renderer clipping settings when section plane changes
  const { gl } = useThree();
  
  useEffect(() => {
    gl.localClippingEnabled = sectionPlane !== 'none';
    gl.clippingPlanes = [];
  }, [sectionPlane, gl]);
  
  // Calculate material properties based on display style
  const materialProps = useMemo(() => {
    const base = {
      color: '#5b9bd5',
      side: THREE.DoubleSide,
      clippingPlanes: clippingPlane,
      clipIntersection: false,
      metalness: 0,
      roughness: 0.8,
      envMapIntensity: 0,
    };
    
    if (displayStyle === 'wireframe') {
      return { ...base, wireframe: true, transparent: false, opacity: 1 };
    } else if (displayStyle === 'translucent') {
      return { ...base, transparent: true, opacity: 0.4, wireframe: false };
    }
    
    return { ...base, transparent: false, opacity: 1, wireframe: false };
  }, [displayStyle, clippingPlane]);
  
  return (
    <group>
      {/* Render solid mesh (hide in wireframe mode) */}
      {displayStyle !== 'wireframe' && (
        <mesh geometry={geometry}>
          <meshStandardMaterial
            {...materialProps}
            color={topologyColors ? '#ffffff' : SOLID_COLOR}
            vertexColors={topologyColors}
            flatShading={topologyColors}
            toneMapped={false}
          />
        </mesh>
      )}
      
      {/* Render BREP feature edges (true CAD edges from backend) */}
      {featureEdges && (
        <lineSegments geometry={featureEdges}>
          <lineBasicMaterial 
            color="#000000" 
            linewidth={1}
            clippingPlanes={clippingPlane}
            clipIntersection={false}
          />
        </lineSegments>
      )}
    </group>
  );
}
