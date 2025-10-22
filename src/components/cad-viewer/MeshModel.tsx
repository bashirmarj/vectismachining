import { useMemo } from "react";
import * as THREE from "three";

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
  displayStyle?: "solid" | "wireframe" | "shaded-edges";
}

const ModelMesh = ({ meshData, displayStyle = "solid" }: ModelMeshProps) => {
  // Create geometry from mesh data
  // Create single unified geometry for professional solid rendering
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    if (!topologyColors) {
      // Professional solid rendering mode
      const positions = new Float32Array(meshData.vertices);
      const indices = new Uint32Array(meshData.indices);

      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setIndex(new THREE.BufferAttribute(indices, 1));

      // ✅ FIX: Use backend normals directly (don't recompute)
      if (meshData.normals && meshData.normals.length > 0) {
        const normals = new Float32Array(meshData.normals);
        geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
        console.log("✅ Using backend-provided CAD normals");
      } else {
        console.warn("⚠️ No normals provided, computing fallback");
        geo.computeVertexNormals();
      }
    } else {
      // Topology colors mode - duplicate vertices for flat shading
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

      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    }

    geo.computeBoundingSphere();
    return geo;
  }, [meshData, topologyColors]);

  // Create BREP edges geometry if available
  const edgesGeometry = useMemo(() => {
    if (!meshData.feature_edges || meshData.feature_edges.length === 0) {
      return null;
    }

    const edgeGeom = new THREE.BufferGeometry();
    const positions = new Float32Array(meshData.feature_edges);
    edgeGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    return edgeGeom;
  }, [meshData.feature_edges]);

  // Create edges geometry for shaded-edges mode
  const standardEdges = useMemo(() => {
    if (displayStyle !== "shaded-edges") return null;
    const edges = new THREE.EdgesGeometry(geometry, 15); // 15 degree threshold
    return edges;
  }, [geometry, displayStyle]);

  return (
    <group>
      {/* Main mesh */}
      <mesh geometry={geometry} castShadow receiveShadow>
        {displayStyle === "wireframe" ? (
          <meshBasicMaterial color="#C8D0D8" wireframe />
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
      {edgesGeometry && displayStyle !== "wireframe" && (
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
      {standardEdges && displayStyle === "shaded-edges" && (
        <lineSegments geometry={standardEdges}>
          <lineBasicMaterial color="#1a1a1a" linewidth={1} opacity={0.6} transparent />
        </lineSegments>
      )}
    </group>
  );
};

export default ModelMesh;
