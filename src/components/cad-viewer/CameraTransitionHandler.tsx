import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraTransitionHandlerProps {
  targetPosition: THREE.Vector3 | null;
  isTransitioning: boolean;
  onTransitionComplete: () => void;
  controlsRef: React.RefObject<any>;
  target: THREE.Vector3;
}

export function CameraTransitionHandler({
  targetPosition,
  isTransitioning,
  onTransitionComplete,
  controlsRef,
  target
}: CameraTransitionHandlerProps) {
  const { camera } = useThree();
  const startPosition = useRef<THREE.Vector3 | null>(null);
  const progress = useRef(0);

  useEffect(() => {
    if (isTransitioning && targetPosition) {
      startPosition.current = camera.position.clone();
      progress.current = 0;
    }
  }, [isTransitioning, targetPosition, camera]);

  useFrame((state, delta) => {
    if (!isTransitioning || !targetPosition || !startPosition.current) return;

    progress.current += delta * 2; // 0.5 second transition

    if (progress.current >= 1) {
      camera.position.copy(targetPosition);
      if (controlsRef.current) {
        controlsRef.current.target.copy(target);
        controlsRef.current.update();
      }
      onTransitionComplete();
      return;
    }

    // Smooth easing
    const t = progress.current;
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    camera.position.lerpVectors(startPosition.current, targetPosition, eased);
    camera.lookAt(target);
    
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
  });

  return null;
}