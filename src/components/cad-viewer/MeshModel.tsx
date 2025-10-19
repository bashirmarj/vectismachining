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
  
  // Apply vertex colors using backend BREP face types
  useEffect(() => {
    if (!geometry) return;
    
    if (topologyColors && meshData.face_types && meshData.face_types.length > 0) {
      console.log('🎨 Applying backend BREP face types as vertex colors');
      
      const vertexCount = meshData.vertices.length / 3;
      const indices = meshData.indices;
      
      // Backend sends one face_type per vertex
      if (meshData.face_types.length !== vertexCount) {
        console.error(`❌ Face types length mismatch: ${meshData.face_types.length} vs ${vertexCount} vertices`);
        return;
      }
      
      // Priority system for vertices at boundaries between different face types
      const vertexFaceTypes = new Map<number, string>();
      const faceTypePriority: { [key: string]: number } = {
        'internal': 4,
        'planar': 3,
        'cylindrical': 2,
        'external': 1,
        'default': 0
      };
      
      // For each triangle, assign face types to vertices with priority
      for (let i = 0; i < indices.length; i += 3) {
        const idx1 = indices[i];
        const idx2 = indices[i + 1];
        const idx3 = indices[i + 2];
        
        // Get face types from backend for these 3 vertices
        const ft1 = meshData.face_types[idx1] || 'default';
        const ft2 = meshData.face_types[idx2] || 'default';
        const ft3 = meshData.face_types[idx3] || 'default';
        
        // Apply priority system
        [[idx1, ft1], [idx2, ft2], [idx3, ft3]].forEach(([vertexIdx, faceType]) => {
          const currentType = vertexFaceTypes.get(vertexIdx as number);
          if (!currentType || faceTypePriority[faceType as string] > faceTypePriority[currentType]) {
            vertexFaceTypes.set(vertexIdx as number, faceType as string);
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
      
      console.log('Backend face type distribution:', typeCount);
      
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.attributes.color.needsUpdate = true;
      
      console.log('✅ Vertex colors applied from backend BREP analysis');
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
