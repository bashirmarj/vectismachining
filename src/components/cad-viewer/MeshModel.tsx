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

// Professional solid color for CAD rendering
const SOLID_COLOR = '#5b9bd5'; // Professional CAD blue

export function MeshModel({ meshData, sectionPlane, sectionPosition, showEdges, showHiddenEdges = false, displayStyle = 'solid' }: MeshModelProps) {
  // Create single unified geometry for professional solid rendering
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    geo.setIndex(meshData.indices);
    geo.computeVertexNormals(); // Smooth shading for professional appearance
    geo.normalizeNormals(); // Ensure uniform lighting across all faces
    geo.computeBoundingSphere();
    
    return geo;
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

      // Filter small or degenerate edges (< 0.05 mm) to reduce noise while keeping curve detail
      const minLength = 0.05;
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
          
          // Filter out nearly collinear edges (tessellation artifacts)
          if (i > 0) {
            const p0 = edge[i - 1];
            const v1x = p1[0] - p0[0], v1y = p1[1] - p0[1], v1z = p1[2] - p0[2];
            const v2x = dx, v2y = dy, v2z = dz;
            
            const len1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
            const len2 = len;
            
            if (len1 > 0 && len2 > 0) {
              const dot = (v1x * v2x + v1y * v2y + v1z * v2z) / (len1 * len2);
              
              // Skip nearly collinear edges (< 5 degree angle change)
              if (dot > 0.996) { // cos(5°) ≈ 0.996
                filteredCount++;
                continue;
              }
            }
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
      {/* Render solid mesh in professional color */}
      {displayStyle !== 'wireframe' && (
        <>
          {/* Main solid mesh */}
          <mesh geometry={geometry} castShadow receiveShadow>
            <meshStandardMaterial
              {...materialProps}
              color={SOLID_COLOR}
              flatShading={false}
              polygonOffset={true}
              polygonOffsetFactor={1}
              polygonOffsetUnits={1}
            />
          </mesh>
          
          {/* Silhouette outline for crisp contours */}
          <mesh geometry={geometry} scale={1.002} castShadow>
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
