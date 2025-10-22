import { useMemo, useEffect, useRef } from 'react';
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
const SOLID_COLOR = '#CCCCCC'; // Light gray

// Fusion 360 Analysis colors
const TOPOLOGY_COLORS = {
  internal: '#FF6B6B',
  cylindrical: '#CCCCCC',
  planar: '#DDDDDD',
  external: '#CCCCCC',
  through: '#FFD700',
  default: '#CCCCCC'
};

export function MeshModel({ 
  meshData, 
  sectionPlane, 
  sectionPosition, 
  showEdges, 
  showHiddenEdges = false, 
  displayStyle = 'solid', 
  topologyColors = true 
}: MeshModelProps) {
  
  const { gl } = useThree();
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Create single unified geometry for professional solid rendering
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    
    if (!topologyColors) {
      geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geo.setIndex(meshData.indices);
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
      geo.computeVertexNormals();
      geo.normalizeNormals();
    } else {
      const triangleCount = meshData.indices.length / 3;
      const positions = new Float32Array(triangleCount * 9);
      
      for (let i = 0; i < triangleCount; i++) {
        const idx0 = meshData.indices[i * 3];
        const idx1 = meshData.indices[i * 3 + 1];
        const idx2 = meshData.indices[i * 3 + 2];
        
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
    }
    
    geo.computeBoundingSphere();
    return geo;
  }, [meshData, topologyColors]);
  
  // Apply vertex colors
  useEffect(() => {
    if (!geometry) return;
    
    if (topologyColors) {
      if (meshData.vertex_colors && meshData.vertex_colors.length > 0) {
        const triangleCount = meshData.indices.length / 3;
        const colors = new Float32Array(triangleCount * 9);
        
        for (let triIdx = 0; triIdx < triangleCount; triIdx++) {
          const vertexIdx = meshData.indices[triIdx * 3];
          const faceType = meshData.vertex_colors[vertexIdx] || 'default';
          const colorHex = TOPOLOGY_COLORS[faceType as keyof typeof TOPOLOGY_COLORS] || TOPOLOGY_COLORS.default;
          const color = new THREE.Color(colorHex);
          
          for (let v = 0; v < 3; v++) {
            colors[triIdx * 9 + v * 3 + 0] = color.r;
            colors[triIdx * 9 + v * 3 + 1] = color.g;
            colors[triIdx * 9 + v * 3 + 2] = color.b;
          }
        }
        
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.attributes.color.needsUpdate = true;
      } else {
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
      }
    } else {
      if (geometry.attributes.color) {
        geometry.deleteAttribute('color');
      }
    }
  }, [geometry, topologyColors, meshData]);
  
  // STABLE: Pre-computed BREP edges from backend (never flicker!)
  const brepEdgesGeometry = useMemo(() => {
    if (!meshData.feature_edges || meshData.feature_edges.length === 0) {
      return null;
    }
    
    try {
      const positions: number[] = [];
      
      // Each feature_edge is a polyline: array of [x, y, z] points
      // These are the exact CAD edges from the STEP file, pre-filtered by backend
      meshData.feature_edges.forEach((polyline) => {
        if (!Array.isArray(polyline) || polyline.length < 2) return;
        
        // Convert polyline to line segments
        for (let i = 0; i < polyline.length - 1; i++) {
          const p1 = polyline[i];
          const p2 = polyline[i + 1];
          
          if (Array.isArray(p1) && p1.length === 3 && Array.isArray(p2) && p2.length === 3) {
            positions.push(p1[0], p1[1], p1[2]);
            positions.push(p2[0], p2[1], p2[2]);
          }
        }
      });
      
      if (positions.length === 0) return null;
      
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return geo;
      
    } catch (error) {
      console.error('Error processing BREP edges:', error);
      return null;
    }
  }, [meshData.feature_edges]);
  
  // Section plane
  const clippingPlane = useMemo(() => {
    if (sectionPlane === 'none') return undefined;
    
    let normal: THREE.Vector3;
    switch (sectionPlane) {
      case 'xy':
        normal = new THREE.Vector3(0, 0, 1);
        break;
      case 'xz':
        normal = new THREE.Vector3(0, 1, 0);
        break;
      case 'yz':
        normal = new THREE.Vector3(1, 0, 0);
        break;
      default:
        return undefined;
    }
    
    return [new THREE.Plane(normal, -sectionPosition)];
  }, [sectionPlane, sectionPosition]);
  
  useEffect(() => {
    gl.localClippingEnabled = sectionPlane !== 'none';
    gl.clippingPlanes = [];
  }, [sectionPlane, gl]);
  
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
      // In wireframe mode, hide the mesh surface completely
      return { ...base, opacity: 0, transparent: true, wireframe: false };
    } else if (displayStyle === 'translucent') {
      return { ...base, transparent: true, opacity: 0.4, wireframe: false };
    }
    
    return { ...base, transparent: false, opacity: 1, wireframe: false };
  }, [displayStyle, clippingPlane]);
  
  return (
    <group>
      {/* Mesh surface (hidden in wireframe mode) */}
      <mesh ref={meshRef} geometry={geometry}>
        <meshStandardMaterial
          {...materialProps}
          color={topologyColors ? '#ffffff' : SOLID_COLOR}
          vertexColors={topologyColors}
          flatShading={topologyColors}
          toneMapped={false}
        />
      </mesh>
      
      {/* STABLE BREP edges from backend - no flickering, no runtime calculation */}
      {showEdges && brepEdgesGeometry && (
        <lineSegments geometry={brepEdgesGeometry}>
          <lineBasicMaterial 
            color="#000000"
            linewidth={1.5}
            toneMapped={false}
            depthTest={true}
            depthWrite={false}
            // Slight polygon offset to prevent z-fighting with mesh surface
            polygonOffset={true}
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </lineSegments>
      )}
    </group>
  );
}
