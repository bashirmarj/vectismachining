import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef, useMemo } from 'react';

interface EdgeData {
  faces: number[];
  vertices: [number, number];
}

interface SilhouetteEdgesProps {
  geometry: THREE.BufferGeometry;
  color?: string;
  thickness?: number;
}

export function DynamicSilhouetteEdges({ 
  geometry, 
  color = '#000000', 
  thickness = 1.5 
}: SilhouetteEdgesProps) {
  const linesRef = useRef<THREE.LineSegments>(null);
  
  // Pre-compute edge-to-face mapping (done once)
  const edgeData = useMemo(() => {
    const edges: Map<string, EdgeData> = new Map();
    const positions = geometry.attributes.position;
    const indices = geometry.index;
    
    if (!indices) return edges;
    
    // Helper to add edge with consistent ordering
    const addEdge = (v0: number, v1: number, face: number) => {
      const key = v0 < v1 ? `${v0}-${v1}` : `${v1}-${v0}`;
      
      if (!edges.has(key)) {
        edges.set(key, { faces: [face], vertices: [v0, v1] });
      } else {
        const existing = edges.get(key)!;
        existing.faces.push(face);
      }
    };
    
    // Build edge map from triangles
    for (let i = 0; i < indices.count; i += 3) {
      const face = Math.floor(i / 3);
      const v0 = indices.getX(i);
      const v1 = indices.getX(i + 1);
      const v2 = indices.getX(i + 2);
      
      // Add 3 edges of this triangle
      addEdge(v0, v1, face);
      addEdge(v1, v2, face);
      addEdge(v2, v0, face);
    }
    
    return edges;
  }, [geometry]);
  
  // Update silhouette edges every frame based on camera
  useFrame(({ camera }) => {
    if (!linesRef.current) return;
    
    const positions = geometry.attributes.position;
    const indices = geometry.index;
    
    if (!indices) return;
    
    const silhouettePositions: number[] = [];
    const cameraPos = camera.position;
    
    // Cache for face normals
    const faceNormals = new Map<number, THREE.Vector3>();
    
    const getFaceNormal = (faceIndex: number): THREE.Vector3 => {
      if (faceNormals.has(faceIndex)) {
        return faceNormals.get(faceIndex)!;
      }
      
      const i = faceIndex * 3;
      const v0 = indices.getX(i);
      const v1 = indices.getX(i + 1);
      const v2 = indices.getX(i + 2);
      
      const p0 = new THREE.Vector3(
        positions.getX(v0),
        positions.getY(v0),
        positions.getZ(v0)
      );
      const p1 = new THREE.Vector3(
        positions.getX(v1),
        positions.getY(v1),
        positions.getZ(v1)
      );
      const p2 = new THREE.Vector3(
        positions.getX(v2),
        positions.getY(v2),
        positions.getZ(v2)
      );
      
      const edge1 = new THREE.Vector3().subVectors(p1, p0);
      const edge2 = new THREE.Vector3().subVectors(p2, p0);
      const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
      
      faceNormals.set(faceIndex, normal);
      return normal;
    };
    
    edgeData.forEach((data) => {
      // Only edges shared by exactly 2 faces can be silhouettes
      if (data.faces.length !== 2) return;
      
      const [face1, face2] = data.faces;
      const [v0, v1] = data.vertices;
      
      // Get face normals
      const n1 = getFaceNormal(face1);
      const n2 = getFaceNormal(face2);
      
      // Get edge midpoint for view direction calculation
      const p0 = new THREE.Vector3(
        positions.getX(v0),
        positions.getY(v0),
        positions.getZ(v0)
      );
      
      // View direction from edge to camera
      const viewDir = new THREE.Vector3().subVectors(cameraPos, p0).normalize();
      
      // Check if faces point in opposite directions relative to camera
      const dot1 = n1.dot(viewDir);
      const dot2 = n2.dot(viewDir);
      
      // Silhouette condition: one face toward camera, one away
      if ((dot1 > 0 && dot2 < 0) || (dot1 < 0 && dot2 > 0)) {
        // Add this edge to silhouette
        silhouettePositions.push(
          positions.getX(v0), positions.getY(v0), positions.getZ(v0),
          positions.getX(v1), positions.getY(v1), positions.getZ(v1)
        );
      }
    });
    
    // Update line geometry
    const lineGeometry = linesRef.current.geometry as THREE.BufferGeometry;
    lineGeometry.setAttribute(
      'position', 
      new THREE.Float32BufferAttribute(silhouettePositions, 3)
    );
    lineGeometry.computeBoundingSphere();
  });
  
  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry />
      <lineBasicMaterial color={color} linewidth={thickness} />
    </lineSegments>
  );
}
