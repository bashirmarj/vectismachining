import React from "react";

interface PostProcessingEffectsProps {
  enableBloom?: boolean;
  enableFXAA?: boolean;
  bloomIntensity?: number;
  quality?: "low" | "medium" | "high";
}

/**
 * Simplified Post-Processing - Temporarily disabled until cache issues resolved
 */
export function PostProcessingEffects(props: PostProcessingEffectsProps) {
  // Return null to disable all post-processing
  return null;
}
