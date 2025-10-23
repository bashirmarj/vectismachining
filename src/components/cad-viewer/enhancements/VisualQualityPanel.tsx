import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Sun, Sparkles, Zap } from 'lucide-react';

export interface VisualQualitySettings {
  // Lighting
  enableLighting: boolean;
  lightingIntensity: number;
  enableShadows: boolean;
  shadowQuality: 'low' | 'medium' | 'high';
  
  // Post-Processing
  enableSSAO: boolean;
  ssaoIntensity: number;
  enableBloom: boolean;
  bloomIntensity: number;
  enableFXAA: boolean;
  
  // Material
  enablePBR: boolean;
  enableEnvironment: boolean;
  envIntensity: number;
  metalness: number;
  roughness: number;
  
  // Overall
  qualityPreset: 'low' | 'medium' | 'high' | 'custom';
}

export const DEFAULT_QUALITY_SETTINGS: VisualQualitySettings = {
  enableLighting: true,
  lightingIntensity: 1.0,
  enableShadows: true,
  shadowQuality: 'medium',
  
  enableSSAO: true,
  ssaoIntensity: 1.0,
  enableBloom: true,
  bloomIntensity: 0.3,
  enableFXAA: true,
  
  enablePBR: true,
  enableEnvironment: true,
  envIntensity: 0.5,
  metalness: 0.15,
  roughness: 0.6,
  
  qualityPreset: 'medium',
};

// Preset configurations
export const QUALITY_PRESETS: Record<'low' | 'medium' | 'high', Partial<VisualQualitySettings>> = {
  low: {
    shadowQuality: 'low',
    enableSSAO: false,
    enableBloom: false,
    enableFXAA: false,
    enableEnvironment: false,
    qualityPreset: 'low',
  },
  medium: {
    shadowQuality: 'medium',
    enableSSAO: true,
    ssaoIntensity: 0.8,
    enableBloom: true,
    bloomIntensity: 0.2,
    enableFXAA: true,
    enableEnvironment: true,
    envIntensity: 0.5,
    qualityPreset: 'medium',
  },
  high: {
    shadowQuality: 'high',
    enableSSAO: true,
    ssaoIntensity: 1.2,
    enableBloom: true,
    bloomIntensity: 0.4,
    enableFXAA: true,
    enableEnvironment: true,
    envIntensity: 0.7,
    qualityPreset: 'high',
  },
};

interface VisualQualityPanelProps {
  settings: VisualQualitySettings;
  onSettingsChange: (settings: VisualQualitySettings) => void;
  collapsed?: boolean;
}

