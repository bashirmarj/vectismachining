import React, { useMemo } from 'react';
import { EffectComposer, SSAO, Bloom, FXAA } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';

interface PostProcessingEffectsProps {
  enableSSAO?: boolean;
  enableBloom?: boolean;
  enableFXAA?: boolean;
  ssaoIntensity?: number;
  bloomIntensity?: number;
  quality?: 'low' | 'medium' | 'high';
}

/**
 * Professional Post-Processing Effects
 * 
 * - SSAO: Screen Space Ambient Occlusion for depth perception
 * - Bloom: Subtle highlights for metallic surfaces
 * - FXAA: Fast anti-aliasing for clean edges
 */
export function PostProcessingEffects({
  enableSSAO = true,
  enableBloom = true,
  enableFXAA = true,
  ssaoIntensity = 1.0,
  bloomIntensity = 0.3,
  quality = 'medium'
}: PostProcessingEffectsProps) {

  // SSAO samples based on quality
  const ssaoSamples = {
    low: 8,
    medium: 16,
    high: 32
  }[quality];

  // SSAO radius based on quality
  const ssaoRadius = {
    low: 0.5,
    medium: 1.0,
    high: 2.0
  }[quality];

  return (
    <EffectComposer multisampling={quality === 'high' ? 8 : quality === 'medium' ? 4 : 0}>
      {/* SSAO - Screen Space Ambient Occlusion */}
      {enableSSAO && (
        <SSAO
          blendFunction={BlendFunction.MULTIPLY}
          samples={ssaoSamples}
          radius={ssaoRadius}
          intensity={ssaoIntensity * 30}  // Scale for visibility
          luminanceInfluence={0.6}
          color="black"
          bias={0.01}
          distanceScaling={true}
          distanceThreshold={0.5}
          distanceFalloff={0.1}
          rangeThreshold={0.001}
          rangeFalloff={0.001}
        />
      )}

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