import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  vertex_colors?: string[];
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
    
    if (!topologyColors) {
      // Standard indexed geometry with smooth normals
      geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geo.setIndex(meshData.indices);
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
      geo.computeVertexNormals();
      geo.normalizeNormals();
    } else {
      // Non-indexed geometry for face colors - duplicate vertices per triangle
      const triangleCount = meshData.indices.length / 3;
      const positions = new Float32Array(triangleCount * 9); // 3 vertices * 3 coords
      
      for (let i = 0; i < triangleCount; i++) {
        const idx0 = meshData.indices[i * 3];
        const idx1 = meshData.indices[i * 3 + 1];
        const idx2 = meshData.indices[i * 3 + 2];
        
        // Copy vertex positions for this triangle
        positions[i * 9 + 0] = meshData.vertices[idx0 * 3];
        positions[i * 9 + 1] = meshData.vertices[idx0 * 3 + 1];
        positions[i * 9 + 2] = meshData.vertices[idx0 * 3 + 2];
        
        positions[i * 9 + 3] = meshData.vertices[idx1 * 3];
        positions[i * 9 + 4] = meshData.vertices[idx1 * 3 + 1];
        positions[i * 9 + 5] = meshData.vertices[idx1 * 3 + 2];
        
        positions[i * 9 + 6] = meshData.vertices[idx2 * 3];
        positions[i * 9 + 7] = meshData.vertices[idx2 * 3 + 1];
        positions[i * 9 + 8] = meshData.vertices[idx2 * 3 + 2];
      }
      
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      // No setIndex() - non-indexed geometry
      // No normals - Three.js will compute flat normals automatically
    }
    
    geo.computeBoundingSphere();
    
    return geo;
  }, [meshData, topologyColors]);
  
  // Helper function to create consistent edge keys
  const makeEdgeKey = (v1: number[], v2: number[]): string => {
    const precision = 4;
    const p1 = [
      parseFloat(v1[0].toFixed(precision)),
      parseFloat(v1[1].toFixed(precision)),
      parseFloat(v1[2].toFixed(precision))
    ];
    const p2 = [
      parseFloat(v2[0].toFixed(precision)),
      parseFloat(v2[1].toFixed(precision)),
      parseFloat(v2[2].toFixed(precision))
    ];
    
    const [pA, pB] = p1[0] < p2[0] || (p1[0] === p2[0] && p1[1] < p2[1]) || (p1[0] === p2[0] && p1[1] === p2[1] && p1[2] < p2[2])
      ? [p1, p2]
      : [p2, p1];
    
    return `${pA[0]},${pA[1]},${pA[2]}|${pB[0]},${pB[1]},${pB[2]}`;
  };

  // Apply edge-based face grouping for solid colors
  useEffect(() => {
    if (!geometry) return;
    
    if (topologyColors) {
      if (meshData.vertex_colors && meshData.vertex_colors.length > 0) {
        console.log('🎨 Applying edge-based face grouping');
        
        const triangleCount = meshData.indices.length / 3;
        
        // STEP 1: Build feature edge lookup
        const featureEdgeSet = new Set<string>();
        if (meshData.feature_edges) {
          meshData.feature_edges.forEach((edgePolyline: number[][]) => {
            for (let i = 0; i < edgePolyline.length - 1; i++) {
              const p1 = edgePolyline[i];
              const p2 = edgePolyline[i + 1];
              const key = makeEdgeKey(p1, p2);
              featureEdgeSet.add(key);
            }
          });
        }
        console.log(`Found ${featureEdgeSet.size} feature edges`);
        
        // STEP 2: Build triangle adjacency graph
        const triangleEdges = new Map<number, Array<number[]>>();
        const edgeToTriangles = new Map<string, number[]>();
        
        for (let triIdx = 0; triIdx < triangleCount; triIdx++) {
          const idx0 = meshData.indices[triIdx * 3];
          const idx1 = meshData.indices[triIdx * 3 + 1];
          const idx2 = meshData.indices[triIdx * 3 + 2];
          
          const v0 = [meshData.vertices[idx0*3], meshData.vertices[idx0*3+1], meshData.vertices[idx0*3+2]];
          const v1 = [meshData.vertices[idx1*3], meshData.vertices[idx1*3+1], meshData.vertices[idx1*3+2]];
          const v2 = [meshData.vertices[idx2*3], meshData.vertices[idx2*3+1], meshData.vertices[idx2*3+2]];
          
          triangleEdges.set(triIdx, [v0, v1, v2]);
          
          // Store edge->triangle mappings
          const edges = [
            makeEdgeKey(v0, v1),
            makeEdgeKey(v1, v2),
            makeEdgeKey(v2, v0)
          ];
          
          edges.forEach(edgeKey => {
            if (!edgeToTriangles.has(edgeKey)) {
              edgeToTriangles.set(edgeKey, []);
            }
            edgeToTriangles.get(edgeKey)!.push(triIdx);
          });
        }
        
        // STEP 3: Connected components (flood fill)
        const visited = new Set<number>();
        const faceGroups: Array<{triangles: number[], type: string}> = [];
        
        for (let startTriIdx = 0; startTriIdx < triangleCount; startTriIdx++) {
          if (visited.has(startTriIdx)) continue;
          
          const startVertexIdx = meshData.indices[startTriIdx * 3];
          const faceType = meshData.vertex_colors[startVertexIdx] || 'default';
          
          // BFS to find all connected triangles of same type
          const currentGroup: number[] = [];
          const queue = [startTriIdx];
          visited.add(startTriIdx);
          
          while (queue.length > 0) {
            const triIdx = queue.shift()!;
            currentGroup.push(triIdx);
            
            const verts = triangleEdges.get(triIdx)!;
            const edges = [
              makeEdgeKey(verts[0], verts[1]),
              makeEdgeKey(verts[1], verts[2]),
              makeEdgeKey(verts[2], verts[0])
            ];
            
            // Check each edge for neighbors
            edges.forEach(edgeKey => {
              // Skip if this is a feature edge (boundary)
              if (featureEdgeSet.has(edgeKey)) return;
              
              const neighbors = edgeToTriangles.get(edgeKey) || [];
              neighbors.forEach(neighborIdx => {
                if (visited.has(neighborIdx)) return;
                
                // Check if neighbor has same face type
                const neighborVertexIdx = meshData.indices[neighborIdx * 3];
                const neighborType = meshData.vertex_colors[neighborVertexIdx] || 'default';
                
                if (neighborType === faceType) {
                  visited.add(neighborIdx);
                  queue.push(neighborIdx);
                }
              });
            });
          }
          
          faceGroups.push({ triangles: currentGroup, type: faceType });
        }
        
        console.log(`Created ${faceGroups.length} face groups from ${triangleCount} triangles`);
        
        // STEP 4: Apply solid colors per face group
        const colors = new Float32Array(triangleCount * 9);
        const typeCount: { [key: string]: number } = {};
        
        faceGroups.forEach(group => {
          typeCount[group.type] = (typeCount[group.type] || 0) + group.triangles.length;
          
          const colorHex = TOPOLOGY_COLORS[group.type as keyof typeof TOPOLOGY_COLORS] || TOPOLOGY_COLORS.default;
          const color = new THREE.Color(colorHex);
          
          // Apply same color to all triangles in this face group
          group.triangles.forEach(triIdx => {
            for (let v = 0; v < 3; v++) {
              colors[triIdx * 9 + v * 3 + 0] = color.r;
              colors[triIdx * 9 + v * 3 + 1] = color.g;
              colors[triIdx * 9 + v * 3 + 2] = color.b;
            }
          });
        });
        
        console.log('Face group distribution:', typeCount);
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.attributes.color.needsUpdate = true;
        
        console.log('✅ Edge-based face colors applied (perfect boundaries)');
        
      } else {
        // ⚠️ FALLBACK: No vertex_colors from backend - apply uniform silver color
        console.warn('⚠️ No vertex_colors from backend, falling back to uniform silver color');
        
        const triangleCount = meshData.indices.length / 3;
        const colors = new Float32Array(triangleCount * 9);
        const silverColor = new THREE.Color('#CCCCCC');
        
        for (let i = 0; i < triangleCount * 3; i++) {
          colors[i * 3] = silverColor.r;
          colors[i * 3 + 1] = silverColor.g;
          colors[i * 3 + 2] = silverColor.b;
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.attributes.color.needsUpdate = true;
        
        console.log('✅ Applied fallback silver color for all vertices');
      }
    } else {
      // Remove color attribute when topology colors are disabled
      if (geometry.attributes.color) {
        console.log('🧹 Removing face colors from geometry');
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
