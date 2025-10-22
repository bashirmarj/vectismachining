import { useMemo } from 'react';
import * as THREE from 'three';

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  triangle_count: number;
  vertex_colors?: number[];
  feature_edges?: number[];
}

interface ModelMeshProps {
  meshData: MeshData;
}

const ModelMesh = ({ meshData }: ModelMeshProps) => {
  // Create geometry from mesh data
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    
    const positions = new Float32Array(meshData.vertices);
    const indices = new Uint32Array(meshData.indices);
    const normals = new Float32Array(meshData.normals);
    
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    geom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    
    // Add vertex colors if available
    if (meshData.vertex_colors && meshData.vertex_colors.length > 0) {
      const colors = new Float32Array(meshData.vertex_colors);
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    
    return geom;
  }, [meshData]);

  // Create BREP edges geometry if available
  const edgesGeometry = useMemo(() => {
    if (!meshData.feature_edges || meshData.feature_edges.length === 0) {
      return null;
    }
    
    const edgeGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(meshData.feature_edges);
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    return edgeGeom;
  }, [meshData.feature_edges]);

  return (
    <group>
      {/* Main mesh */}
      <mesh 
        geometry={geometry} 
        castShadow 
        receiveShadow
      >
        <meshStandardMaterial
          color="#a0a0a0"
          metalness={0.1}
          roughness={0.4}
          vertexColors={meshData.vertex_colors ? true : false}
          side={THREE.DoubleSide}
          flatShading={false}
        />
      </mesh>

      {/* BREP edges */}
      {edgesGeometry && (
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial color="#000000" linewidth={1} />
        </lineSegments>
      )}
    </group>
  );
};

export default ModelMesh;
