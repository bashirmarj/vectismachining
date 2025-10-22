import { Environment } from '@react-three/drei';

interface VisualEffectsProps {
  enabled: boolean;
  quality: 'low' | 'medium' | 'high';
}

const VisualEffects = ({ enabled, quality }: VisualEffectsProps) => {
  // For now, we'll use just the Environment map
  // EffectComposer has compatibility issues with current setup
  // TODO: Re-enable SSAO, Bloom, FXAA once dependency issues are resolved
  
  if (!enabled) return null;

  return (
    <>
      {/* Environment map for realistic reflections */}
      <Environment preset="city" />
    </>
  );
};

export default VisualEffects;
