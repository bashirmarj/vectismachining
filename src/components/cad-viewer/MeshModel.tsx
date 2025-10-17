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
}

// Meviy-style color scheme
const FACE_COLORS = {
  external: '#5b9bd5',      // Blue - external surfaces
  internal: '#e66f6f',      // Red/coral - internal features (holes)
  cylindrical: '#f4d03f',   // Yellow - cylindrical features
  planar: '#a8c8e8',        // Light blue - planar surfaces
};

export function MeshModel({ meshData, sectionPlane, sectionPosition, showEdges, showHiddenEdges = false, displayStyle = 'solid' }: MeshModelProps) {
  // Create separate geometries for each face type (Meviy-style color classification)
  const geometries = useMemo(() => {
    if (!meshData.face_types || meshData.face_types.length === 0) {
      // Fallback: single geometry with default color if no classification
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
      geo.setIndex(meshData.indices);
      geo.computeBoundingSphere();
      
      return { external: geo };
    }
    
    // Group triangles by face type
    const typeGroups: Record<string, { vertices: number[], normals: number[], indices: number[] }> = {
      external: { vertices: [], normals: [], indices: [] },
      internal: { vertices: [], normals: [], indices: [] },
      cylindrical: { vertices: [], normals: [], indices: [] },
      planar: { vertices: [], normals: [], indices: [] },
    };
    
    const vertexMap: Record<string, Record<number, number>> = {
      external: {},
      internal: {},
      cylindrical: {},
      planar: {},
    };
    
    // Process each triangle
    for (let i = 0; i < meshData.indices.length; i += 3) {
      const idx1 = meshData.indices[i];
      const idx2 = meshData.indices[i + 1];
      const idx3 = meshData.indices[i + 2];
      
      // Get face type for this triangle (divide by 3 to get triangle index)
      const triangleIdx = i / 3;
      const faceType = meshData.face_types[triangleIdx] || 'external';
      const group = typeGroups[faceType];
      const vMap = vertexMap[faceType];
      
      // Add vertices for this triangle
      [idx1, idx2, idx3].forEach((originalIdx) => {
        if (!(originalIdx in vMap)) {
          const newIdx = group.vertices.length / 3;
          vMap[originalIdx] = newIdx;
          
          group.vertices.push(
            meshData.vertices[originalIdx * 3],
            meshData.vertices[originalIdx * 3 + 1],
            meshData.vertices[originalIdx * 3 + 2]
          );
          group.normals.push(
            meshData.normals[originalIdx * 3],
            meshData.normals[originalIdx * 3 + 1],
            meshData.normals[originalIdx * 3 + 2]
          );
        }
      });
      
      // Add triangle indices
      group.indices.push(vMap[idx1], vMap[idx2], vMap[idx3]);
    }
    
    // Create BufferGeometry for each type
    const result: Record<string, THREE.BufferGeometry> = {};
    
    Object.entries(typeGroups).forEach(([type, data]) => {
      if (data.indices.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
        geo.setIndex(data.indices);
        
        // Smooth normals for curved surfaces (cylindrical, external) for better appearance
        if (type === 'cylindrical' || type === 'external') {
          geo.computeVertexNormals();
        }
        
        geo.computeBoundingSphere();
        result[type] = geo;
      }
    });
    
    return result;
  }, [meshData]);
  
  // Debug: Verify backend feature edges are received
  console.log("Received feature_edges:", meshData.feature_edges?.length || 0);
  if (meshData.feature_edges && meshData.feature_edges.length > 0) {
    const totalSegments = meshData.feature_edges.reduce((sum, edge) => sum + edge.length - 1, 0);
    console.log(`Feature edges: ${meshData.feature_edges.length} polylines, ~${totalSegments} segments`);
  }

  // Create feature edges from backend CAD geometry (Meviy-quality clean edges)
  const featureEdges = useMemo(() => {
    if (!showEdges) return null;

    // Prefer backend feature edges if available (true CAD edges, no tessellation)
    if (meshData.feature_edges && meshData.feature_edges.length > 0) {
      const positions: number[] = [];

      // Filter small or degenerate edges (< 0.2 mm) to reduce noise
      const minLength = 0.2;
      let filteredCount = 0;
      
      for (const edge of meshData.feature_edges) {
        for (let i = 0; i < edge.length - 1; i++) {
          const p1 = edge[i];
          const p2 = edge[i + 1];
          
          // Calculate segment length
          const dx = p2[0] - p1[0];
          const dy = p2[1] - p1[1];
          const dz = p2[2] - p1[2];
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          
          // Skip tiny edges (tessellation artifacts, numerical noise)
          if (len < minLength) {
            filteredCount++;
            continue;
          }
          
          // Add valid line segment (two points)
          positions.push(p1[0], p1[1], p1[2]);
          positions.push(p2[0], p2[1], p2[2]);
        }
      }

      if (positions.length === 0) {
        console.warn("No valid edges after filtering - all edges too short");
        return null;
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.computeBoundingSphere(); // Important for culling and rendering

      console.log(`✅ Rendering ${positions.length / 6} clean edges (filtered ${filteredCount} tiny segments)`);
      return geometry;
    }

    // Fallback: Generate edges from mesh tessellation (old method for files without feature_edges)
    console.warn("⚠️ Using fallback tessellation edges - backend feature_edges not available");
    const combinedGeo = new THREE.BufferGeometry();
    combinedGeo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    combinedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    combinedGeo.setIndex(meshData.indices);

    const creaseAngle = THREE.MathUtils.degToRad(45);
    return new THREE.EdgesGeometry(combinedGeo, creaseAngle);
  }, [meshData, showEdges]);

  
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
      metalness: 0.15,
      roughness: 0.6,
      envMapIntensity: 0.4,
    };
    
    if (displayStyle === 'wireframe') {
      return { ...base, wireframe: true, transparent: false, opacity: 1 };
    } else if (displayStyle === 'translucent') {
      return { ...base, transparent: true, opacity: 0.4, wireframe: false };
    }
    
    return { ...base, transparent: false, opacity: 1, wireframe: false };
  }, [displayStyle, clippingPlane]);
  
  return (
    <group castShadow receiveShadow>
      {/* Render colored meshes only in solid/translucent modes */}
      {displayStyle !== 'wireframe' && (
        <>
          {Object.entries(geometries).map(([type, geo]) => (
            <group key={type}>
              {/* Main colored mesh */}
              <mesh geometry={geo} castShadow receiveShadow>
                <meshStandardMaterial
                  {...materialProps}
                  color={FACE_COLORS[type as keyof typeof FACE_COLORS] || FACE_COLORS.external}
                  polygonOffset={true}
                  polygonOffsetFactor={1}
                  polygonOffsetUnits={1}
                />
              </mesh>
              
              {/* Silhouette outline for crisp contours */}
              <mesh geometry={geo} scale={1.002} castShadow>
                <meshBasicMaterial
                  color="#0a0a0a"
                  side={THREE.BackSide}
                  clippingPlanes={clippingPlane}
                  clipIntersection={false}
                  polygonOffset={true}
                  polygonOffsetFactor={1}
                  polygonOffsetUnits={1}
                />
              </mesh>
            </group>
          ))}
        </>
      )}
      
      {/* Clean feature edges (Meviy-style: visible solid + optional hidden dashed) */}
      {showEdges && featureEdges && (
        <group>
          {/* Layer 1: Primary visible edges (crisp black outlines) */}
          <lineSegments geometry={featureEdges} renderOrder={2}>
            <lineBasicMaterial
              color="#000000"
              transparent={false}
              opacity={1}
              depthTest={true}
              linewidth={1}
            />
          </lineSegments>

          {/* Layer 2: Optional hidden edges (faint dashed lines behind surfaces) */}
          {showHiddenEdges && (
            <lineSegments geometry={featureEdges} renderOrder={1}>
              <lineDashedMaterial
                color="#333333"
                transparent={true}
                opacity={0.3}
                depthTest={true}
                depthFunc={THREE.GreaterDepth}
                dashSize={1.5}
                gapSize={1.5}
                scale={1}
              />
            </lineSegments>
          )}
        </group>
      )}
    </group>
  );
}
