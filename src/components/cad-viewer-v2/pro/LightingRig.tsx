import * as THREE from 'three';

interface LightingRigProps {
  shadowsEnabled: boolean;
  intensity?: number;
  modelBounds: {
    min: THREE.Vector3;
    max: THREE.Vector3;
    center: THREE.Vector3;
    size: THREE.Vector3;
  };
}

const LightingRig = ({ shadowsEnabled, intensity = 1.0, modelBounds }: LightingRigProps) => {
  const maxDim = Math.max(modelBounds.size.x, modelBounds.size.y, modelBounds.size.z);
  const shadowCameraSize = maxDim * 2;

  return (
    <>
      {/* Ambient base illumination */}
      <ambientLight intensity={0.3 * intensity} />

      {/* Key Light - Main directional light with shadows */}
      <directionalLight
        position={[5, 10, 7]}
        intensity={0.8 * intensity}
        color="#ffffff"
        castShadow={shadowsEnabled}
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={maxDim * 5}
        shadow-camera-left={-shadowCameraSize}
        shadow-camera-right={shadowCameraSize}
        shadow-camera-top={shadowCameraSize}
        shadow-camera-bottom={-shadowCameraSize}
        shadow-bias={-0.0001}
      />

      {/* Fill Light - Softer, from opposite side */}
      <directionalLight
        position={[-5, 5, -5]}
        intensity={0.3 * intensity}
        color="#ffffff"
      />

      {/* Rim Light 1 - Edge highlight from back */}
      <directionalLight
        position={[0, 0, -10]}
        intensity={0.4 * intensity}
        color="#ffffff"
      />

      {/* Rim Light 2 - Edge highlight from front */}
      <directionalLight
        position={[0, 0, 10]}
        intensity={0.4 * intensity}
        color="#ffffff"
      />
    </>
  );
};

export default LightingRig;
