import React from 'react';

interface ProfessionalLightingProps {
  intensity?: number;
  enableShadows?: boolean;
  shadowQuality?: 'low' | 'medium' | 'high';
}

/**
 * Simplified Professional Lighting System
 * 
 * Uses proven Three.js lighting configuration
 */
export function ProfessionalLighting({ 
  intensity = 1.0,
  enableShadows = true,
  shadowQuality = 'medium'
}: ProfessionalLightingProps) {
  
  return (
    <>
      {/* Strong Hemisphere Light for even ambient illumination */}
      <hemisphereLight
        args={['#ffffff', '#ffffff', 0.8 * intensity]}
      />

      {/* Very soft key light - minimal directionality */}
      <directionalLight
        position={[3, 5, 4]}
        intensity={0.3 * intensity}
        castShadow={false}
      />

      {/* Soft fill from opposite side */}
      <directionalLight
        position={[-3, 3, -4]}
        intensity={0.25 * intensity}
      />

      {/* Strong ambient to fill all shadows completely */}
      <ambientLight intensity={0.6 * intensity} />
    </>
  );
}
