import React from 'react';
import { EffectComposer, Bloom, FXAA } from '@react-three/postprocessing';

interface PostProcessingEffectsProps {
  enableSSAO?: boolean;
  enableBloom?: boolean;
  enableFXAA?: boolean;
  ssaoIntensity?: number;
  bloomIntensity?: number;
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Simplified Post-Processing Effects
 * 
 * Uses only Bloom and FXAA for now (SSAO disabled due to compatibility)
 */
export function PostProcessingEffects({
  enableBloom = true,
  enableFXAA = true,
  bloomIntensity = 0.3,
  quality = 'medium'
}: PostProcessingEffectsProps) {

  return (
    <EffectComposer multisampling={quality === 'high' ? 8 : quality === 'medium' ? 4 : 0}>
      {/* Bloom - Subtle highlights */}
      {enableBloom && (
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.9}
          luminanceSmoothing={0.9}
          mipmapBlur={true}
          radius={0.5}
        />
      )}

      {/* FXAA - Fast Anti-Aliasing */}
      {enableFXAA && (
        <FXAA />
      )}
    </EffectComposer>
  );
}
