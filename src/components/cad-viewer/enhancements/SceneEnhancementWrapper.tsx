import React, { useState } from "react";
import { ProfessionalLighting } from "./ProfessionalLighting";
import { PostProcessingEffects } from "./PostProcessingEffects";
import { EnhancedMaterialSystem } from "./EnhancedMaterialSystem";
import { VisualQualityPanel, VisualQualitySettings, DEFAULT_QUALITY_SETTINGS } from "./VisualQualityPanel";

interface SceneEnhancementWrapperProps {
  children: React.ReactNode;
  showSettingsPanel?: boolean;
  defaultSettings?: Partial<VisualQualitySettings>;
  onSettingsChange?: (settings: VisualQualitySettings) => void;
}

/**
 * Scene Enhancement Wrapper
 *
 * Wraps the existing CAD viewer scene with Phase 1 visual quality enhancements:
 * - Professional 5-light PBR lighting
 * - Post-processing effects (bloom, FXAA)
 * - Enhanced PBR materials with environment reflections
 * - User-adjustable settings panel
 *
 * Usage:
 * ```tsx
 * <Canvas>
 *   <SceneEnhancementWrapper>
 *     <MeshModel {...props} />
 *   </SceneEnhancementWrapper>
 * </Canvas>
 * ```
 */
export function SceneEnhancementWrapper({
  children,
  showSettingsPanel = false,
  defaultSettings = {},
  onSettingsChange,
}: SceneEnhancementWrapperProps) {
  const [settings, setSettings] = useState<VisualQualitySettings>({
    ...DEFAULT_QUALITY_SETTINGS,
    ...defaultSettings,
  });

  const handleSettingsChange = (newSettings: VisualQualitySettings) => {
    setSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  return (
    <>
      {/* Professional Lighting System */}
      {settings.enableLighting && (
        <ProfessionalLighting
          intensity={settings.lightingIntensity}
          enableShadows={settings.enableShadows}
          shadowQuality={settings.shadowQuality}
        />
      )}

      {/* Enhanced Material System (Environment mapping) */}
      {settings.enablePBR && (
        <EnhancedMaterialSystem
          enableEnvironment={settings.enableEnvironment}
          enablePBR={settings.enablePBR}
          envIntensity={settings.envIntensity}
        />
      )}

      {/* Original scene content (MeshModel, etc.) */}
      {children}

      {/* Post-Processing Effects - TEMPORARILY DISABLED FOR DEBUGGING */}
{/*
<PostProcessingEffects
  enableBloom={settings.enableBloom}
  enableFXAA={settings.enableFXAA}
  bloomIntensity={settings.bloomIntensity}
  quality={settings.shadowQuality}
/>
*/}
  );
}

/**
 * Hook to access and control scene enhancement settings
 */
export function useSceneEnhancement() {
  const [settings, setSettings] = useState<VisualQualitySettings>(DEFAULT_QUALITY_SETTINGS);

  return {
    settings,
    updateSettings: setSettings,
    resetToDefaults: () => setSettings(DEFAULT_QUALITY_SETTINGS),
  };
}

/**
 * Export settings panel as separate component for UI integration
 */
export { VisualQualityPanel, DEFAULT_QUALITY_SETTINGS, QUALITY_PRESETS } from "./VisualQualityPanel";
export type { VisualQualitySettings } from "./VisualQualityPanel";
