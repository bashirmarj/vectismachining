import React from "react";
import { EffectComposer, Bloom, FXAA } from "@react-three/postprocessing";

interface PostProcessingEffectsProps {
  enableBloom?: boolean;
  enableFXAA?: boolean;
  bloomIntensity?: number;
  quality?: "low" | "medium" | "high";
}

/**
 * Simplified Post-Processing Effects
 *
 * Uses only Bloom and FXAA for professional visual quality
 */
export function PostProcessingEffects({
  enableBloom = true,
  enableFXAA = true,
  bloomIntensity = 0.3,
  quality = "medium",
}: PostProcessingEffectsProps) {
  return (
    <EffectComposer multisampling={quality === "high" ? 8 : quality === "medium" ? 4 : 0}>
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
      {enableFXAA && <FXAA />}
    </EffectComposer>
  );
}
