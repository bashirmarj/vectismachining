import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface IdleRotationProps {
  enabled: boolean;
  target: THREE.Vector3;
}

export function IdleRotation({ enabled, target }: IdleRotationProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (enabled && groupRef.current) {
      // Slow turntable rotation around Y axis
      groupRef.current.rotation.y += delta * 0.1;
    }
  });
  
  return <group ref={groupRef} position={[target.x, target.y, target.z]} />;
}
