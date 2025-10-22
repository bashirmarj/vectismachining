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
  displayStyle?: 'solid' | 'wireframe' | 'shaded-edges';
}

const ModelMesh = ({ meshData, displayStyle = 'solid' }: ModelMeshProps) => {
  // Create geometry from mesh data
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    
    const positions = new Float32Array(meshData.vertices);
    const indices = new Uint32Array(meshData.indices);
    
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));
    
    // Add vertex colors if available
    if (meshData.vertex_colors && meshData.vertex_colors.length > 0) {
      const colors = new Float32Array(meshData.vertex_colors);
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    
    // Compute smooth vertex normals for curved surfaces
    geom.computeVertexNormals();
    
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

  // Create edges geometry for shaded-edges mode
  const standardEdges = useMemo(() => {
    if (displayStyle !== 'shaded-edges') return null;
    const edges = new THREE.EdgesGeometry(geometry, 15); // 15 degree threshold
    return edges;
  }, [geometry, displayStyle]);

  return (
    <group>
      {/* Main mesh */}
      <mesh 
        geometry={geometry} 
        castShadow 
        receiveShadow
      >
        {displayStyle === 'wireframe' ? (
          <meshBasicMaterial
            color="#C8D0D8"
            wireframe
          />
        ) : (
          <meshStandardMaterial
            color="#5b9bd5"
            metalness={0}
            roughness={0.8}
            envMapIntensity={0}
            vertexColors={false}
            side={THREE.DoubleSide}
            flatShading={false}
            toneMapped={false}
          />
        )}
      </mesh>

      {/* BREP feature edges (always show if available) */}
      {edgesGeometry && displayStyle !== 'wireframe' && (
        <lineSegments geometry={edgesGeometry}>
          <lineBasicMaterial 
            color="#000000"
            linewidth={1.5}
            toneMapped={false}
            depthTest={true}
            depthWrite={false}
            polygonOffset={true}
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </lineSegments>
      )}

      {/* Standard edges for shaded-edges mode */}
      {standardEdges && displayStyle === 'shaded-edges' && (
        <lineSegments geometry={standardEdges}>
          <lineBasicMaterial color="#1a1a1a" linewidth={1} opacity={0.6} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default ModelMesh;
