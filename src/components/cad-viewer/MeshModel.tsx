import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DynamicSilhouetteEdges } from './DynamicSilhouetteEdges';

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

  // Create feature edges from backend CAD geometry (continuous polylines for smooth curves)
  const featureEdges = useMemo(() => {
    if (!showEdges) return null;

    // Prefer backend feature edges if available (true CAD edges, no tessellation)
    if (meshData.feature_edges && meshData.feature_edges.length > 0) {
      const polylines: THREE.BufferGeometry[] = [];
      const minLength = 0.01;
      let filteredCount = 0;
      
      for (const edge of meshData.feature_edges) {
        const positions: number[] = [];
        
        // Keep polyline as continuous curve (not individual segments)
        for (const point of edge) {
          positions.push(point[0], point[1], point[2]);
        }

        if (positions.length >= 6) { // At least 2 points (6 values)
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
          geometry.computeBoundingSphere();
          polylines.push(geometry);
        }
      }

      if (polylines.length === 0) {
        console.warn("No valid polylines after filtering");
        return null;
      }

      console.log(`✅ Rendering ${polylines.length} continuous polylines`);
      return polylines;
    }

    // Fallback: Generate edges from mesh tessellation (old method for files without feature_edges)
    console.warn("⚠️ Using fallback tessellation edges - backend feature_edges not available");
    const combinedGeo = new THREE.BufferGeometry();
    combinedGeo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    combinedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    combinedGeo.setIndex(meshData.indices);

    const creaseAngle = THREE.MathUtils.degToRad(45);
    const edgesGeo = new THREE.EdgesGeometry(combinedGeo, creaseAngle);
    return [edgesGeo]; // Wrap in array for consistent rendering
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
      {/* Render solid mesh in professional color */}
      {displayStyle !== 'wireframe' && (
        <mesh geometry={geometry}>
          <meshStandardMaterial
            {...materialProps}
            color={SOLID_COLOR}
            flatShading={false}
          />
        </mesh>
      )}
      
      {/* Dynamic silhouette edges for solid mode */}
      {showEdges && displayStyle !== 'wireframe' && (
        <DynamicSilhouetteEdges 
          geometry={geometry} 
          color="#000000" 
          thickness={1.5} 
        />
      )}
      
      {/* Wireframe mode - show all triangle edges */}
      {displayStyle === 'wireframe' && (
        <mesh geometry={geometry}>
          <meshBasicMaterial wireframe color="#000000" />
        </mesh>
      )}
    </group>
  );
}
