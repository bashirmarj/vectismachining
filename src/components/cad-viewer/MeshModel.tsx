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
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(meshData.normals, 3));
      geo.computeVertexNormals();
      geo.normalizeNormals();
      return geo;
    }, [meshData.vertices, meshData.indices, meshData.normals]);

    const edgeMap = useMemo(() => {
      const map = new Map<
        string,
        {
          v1: THREE.Vector3;
          v2: THREE.Vector3;
          normals: THREE.Vector3[];
        }
      >();

      const triangleCount = meshData.indices.length / 3;

      for (let i = 0; i < triangleCount; i++) {
        const i0 = meshData.indices[i * 3];
        const i1 = meshData.indices[i * 3 + 1];
        const i2 = meshData.indices[i * 3 + 2];

        const v0 = new THREE.Vector3(
          meshData.vertices[i0 * 3],
          meshData.vertices[i0 * 3 + 1],
          meshData.vertices[i0 * 3 + 2],
        );
        const v1 = new THREE.Vector3(
          meshData.vertices[i1 * 3],
          meshData.vertices[i1 * 3 + 1],
          meshData.vertices[i1 * 3 + 2],
        );
        const v2 = new THREE.Vector3(
          meshData.vertices[i2 * 3],
          meshData.vertices[i2 * 3 + 1],
          meshData.vertices[i2 * 3 + 2],
        );

        const e1 = new THREE.Vector3().subVectors(v1, v0);
        const e2 = new THREE.Vector3().subVectors(v2, v0);
        const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();

        const getKey = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`);

        const edges = [
          { v1: v0, v2: v1, key: getKey(i0, i1) },
          { v1: v1, v2: v2, key: getKey(i1, i2) },
          { v1: v2, v2: v0, key: getKey(i2, i0) },
        ];

        edges.forEach((edge) => {
          if (!map.has(edge.key)) {
            map.set(edge.key, {
              v1: edge.v1.clone(),
              v2: edge.v2.clone(),
              normals: [normal.clone()],
            });
          } else {
            map.get(edge.key)!.normals.push(normal.clone());
          }
        });
      }

      return map;
    }, [meshData.vertices, meshData.indices]);

    useFrame(() => {
      if (!edgeMap || !meshRef.current) return;

      const mesh = meshRef.current;
      const cameraWorldPos = new THREE.Vector3();
      camera.getWorldPosition(cameraWorldPos);

      const worldToLocal = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
      const cameraLocalPos = cameraWorldPos.clone().applyMatrix4(worldToLocal);

      const visibleEdges: number[] = [];
      const hiddenEdges: number[] = [];

      edgeMap.forEach((edgeData) => {
        const v1World = edgeData.v1.clone().applyMatrix4(mesh.matrixWorld);
        const v2World = edgeData.v2.clone().applyMatrix4(mesh.matrixWorld);

        if (edgeData.normals.length === 1) {
          const n = edgeData.normals[0];
          const edgeMidpoint = new THREE.Vector3().addVectors(edgeData.v1, edgeData.v2).multiplyScalar(0.5);
          const viewDir = new THREE.Vector3().subVectors(cameraLocalPos, edgeMidpoint).normalize();

          if (n.dot(viewDir) > 0) {
            visibleEdges.push(v1World.x, v1World.y, v1World.z, v2World.x, v2World.y, v2World.z);
          } else if (showHiddenEdges) {
            hiddenEdges.push(v1World.x, v1World.y, v1World.z, v2World.x, v2World.y, v2World.z);
          }
          return;
        }

        if (edgeData.normals.length === 2) {
          const n1 = edgeData.normals[0];
          const n2 = edgeData.normals[1];

          const edgeMidpoint = new THREE.Vector3().addVectors(edgeData.v1, edgeData.v2).multiplyScalar(0.5);
          const viewDir = new THREE.Vector3().subVectors(cameraLocalPos, edgeMidpoint).normalize();

          const dot1 = n1.dot(viewDir);
          const dot2 = n2.dot(viewDir);

          if ((dot1 > 0.01 && dot2 < -0.01) || (dot1 < -0.01 && dot2 > 0.01)) {
            visibleEdges.push(v1World.x, v1World.y, v1World.z, v2World.x, v2World.y, v2World.z);
          }
        }
      });

      if (displayStyle === "solid" && showEdges && dynamicEdgesRef.current) {
        while (dynamicEdgesRef.current.children.length > 0) {
          const child = dynamicEdgesRef.current.children[0];
          dynamicEdgesRef.current.remove(child);
          if (child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        }

        if (visibleEdges.length > 0) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(visibleEdges, 3));
          const mat = new THREE.LineBasicMaterial({
            color: "#000000",
            linewidth: 1.5,
            toneMapped: false,
            depthTest: true,
            depthWrite: false,
          });
          dynamicEdgesRef.current.add(new THREE.LineSegments(geo, mat));
        }
      }

      if (displayStyle === "wireframe" && wireframeEdgesRef.current) {
        while (wireframeEdgesRef.current.children.length > 0) {
          const child = wireframeEdgesRef.current.children[0];
          wireframeEdgesRef.current.remove(child);
          if (child instanceof THREE.LineSegments) {
            child.geometry.dispose();
            (child.material as THREE.Material).dispose();
          }
        }

        if (visibleEdges.length > 0) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(visibleEdges, 3));
          const mat = new THREE.LineBasicMaterial({
            color: "#000000",
            linewidth: 1.5,
            toneMapped: false,
          });
          wireframeEdgesRef.current.add(new THREE.LineSegments(geo, mat));
        }

        if (showHiddenEdges && hiddenEdges.length > 0) {
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.Float32BufferAttribute(hiddenEdges, 3));
          const mat = new THREE.LineDashedMaterial({
            color: "#666666",
            linewidth: 1,
            dashSize: 3,
            gapSize: 2,
            toneMapped: false,
          });
          const lines = new THREE.LineSegments(geo, mat);
          lines.computeLineDistances();
          wireframeEdgesRef.current.add(lines);
        }
      }
    });

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

        {displayStyle !== "wireframe" && <group ref={dynamicEdgesRef} />}

        {displayStyle === "wireframe" && <group ref={wireframeEdgesRef} />}
      </group>
    );
  },
);
