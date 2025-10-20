import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface CameraAnimationOptions {
  center: [number, number, number];
  diameter?: number;
  duration?: number; // Animation duration in ms
}

/**
 * ⭐ Custom hook for smooth camera animations
 * 
 * Animates the camera to focus on a selected feature with smooth easing
 */
export const useCameraAnimation = (
  options: CameraAnimationOptions | null,
  controls?: any // OrbitControls reference
) => {
  const { camera } = useThree();
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!options || !controls) return;

    const { center, diameter = 10, duration = 800 } = options;

    // Cancel any ongoing animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Calculate target camera position
    // Position camera at 3x the feature diameter away for good framing
    const distance = diameter * 3;
    const targetPosition = new THREE.Vector3(
      center[0] + distance,
      center[1] + distance * 0.7,
      center[2] + distance
    );

    const targetLookAt = new THREE.Vector3(...center);

    // Store initial positions
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = performance.now();

    // Easing function (ease-in-out cubic)
    const easeInOutCubic = (t: number): number => {
      return t < 0.5 
        ? 4 * t * t * t 
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
    };

    // Animation loop
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);

      // Lerp camera position
      camera.position.lerpVectors(startPosition, targetPosition, easedProgress);

      // Lerp controls target (what camera looks at)
      controls.target.lerpVectors(startTarget, targetLookAt, easedProgress);
      controls.update();

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    // Cleanup
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [options, camera, controls]);
};

export default useCameraAnimation;
