import * as THREE from 'three';

export type ViewPreset = 'isometric' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

interface ViewPresetConfig {
  position: [number, number, number];
  target: [number, number, number];
}

export const VIEW_PRESETS: Record<ViewPreset, ViewPresetConfig> = {
  isometric: { position: [1, 1, 1], target: [0, 0, 0] },
  front: { position: [0, 0, 2], target: [0, 0, 0] },
  back: { position: [0, 0, -2], target: [0, 0, 0] },
  left: { position: [-2, 0, 0], target: [0, 0, 0] },
  right: { position: [2, 0, 0], target: [0, 0, 0] },
  top: { position: [0, 2, 0], target: [0, 0, 0] },
  bottom: { position: [0, -2, 0], target: [0, 0, 0] },
};

interface AnimationParams {
  camera: THREE.PerspectiveCamera;
  controls: any; // OrbitControls type
  targetPosition: THREE.Vector3;
  targetLookAt: THREE.Vector3;
  duration?: number;
}

export function animateCameraToView({
  camera,
  controls,
  targetPosition,
  targetLookAt,
  duration = 800,
}: AnimationParams): Promise<void> {
  return new Promise((resolve) => {
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease-in-out cubic function for smooth animation
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      // Interpolate position
      camera.position.lerpVectors(startPosition, targetPosition, eased);

      // Interpolate target
      controls.target.lerpVectors(startTarget, targetLookAt, eased);

      controls.update();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        resolve();
      }
    };

    animate();
  });
}

export function getViewPresetVectors(
  preset: ViewPreset,
  boundingBox: THREE.Box3
): { position: THREE.Vector3; target: THREE.Vector3 } {
  const center = new THREE.Vector3();
  boundingBox.getCenter(center);

  const size = new THREE.Vector3();
  boundingBox.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const distance = maxDim * 2;

  const config = VIEW_PRESETS[preset];
  const direction = new THREE.Vector3(...config.position).normalize();

  return {
    position: center.clone().add(direction.multiplyScalar(distance)),
    target: center.clone(),
  };
}
