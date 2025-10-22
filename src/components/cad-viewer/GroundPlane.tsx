import * as THREE from 'three';

interface GroundPlaneProps {
  position: [number, number, number];
  size: number;
  showGrid?: boolean;
}

const GroundPlane = ({ position, size, showGrid = false }: GroundPlaneProps) => {
  return (
    <>
      {/* Shadow-receiving ground plane */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={position}
      >
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color="#f0f0f0"
          roughness={1.0}
          metalness={0}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Optional grid overlay */}
      {showGrid && (
        <gridHelper
          args={[size, 20, '#cccccc', '#dddddd']}
          position={[position[0], position[1] + 0.01, position[2]]}
        />
      )}
    </>
  );
};

export default GroundPlane;
