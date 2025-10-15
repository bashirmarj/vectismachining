import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface OrientationCubeProps {
  onViewChange: (position: [number, number, number]) => void;
}

export function OrientationCube({ onViewChange }: OrientationCubeProps) {
  const cubeRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  
  // Update cube rotation to match camera
  useFrame(() => {
    if (cubeRef.current && camera) {
      const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion.clone().invert());
      cubeRef.current.rotation.copy(rotation);
    }
  });
  
  const views = {
    front: [0, 0, 300] as [number, number, number],
    back: [0, 0, -300] as [number, number, number],
    top: [0, 300, 0] as [number, number, number],
    bottom: [0, -300, 0] as [number, number, number],
    left: [-300, 0, 0] as [number, number, number],
    right: [300, 0, 0] as [number, number, number],
  };
  
  return (
    <group position={[0, 0, 0]}>
      <Html position={[10, 10, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col gap-1">
          {Object.entries(views).map(([name, pos]) => (
            <button
              key={name}
              onClick={() => onViewChange(pos)}
              className="px-3 py-1 text-xs bg-background/90 border border-border rounded hover:bg-accent hover:text-accent-foreground transition-colors capitalize"
              style={{ pointerEvents: 'auto' }}
            >
              {name}
            </button>
          ))}
        </div>
      </Html>
      
      <group ref={cubeRef} scale={0.8}>
        {/* Orientation cube visual */}
        <mesh>
          <boxGeometry args={[40, 40, 40]} />
          <meshBasicMaterial color="#334155" transparent opacity={0.3} />
        </mesh>
        
        {/* Edge lines */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(40, 40, 40)]} />
          <lineBasicMaterial color="#64748b" linewidth={2} />
        </lineSegments>
        
        {/* Axis indicators */}
        <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 30, 0xff0000]} />
        <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 30, 0x00ff00]} />
        <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 30, 0x0000ff]} />
      </group>
    </group>
  );
}
