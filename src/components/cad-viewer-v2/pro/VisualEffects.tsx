import { EffectComposer, SSAO, Bloom, FXAA } from '@react-three/postprocessing';
import { Environment } from '@react-three/drei';

interface VisualEffectsProps {
  enabled: boolean;
  quality: 'low' | 'medium' | 'high';
}

const VisualEffects = ({ enabled, quality }: VisualEffectsProps) => {
  // Quality presets for SSAO samples and multisampling
  const qualitySettings = {
    low: { ssaoSamples: 8, multisampling: 2 },
    medium: { ssaoSamples: 16, multisampling: 4 },
    high: { ssaoSamples: 32, multisampling: 8 },
  };

  const settings = qualitySettings[quality];

  return (
    <>
      {/* Environment map for realistic reflections */}
      <Environment preset="city" />

      {/* Post-processing effects */}
      {enabled && (
        <EffectComposer multisampling={settings.multisampling}>
          {/* SSAO - Screen Space Ambient Occlusion for depth perception */}
          <SSAO
            samples={settings.ssaoSamples}
            radius={5}
            intensity={30}
            luminanceInfluence={0.6}
            worldDistanceThreshold={20}
            worldDistanceFalloff={5}
            worldProximityThreshold={10}
            worldProximityFalloff={3}
          />

          {/* Subtle bloom for metallic highlights */}
          <Bloom
            intensity={0.3}
            luminanceThreshold={0.95}
            luminanceSmoothing={0.025}
          />

          {/* FXAA anti-aliasing for smooth edges */}
          <FXAA />
        </EffectComposer>
      )}
    </>
  );
};

export default VisualEffects;