export function VisualQualityPanel({ 
  settings, 
  onSettingsChange,
  collapsed = false 
}: VisualQualityPanelProps) {

  const updateSettings = (partial: Partial<VisualQualitySettings>) => {
    onSettingsChange({ ...settings, ...partial, qualityPreset: 'custom' });
  };

  const applyPreset = (preset: 'low' | 'medium' | 'high') => {
    onSettingsChange({ ...settings, ...QUALITY_PRESETS[preset] });
  };

  if (collapsed) {
    return (
      <div className="p-2 bg-secondary/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Settings className="h-4 w-4" />
          <span>Quality: {settings.qualityPreset}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Visual Quality Settings
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Quality Preset */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Quality Preset</Label>
          <Select 
            value={settings.qualityPreset} 
            onValueChange={(value) => {
              if (value !== 'custom') {
                applyPreset(value as 'low' | 'medium' | 'high');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low (Performance)</SelectItem>
              <SelectItem value="medium">Medium (Balanced)</SelectItem>
              <SelectItem value="high">High (Quality)</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lighting Section */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sun className="h-4 w-4" />
            <span>Lighting</span>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="enable-lighting" className="text-sm">Professional Lighting</Label>
            <Switch
              id="enable-lighting"
              checked={settings.enableLighting}
              onCheckedChange={(checked) => updateSettings({ enableLighting: checked })}
            />
          </div>

          {settings.enableLighting && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Intensity: {settings.lightingIntensity.toFixed(1)}</Label>
                <Slider
                  value={[settings.lightingIntensity]}
                  onValueChange={([value]) => updateSettings({ lightingIntensity: value })}
                  min={0.5}
                  max={2.0}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enable-shadows" className="text-sm">Shadows</Label>
                <Switch
                  id="enable-shadows"
                  checked={settings.enableShadows}
                  onCheckedChange={(checked) => updateSettings({ enableShadows: checked })}
                />
              </div>

              {settings.enableShadows && (
                <div className="space-y-1 pl-4">
                  <Label className="text-xs">Shadow Quality</Label>
                  <Select 
                    value={settings.shadowQuality}
                    onValueChange={(value) => updateSettings({ 
                      shadowQuality: value as 'low' | 'medium' | 'high' 
                    })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>

        {/* Post-Processing Section */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            <span>Post-Processing</span>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="enable-ssao" className="text-sm">SSAO (Depth)</Label>
            <Switch
              id="enable-ssao"
              checked={settings.enableSSAO}
              onCheckedChange={(checked) => updateSettings({ enableSSAO: checked })}
            />
          </div>

          {settings.enableSSAO && (
            <div className="space-y-1 pl-4">
              <Label className="text-xs">Intensity: {settings.ssaoIntensity.toFixed(1)}</Label>
              <Slider
                value={[settings.ssaoIntensity]}
                onValueChange={([value]) => updateSettings({ ssaoIntensity: value })}
                min={0.5}
                max={2.0}
                step={0.1}
                className="w-full"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="enable-bloom" className="text-sm">Bloom</Label>
            <Switch
              id="enable-bloom"
              checked={settings.enableBloom}
              onCheckedChange={(checked) => updateSettings({ enableBloom: checked })}
            />
          </div>

          {settings.enableBloom && (
            <div className="space-y-1 pl-4">
              <Label className="text-xs">Intensity: {settings.bloomIntensity.toFixed(1)}</Label>
              <Slider
                value={[settings.bloomIntensity]}
                onValueChange={([value]) => updateSettings({ bloomIntensity: value })}
                min={0.1}
                max={1.0}
                step={0.1}
                className="w-full"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="enable-fxaa" className="text-sm">Anti-Aliasing (FXAA)</Label>
            <Switch
              id="enable-fxaa"
              checked={settings.enableFXAA}
              onCheckedChange={(checked) => updateSettings({ enableFXAA: checked })}
            />
          </div>
        </div>

        {/* Material Section */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Zap className="h-4 w-4" />
            <span>Material</span>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="enable-pbr" className="text-sm">PBR Materials</Label>
            <Switch
              id="enable-pbr"
              checked={settings.enablePBR}
              onCheckedChange={(checked) => updateSettings({ enablePBR: checked })}
            />
          </div>

          {settings.enablePBR && (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="enable-env" className="text-sm">Environment Reflections</Label>
                <Switch
                  id="enable-env"
                  checked={settings.enableEnvironment}
                  onCheckedChange={(checked) => updateSettings({ enableEnvironment: checked })}
                />
              </div>

              {settings.enableEnvironment && (
                <div className="space-y-1 pl-4">
                  <Label className="text-xs">Reflection Intensity: {settings.envIntensity.toFixed(1)}</Label>
                  <Slider
                    value={[settings.envIntensity]}
                    onValueChange={([value]) => updateSettings({ envIntensity: value })}
                    min={0.1}
                    max={1.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs">Metalness: {settings.metalness.toFixed(2)}</Label>
                <Slider
                  value={[settings.metalness]}
                  onValueChange={([value]) => updateSettings({ metalness: value })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Roughness: {settings.roughness.toFixed(2)}</Label>
                <Slider
                  value={[settings.roughness]}
                  onValueChange={([value]) => updateSettings({ roughness: value })}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
