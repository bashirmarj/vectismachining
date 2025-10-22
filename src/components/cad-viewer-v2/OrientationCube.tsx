import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface OrientationCubeProps {
  cameraRotation?: THREE.Euler;
  onFaceClick?: (face: string) => void;
}

const Cube = ({ cameraRotation, onFaceClick }: OrientationCubeProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Sync cube rotation with main camera
  useFrame(() => {
    if (meshRef.current && cameraRotation) {
      meshRef.current.rotation.copy(cameraRotation);
    }
  });

  const handleClick = (event: any) => {
    event.stopPropagation();
    const face = event.face;
    if (face && onFaceClick) {
      // Determine which face was clicked based on normal
      const normal = face.normal;
      let faceName = 'front';
      
      if (Math.abs(normal.z) > 0.9) faceName = normal.z > 0 ? 'front' : 'back';
      else if (Math.abs(normal.x) > 0.9) faceName = normal.x > 0 ? 'right' : 'left';
      else if (Math.abs(normal.y) > 0.9) faceName = normal.y > 0 ? 'top' : 'bottom';
      
      onFaceClick(faceName);
    }
  };

  return (
    <mesh ref={meshRef} onClick={handleClick}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial
        color="#C8D0D8"
        metalness={0.3}
        roughness={0.4}
        transparent
        opacity={0.9}
      />
      {/* Edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1.5, 1.5, 1.5)]} />
        <lineBasicMaterial color="#1a1a1a" linewidth={2} />
      </lineSegments>
    </mesh>
  );
};

const OrientationCube = ({ cameraRotation, onFaceClick }: OrientationCubeProps) => {
  return (
    <div className="w-28 h-28 rounded-lg overflow-hidden shadow-lg border border-border/50 bg-card/80 backdrop-blur-sm">
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        dpr={window.devicePixelRatio}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} />
        <Cube cameraRotation={cameraRotation} onFaceClick={onFaceClick} />
      </Canvas>
    </div>
  );
};

export default OrientationCube;
