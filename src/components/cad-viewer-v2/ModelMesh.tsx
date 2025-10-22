import { useMemo } from "react";
import * as THREE from "three";

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  triangle_count: number;
  vertex_colors?: string[];
  feature_edges?: number[];
}

interface ModelMeshProps {
  meshData: MeshData;
  displayStyle?: "solid" | "wireframe" | "shaded-edges";
}

// Convert backend string labels to RGB colors for Three.js
const mapVertexLabelsToRGB = (labels: string[]): Float32Array => {
  const colorMap: Record<string, [number, number, number]> = {
    'external': [0.75, 0.75, 0.75],  // Light gray
    'internal': [1.0, 0.0, 0.0],      // Red
    'through': [1.0, 1.0, 0.0],       // Yellow
    'boss': [0.36, 0.61, 0.84],       // Blue (#5b9bd5)
  };
  
  const rgbArray = new Float32Array(labels.length * 3);
  
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const color = colorMap[label] || colorMap['external']; // Default to gray
    
    rgbArray[i * 3] = color[0];      // R
    rgbArray[i * 3 + 1] = color[1];  // G  
    rgbArray[i * 3 + 2] = color[2];  // B
  }
  
  return rgbArray;
};

const ModelMesh = ({ meshData, displayStyle = "solid" }: ModelMeshProps) => {
  // Create geometry from mesh data
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();

    const positions = new Float32Array(meshData.vertices);
    const indices = new Uint32Array(meshData.indices);

    geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geom.setIndex(new THREE.BufferAttribute(indices, 1));

    // ✅ FIX: Use high-quality normals from OpenCascade backend
    // The backend generates CAD-aware normals that respect surface types
    // (cylinders, planes, splines, etc.) which prevents banding artifacts
    if (meshData.normals && meshData.normals.length > 0) {
      const normals = new Float32Array(meshData.normals);
      geom.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
      console.log("✅ Using backend-provided CAD normals");
    } else {
      // Fallback only if normals not provided (e.g., legacy STL files)
      console.warn("⚠️ No normals in mesh data, computing fallback normals");
      geom.computeVertexNormals();
    }

    // Add vertex colors if available (convert string labels to RGB)
    if (meshData.vertex_colors && meshData.vertex_colors.length > 0) {
      const colors = mapVertexLabelsToRGB(meshData.vertex_colors);
      geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      console.log("✅ Applied vertex colors:", {
        total: meshData.vertex_colors.length,
        sample: meshData.vertex_colors.slice(0, 5)
      });
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
            color="#ffffff"
            metalness={0.3}
            roughness={0.5}
            envMapIntensity={0}
            vertexColors={true}
            side={THREE.FrontSide}
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
