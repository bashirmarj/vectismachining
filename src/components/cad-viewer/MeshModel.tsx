import { useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
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

const COLOR_SOLID = '#5b9bd5';

export function MeshModel({
  meshData,
  sectionPlane,
  sectionPosition,
  showEdges,
  showHiddenEdges = false,
  displayStyle = 'solid'
}: MeshModelProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    geo.setIndex(meshData.indices);
    geo.computeVertexNormals();
    geo.normalizeNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [meshData]);

  const featureEdges = useMemo(() => {
    if (!showEdges) return null;

    // Prefer backend feature edges
    if (meshData.feature_edges && meshData.feature_edges.length > 0) {
      return meshData.feature_edges.map(edge => {
        const points = edge.flat();
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
        return geo;
      });
    }

    const edgesGeo = new THREE.EdgesGeometry(geometry, 10);
    return [edgesGeo];
  }, [meshData, showEdges, geometry]);

  const clippingPlane = useMemo(() => {
    if (sectionPlane === 'none') return undefined;
    const n =
      sectionPlane === 'xy'
        ? new THREE.Vector3(0, 0, 1)
        : sectionPlane === 'xz'
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0);
    return [new THREE.Plane(n, -sectionPosition)];
  }, [sectionPlane, sectionPosition]);

  const { gl } = useThree();
  useEffect(() => {
    gl.localClippingEnabled = sectionPlane !== 'none';
  }, [sectionPlane, gl]);

  const materialProps = useMemo(() => {
    const base = {
      color: COLOR_SOLID,
      side: THREE.DoubleSide,
      clippingPlanes: clippingPlane,
      flatShading: false,
      metalness: 0,
      roughness: 0.3,
      envMapIntensity: 0
    };

    if (displayStyle === 'wireframe') return { ...base, wireframe: true };
    if (displayStyle === 'translucent') return { ...base, transparent: true, opacity: 0.5 };
    return base;
  }, [displayStyle, clippingPlane]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial {...materialProps} />
      </mesh>

      {showEdges &&
        featureEdges?.map((edge, i) => (
          <group key={i}>
            <primitive
              object={new THREE.LineSegments(
                edge,
                new THREE.LineBasicMaterial({
                  color: '#111111',
                  linewidth: 1.2,
                  depthTest: true
                })
              )}
              renderOrder={2}
            />
            {showHiddenEdges && (
              <primitive
                object={new THREE.LineSegments(
                  edge,
                  new THREE.LineDashedMaterial({
                    color: '#777777',
                    opacity: 0.3,
                    transparent: true,
                    dashSize: 1.2,
                    gapSize: 1.2,
                    depthTest: true
                  })
                )}
                renderOrder={1}
              />
            )}
          </group>
        ))}
    </group>
  );
}
