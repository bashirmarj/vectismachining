import { useMemo, useEffect, useRef, forwardRef } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";

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
  sectionPlane: "none" | "xy" | "xz" | "yz";
  sectionPosition: number;
  showEdges: boolean;
  showHiddenEdges?: boolean;
  displayStyle?: "solid" | "wireframe" | "translucent";
}

export const MeshModel = forwardRef<THREE.Mesh, MeshModelProps>(
  ({ meshData, sectionPlane, sectionPosition, showEdges, showHiddenEdges = false, displayStyle = "solid" }, ref) => {
    const { camera } = useThree();
    const internalMeshRef = useRef<THREE.Mesh>(null);
    const meshRef = (ref as React.RefObject<THREE.Mesh>) || internalMeshRef;
    const dynamicEdgesRef = useRef<THREE.Group>(null);
    const wireframeEdgesRef = useRef<THREE.Group>(null);

    const geometry = useMemo(() => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(meshData.vertices, 3));
      geo.setIndex(meshData.indices);

      // Use BREP normals directly from Python geometry service
      // The 8° angular deflection provides high-quality normals for both curved and flat surfaces
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(meshData.normals, 3));
      geo.normalizeNormals();

  console.log("🔍 Geometry Debug:", {
    vertexCount: meshData.vertices.length / 3,
    normalCount: meshData.normals.length / 3,
    normalSample: meshData.normals.slice(0, 9),
    hasNormals: geo.attributes.normal ? true : false,
  });
      return geo;
    }, [meshData.vertices, meshData.indices, meshData.normals]);

    // Static feature edges from database (computed by Python geometry service)
    const featureEdges = useMemo(() => {
      if (!meshData.feature_edges || meshData.feature_edges.length === 0) return null;

      const positions: number[] = [];
      meshData.feature_edges.forEach((edge) => {
        // Each edge is [[x1,y1,z1], [x2,y2,z2]]
        positions.push(edge[0][0], edge[0][1], edge[0][2]);
        positions.push(edge[1][0], edge[1][1], edge[1][2]);
      });

      return positions;
    }, [meshData.feature_edges]);

    // No dynamic edge calculation - use static feature edges from database

    const clippingPlane = useMemo(() => {
      if (sectionPlane === "none") return undefined;

      let normal: THREE.Vector3;
      switch (sectionPlane) {
        case "xy":
          normal = new THREE.Vector3(0, 0, 1);
          break;
        case "xz":
          normal = new THREE.Vector3(0, 1, 0);
          break;
        case "yz":
          normal = new THREE.Vector3(1, 0, 0);
          break;
        default:
          return undefined;
      }

      return [new THREE.Plane(normal, -sectionPosition)];
    }, [sectionPlane, sectionPosition]);

    const { gl } = useThree();

    useEffect(() => {
      gl.localClippingEnabled = sectionPlane !== "none";
      gl.clippingPlanes = [];
    }, [sectionPlane, gl]);

    const materialProps = useMemo(() => {
      const base = {
        color: "#5b9bd5", // Professional blue-gray
        side: THREE.DoubleSide,
        clippingPlanes: clippingPlane,
        clipIntersection: false,
        metalness: 0.3,
        roughness: 0.8,
        envMapIntensity: 0.5,
      };

      if (displayStyle === "wireframe") {
        return { ...base, opacity: 0, transparent: true, wireframe: false };
      } else if (displayStyle === "translucent") {
        return { ...base, transparent: true, opacity: 0.4, wireframe: false };
      }

      return { ...base, transparent: false, opacity: 1, wireframe: false };
    }, [displayStyle, clippingPlane]);

    return (
      <group>
        <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial {...materialProps} flatShading={false} toneMapped={false} />
        </mesh>

        {/* Static feature edges from database */}
        {showEdges && featureEdges && featureEdges.length > 0 && (
          <lineSegments>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={featureEdges.length / 3}
                array={new Float32Array(featureEdges)}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#000000" linewidth={1.5} toneMapped={false} depthTest={true} depthWrite={false} />
          </lineSegments>
        )}
      </group>
    );
  },
);
