import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface AutoRotateProps {
  enabled: boolean;
  children: React.ReactNode;
}

export function AutoRotate({ enabled, children }: AutoRotateProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state, delta) => {
    if (enabled && groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
    }
  });
  
  return <group ref={groupRef}>{children}</group>;
}
