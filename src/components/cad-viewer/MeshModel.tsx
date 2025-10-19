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

export function MeshModel({ meshData, sectionPlane, sectionPosition, showEdges, showHiddenEdges = false, displayStyle = 'solid', topologyColors = false }: MeshModelProps) {
  // Create single unified geometry for professional solid rendering
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    geo.setIndex(meshData.indices);
    
    // Apply Fusion 360-style vertex colors
    if (topologyColors && meshData.face_types && meshData.face_types.length > 0) {
      console.log('🎨 Applying topology colors:', {
        faceTypesCount: meshData.face_types.length,
        verticesCount: meshData.vertices.length / 3,
        indicesCount: meshData.indices.length,
        faceTypesPreview: meshData.face_types.slice(0, 10)
      });
      
      const vertexCount = meshData.vertices.length / 3;
      const colors = new Float32Array(vertexCount * 3); // RGB for each vertex
      
      // Create a map to track face type for each vertex
      // Use priority: internal > planar > cylindrical > external > default
      const vertexFaceTypes = new Map<number, string>();
      const faceTypePriority: { [key: string]: number } = {
        'internal': 4,
        'planar': 3,
        'cylindrical': 2,
        'external': 1,
        'default': 0
      };
      
      // Iterate through triangles and map face_types to vertices
      for (let i = 0; i < meshData.indices.length; i += 3) {
        const triangleIndex = i / 3;
        
        // Get the three vertices of this triangle
        const v1 = meshData.indices[i];
        const v2 = meshData.indices[i + 1];
        const v3 = meshData.indices[i + 2];
        
        // Get face types for each vertex of this triangle
        const ft1 = meshData.face_types[triangleIndex * 3] || 'default';
        const ft2 = meshData.face_types[triangleIndex * 3 + 1] || 'default';
        const ft3 = meshData.face_types[triangleIndex * 3 + 2] || 'default';
        
        // Assign face type to vertices with priority (internal surfaces take precedence)
        [
          [v1, ft1],
          [v2, ft2],
          [v3, ft3]
        ].forEach(([vertexIdx, faceType]) => {
          const currentType = vertexFaceTypes.get(vertexIdx as number);
          if (!currentType || 
              faceTypePriority[faceType as string] > faceTypePriority[currentType]) {
            vertexFaceTypes.set(vertexIdx as number, faceType as string);
          }
        });
      }
      
      // Apply colors to vertices based on their face type
      for (let i = 0; i < vertexCount; i++) {
        const faceType = vertexFaceTypes.get(i) || 'default';
        let colorHex: string;
        
        switch (faceType) {
          case 'internal':
            colorHex = TOPOLOGY_COLORS.internal; // Coral red
            break;
          case 'cylindrical':
            colorHex = TOPOLOGY_COLORS.cylindrical; // Silver
            break;
          case 'planar':
            colorHex = TOPOLOGY_COLORS.planar; // Light grey
            break;
          case 'external':
            colorHex = TOPOLOGY_COLORS.external; // Silver
            break;
          default:
            colorHex = TOPOLOGY_COLORS.default;
        }
        
        const color = new THREE.Color(colorHex);
        const colorIndex = i * 3;
        colors[colorIndex] = color.r;
        colors[colorIndex + 1] = color.g;
        colors[colorIndex + 2] = color.b;
      }
      
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      // Log color distribution for debugging
      const colorCounts: { [key: string]: number } = {};
      vertexFaceTypes.forEach(ft => {
        colorCounts[ft] = (colorCounts[ft] || 0) + 1;
      });
      console.log('✅ Topology colors applied:', colorCounts);
    } else if (topologyColors) {
      console.warn('⚠️ Topology colors requested but face_types data is missing');
    }
    
    geo.computeVertexNormals(); // Smooth shading for professional appearance
    geo.normalizeNormals(); // Ensure uniform lighting across all faces
    geo.computeBoundingSphere();
    
    return geo;
  }, [meshData, topologyColors]);
  
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
      metalness: topologyColors ? 0 : 0,
      roughness: topologyColors ? 1 : 0.8,
      envMapIntensity: 0,
    };
    
    if (displayStyle === 'wireframe') {
      return { ...base, wireframe: true, transparent: false, opacity: 1 };
    } else if (displayStyle === 'translucent') {
      return { ...base, transparent: true, opacity: 0.4, wireframe: false };
    }
    
    return { ...base, transparent: false, opacity: 1, wireframe: false };
  }, [displayStyle, clippingPlane, topologyColors]);
  
  return (
    <group>
      {/* Render solid mesh (hide in wireframe mode) */}
      {displayStyle !== 'wireframe' && (
        <mesh geometry={geometry}>
          <meshStandardMaterial
            {...materialProps}
            color={topologyColors ? '#ffffff' : SOLID_COLOR}
            vertexColors={topologyColors}
            flatShading={false}
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
