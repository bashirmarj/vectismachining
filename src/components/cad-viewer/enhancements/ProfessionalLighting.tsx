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
      {/* Hemisphere Light - Ambient base */}
      <hemisphereLight
        args={['#ffffff', '#444444', 0.3 * intensity]}
      />

      {/* Key Light - Main illumination */}
      <directionalLight
        position={[5, 8, 5]}
        intensity={1.2 * intensity}
        castShadow={enableShadows}
      />

      {/* Fill Light - Softens shadows */}
      <directionalLight
        position={[-4, 4, 4]}
        intensity={0.5 * intensity}
      />

      {/* Rim Light - Edge definition */}
      <directionalLight
        position={[-5, 6, -5]}
        intensity={0.6 * intensity}
      />

      {/* Ambient light to prevent pure black shadows */}
      <ambientLight intensity={0.15 * intensity} />
    </>
  );
}
