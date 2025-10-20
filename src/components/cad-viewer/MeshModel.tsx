import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree, useFrame } from '@react-three/fiber';

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
const SOLID_COLOR = '#CCCCCC'; // Light gray

// Fusion 360 Analysis colors
const TOPOLOGY_COLORS = {
  internal: '#FF6B6B',      // Coral Red for internal surfaces/pockets
  cylindrical: '#CCCCCC',   // Silver for outer cylindrical surfaces
  planar: '#DDDDDD',        // Light Grey for flat faces
  external: '#CCCCCC',      // Silver for other outer surfaces
  through: '#FFD700',       // Gold/Yellow for through holes
  default: '#CCCCCC'        // Default silver
};


export function MeshModel({ meshData, sectionPlane, sectionPosition, showEdges, showHiddenEdges = false, displayStyle = 'solid', topologyColors = true }: MeshModelProps) {
  
  const { camera } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  const silhouetteEdgesRef = useRef<THREE.LineSegments>(null);
  
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
  
  // Apply direct per-triangle face colors (backend handles anti-bleeding)
  useEffect(() => {
    if (!geometry) return;
    
    if (topologyColors) {
      if (meshData.vertex_colors && meshData.vertex_colors.length > 0) {
        console.log('🎨 Applying direct per-triangle face colors (no bleeding)');
        
        const triangleCount = meshData.indices.length / 3;
        const colors = new Float32Array(triangleCount * 9); // 3 vertices * 3 RGB
        const typeCount: { [key: string]: number } = {};
        
        // SIMPLIFIED APPROACH: Direct triangle coloring (backend already prevents bleeding)
        for (let triIdx = 0; triIdx < triangleCount; triIdx++) {
          // Get the face type from the first vertex of this triangle
          const vertexIdx = meshData.indices[triIdx * 3];
          const faceType = meshData.vertex_colors[vertexIdx] || 'default';
          
          // Count face types for debugging
          typeCount[faceType] = (typeCount[faceType] || 0) + 1;
          
          // Get color for this face type
          const colorHex = TOPOLOGY_COLORS[faceType as keyof typeof TOPOLOGY_COLORS] || TOPOLOGY_COLORS.default;
          const color = new THREE.Color(colorHex);
          
          // Apply same solid color to all 3 vertices of this triangle
          for (let v = 0; v < 3; v++) {
            colors[triIdx * 9 + v * 3 + 0] = color.r;
            colors[triIdx * 9 + v * 3 + 1] = color.g;
            colors[triIdx * 9 + v * 3 + 2] = color.b;
          }
        }
        
        console.log('Face type distribution:', typeCount);
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.attributes.color.needsUpdate = true;
        
        console.log('✅ Direct face colors applied (backend prevents bleeding)');
        
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
  
  // ===== NEW: Pre-compute edge connectivity map for dynamic silhouettes =====
  const edgeMap = useMemo(() => {
    if (!showEdges) return null;
    
    const map = new Map<string, {
      v1: THREE.Vector3;
      v2: THREE.Vector3;
      normals: THREE.Vector3[];
    }>();
    
    const triangleCount = meshData.indices.length / 3;
    
    for (let i = 0; i < triangleCount; i++) {
      const i0 = meshData.indices[i * 3];
      const i1 = meshData.indices[i * 3 + 1];
      const i2 = meshData.indices[i * 3 + 2];
      
      const v0 = new THREE.Vector3(
        meshData.vertices[i0 * 3],
        meshData.vertices[i0 * 3 + 1],
        meshData.vertices[i0 * 3 + 2]
      );
      const v1 = new THREE.Vector3(
        meshData.vertices[i1 * 3],
        meshData.vertices[i1 * 3 + 1],
        meshData.vertices[i1 * 3 + 2]
      );
      const v2 = new THREE.Vector3(
        meshData.vertices[i2 * 3],
        meshData.vertices[i2 * 3 + 1],
        meshData.vertices[i2 * 3 + 2]
      );
      
      // Calculate triangle normal
      const e1 = new THREE.Vector3().subVectors(v1, v0);
      const e2 = new THREE.Vector3().subVectors(v2, v0);
      const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();
      
      // Store all three edges
      const edges = [
        { v1: v0, v2: v1, key: getEdgeKey(i0, i1) },
        { v1: v1, v2: v2, key: getEdgeKey(i1, i2) },
        { v1: v2, v2: v0, key: getEdgeKey(i2, i0) }
      ];
      
      edges.forEach(edge => {
        if (!map.has(edge.key)) {
          map.set(edge.key, {
            v1: edge.v1.clone(),
            v2: edge.v2.clone(),
            normals: [normal.clone()]
          });
        } else {
          const existing = map.get(edge.key)!;
          existing.normals.push(normal.clone());
        }
      });
    }
    
    return map;
  }, [meshData, showEdges]);
  
  // Helper function to generate edge keys
  function getEdgeKey(i1: number, i2: number): string {
    return i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
  }
  
  // ===== NEW: Dynamic silhouette edge calculation every frame =====
  useFrame(() => {
    if (!showEdges || !edgeMap || !meshRef.current || displayStyle === 'wireframe') return;
    
    const mesh = meshRef.current;
    const silhouettePositions: number[] = [];
    
    // Get camera position
    const cameraWorldPos = new THREE.Vector3();
    camera.getWorldPosition(cameraWorldPos);
    
    // Transform camera to mesh local space
    const worldToLocal = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const cameraLocalPos = cameraWorldPos.clone().applyMatrix4(worldToLocal);
    
    // Check each edge
    edgeMap.forEach((edgeData) => {
      // Boundary edges (only 1 adjacent face) are always silhouettes
      if (edgeData.normals.length === 1) {
        const v1World = edgeData.v1.clone().applyMatrix4(mesh.matrixWorld);
        const v2World = edgeData.v2.clone().applyMatrix4(mesh.matrixWorld);
        silhouettePositions.push(
          v1World.x, v1World.y, v1World.z,
          v2World.x, v2World.y, v2World.z
        );
        return;
      }
      
      // For shared edges (2 adjacent faces), check if they face opposite directions
      if (edgeData.normals.length === 2) {
        const n1 = edgeData.normals[0];
        const n2 = edgeData.normals[1];
        
        // Calculate view direction from edge midpoint to camera
        const edgeMidpoint = new THREE.Vector3()
          .addVectors(edgeData.v1, edgeData.v2)
          .multiplyScalar(0.5);
        const viewDir = new THREE.Vector3()
          .subVectors(cameraLocalPos, edgeMidpoint)
          .normalize();
        
        // Check if normals face opposite directions relative to camera
        const dot1 = n1.dot(viewDir);
        const dot2 = n2.dot(viewDir);
        
        // Silhouette edge: one face front-facing, one back-facing
        if ((dot1 > 0 && dot2 < 0) || (dot1 < 0 && dot2 > 0)) {
          const v1World = edgeData.v1.clone().applyMatrix4(mesh.matrixWorld);
          const v2World = edgeData.v2.clone().applyMatrix4(mesh.matrixWorld);
          silhouettePositions.push(
            v1World.x, v1World.y, v1World.z,
            v2World.x, v2World.y, v2World.z
          );
        }
      }
    });
    
    // Update or create silhouette edges geometry
    if (silhouettePositions.length > 0) {
      if (!silhouetteEdgesRef.current) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(silhouettePositions, 3));
        const mat = new THREE.LineBasicMaterial({ 
          color: '#000000', 
          linewidth: 1.5,
          toneMapped: false 
        });
        silhouetteEdgesRef.current = new THREE.LineSegments(geo, mat);
        mesh.parent?.add(silhouetteEdgesRef.current);
      } else {
        const geo = silhouetteEdgesRef.current.geometry as THREE.BufferGeometry;
        geo.setAttribute('position', new THREE.Float32BufferAttribute(silhouettePositions, 3));
        geo.attributes.position.needsUpdate = true;
        geo.computeBoundingSphere();
      }
      silhouetteEdgesRef.current.visible = true;
    } else if (silhouetteEdgesRef.current) {
      silhouetteEdgesRef.current.visible = false;
    }
  });
  
  // Cleanup silhouette edges on unmount
  useEffect(() => {
    return () => {
      if (silhouetteEdgesRef.current) {
        silhouetteEdgesRef.current.parent?.remove(silhouetteEdgesRef.current);
        silhouetteEdgesRef.current.geometry.dispose();
        (silhouetteEdgesRef.current.material as THREE.Material).dispose();
      }
    };
  }, []);
  
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
        <mesh ref={meshRef} geometry={geometry}>
          <meshStandardMaterial
            {...materialProps}
            color={topologyColors ? '#ffffff' : SOLID_COLOR}
            vertexColors={topologyColors}
            flatShading={topologyColors}
            toneMapped={false}
          />
        </mesh>
      )}
      
      {/* Render BREP feature edges (true CAD edges from backend) - DISABLED */}
      {/* Dynamic silhouette edges (above) replace these static edges */}
      {featureEdges && false && (
        <lineSegments geometry={featureEdges}>
          <lineBasicMaterial 
            color="#000000" 
            linewidth={1}
            clippingPlanes={clippingPlane}
            clipIntersection={false}
          />
        </lineSegments>
      )}
      
      {/* Dynamic silhouette edges are rendered via useFrame hook above */}
    </group>
  );
}
