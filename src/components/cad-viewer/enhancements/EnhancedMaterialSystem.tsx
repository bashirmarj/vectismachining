import React, { useMemo } from 'react';
import { Environment } from '@react-three/drei';
import * as THREE from 'three';

interface EnhancedMaterialProps {
  enableEnvironment?: boolean;
  enablePBR?: boolean;
  metalness?: number;
  roughness?: number;
  envIntensity?: number;
}

/**
 * Enhanced Material System
 * 
 * Wraps the scene with environment mapping and PBR enhancements
 * without modifying the original MeshModel material properties
 */
export function EnhancedMaterialSystem({
  enableEnvironment = true,
  enablePBR = true,
  metalness = 0.15,
  roughness = 0.6,
  envIntensity = 0.5
}: EnhancedMaterialProps) {

  // Create a neutral studio environment map
  const environmentPreset = 'studio' as const;

  return (
    <>
      {/* Environment Map - Provides realistic reflections */}
      {enableEnvironment && (
        <Environment
          preset={environmentPreset}
          background={false}  // Don't replace the background
          environmentIntensity={envIntensity}
        />
      )}

      {/* Optional: Fog for depth perception (very subtle) */}
      {enablePBR && (
        <fog attach="fog" args={['#ffffff', 50, 200]} />
      )}
    </>
  );
}

/**
 * Material Enhancement Configuration
 * 
 * These values can be applied directly to meshStandardMaterial props
 * to enhance PBR rendering without breaking existing materials
 */
export const PBR_ENHANCEMENTS = {
  // Subtle metallic look for CAD parts
  metalness: 0.15,
  
  // Semi-glossy finish (typical for machined aluminum)
  roughness: 0.6,
  
  // Environment map contribution
  envMapIntensity: 0.5,
  
  // Preserve colors correctly
  toneMapped: false,
  
  // Receive shadows from lighting
  receiveShadow: true,
  castShadow: true,
} as const;

/**
 * Hook to get PBR-enhanced material props
 */
export function usePBRMaterialProps(enabled: boolean = true) {
  return useMemo(() => {
    if (!enabled) {
      return {
        toneMapped: false,
        receiveShadow: false,
        castShadow: false,
      };
    }

    return PBR_ENHANCEMENTS;
  }, [enabled]);
}
