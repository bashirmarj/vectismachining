import { useMemo } from 'react';
import * as THREE from 'three';

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  face_types?: string[];
  triangle_count: number;
}

interface MeshModelProps {
  meshData: MeshData;
  showSectionCut: boolean;
  sectionPosition: number;
  showEdges: boolean;
}

// Meviy-style color scheme
const FACE_COLORS = {
  external: '#5b9bd5',      // Blue - external surfaces
  internal: '#e66f6f',      // Red/coral - internal features (holes)
  cylindrical: '#f4d03f',   // Yellow - cylindrical features
  planar: '#a8c8e8',        // Light blue - planar surfaces
};

export function MeshModel({ meshData, showSectionCut, sectionPosition, showEdges }: MeshModelProps) {
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
  
  // Create unified edge geometry (5-8 degree threshold for ALL design edges)
  const edges = useMemo(() => {
    if (!showEdges) return null;
    
    const combinedGeo = new THREE.BufferGeometry();
    combinedGeo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    combinedGeo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    combinedGeo.setIndex(meshData.indices);
    
    // 6 degree threshold: shows ALL design edges (90° corners, chamfers, fillets)
    // while high tessellation quality (0.999) prevents false edges on curves
    return new THREE.EdgesGeometry(combinedGeo, 6);
  }, [meshData, showEdges]);
  
  // Section cut plane
  const clippingPlane = useMemo(() => {
    if (!showSectionCut) return null;
    
    // Create a cutting plane perpendicular to view direction
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -sectionPosition);
    return [plane];
  }, [showSectionCut, sectionPosition]);
  
  return (
    <group>
      {/* Render each face type with its specific color */}
      {Object.entries(geometries).map(([type, geo]) => (
        <mesh key={type} geometry={geo}>
          <meshStandardMaterial
            color={FACE_COLORS[type as keyof typeof FACE_COLORS] || FACE_COLORS.external}
            side={THREE.DoubleSide}
            clippingPlanes={clippingPlane || undefined}
            clipIntersection={false}
            metalness={0}
            roughness={1}
            flatShading={true}
            envMapIntensity={0}
          />
        </mesh>
      ))}
      
      {/* Edge lines for clarity - prominent and visible through surfaces */}
      {showEdges && edges && (
        <lineSegments geometry={edges}>
          <lineBasicMaterial
            color="#0a1f2e"
            linewidth={2}
            depthTest={false}
            opacity={0.8}
            transparent
          />
        </lineSegments>
      )}
    </group>
  );
}
