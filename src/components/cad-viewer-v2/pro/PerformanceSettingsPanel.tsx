import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface PerformanceSettingsPanelProps {
  shadowsEnabled: boolean;
  setShadowsEnabled: (enabled: boolean) => void;
  ssaoEnabled: boolean;
  setSSAOEnabled: (enabled: boolean) => void;
  quality: 'low' | 'medium' | 'high';
  setQuality: (quality: 'low' | 'medium' | 'high') => void;
  triangleCount: number;
}

const PerformanceSettingsPanel = ({
  shadowsEnabled,
  setShadowsEnabled,
  ssaoEnabled,
  setSSAOEnabled,
  quality,
  setQuality,
  triangleCount,
}: PerformanceSettingsPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fps, setFps] = useState(60);

  // FPS counter
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();

    const updateFps = () => {
      frameCount++;
      const currentTime = performance.now();
      const delta = currentTime - lastTime;

      if (delta >= 1000) {
        setFps(Math.round((frameCount * 1000) / delta));
        frameCount = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(updateFps);
    };

    const animationId = requestAnimationFrame(updateFps);
    return () => cancelAnimationFrame(animationId);
  }, []);

  return (
    <Card 
      className="fixed bottom-4 right-4 z-40 bg-background/95 backdrop-blur-sm border shadow-lg"
      style={{ width: '280px' }}
    >
      <div className="p-3">
        {/* Header with collapse toggle */}
        <div 
          className="flex items-center justify-between cursor-pointer mb-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Visual Settings</h3>
            <span className="text-xs text-muted-foreground">
              {fps} FPS
            </span>
          </div>
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </div>

        {/* Expanded content */}
        {isExpanded && (
          <div className="space-y-4">
            {/* Quality Preset */}
            <div className="space-y-2">
              <Label htmlFor="quality" className="text-xs">Quality Preset</Label>
              <Select value={quality} onValueChange={(value) => setQuality(value as 'low' | 'medium' | 'high')}>
                <SelectTrigger id="quality" className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low (Mobile)</SelectItem>
                  <SelectItem value="medium">Medium (Balanced)</SelectItem>
                  <SelectItem value="high">High (Desktop)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Individual toggles */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="shadows" className="text-xs">Shadows</Label>
                <Switch
                  id="shadows"
                  checked={shadowsEnabled}
                  onCheckedChange={setShadowsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="ssao" className="text-xs">SSAO (Depth)</Label>
                <Switch
                  id="ssao"
                  checked={ssaoEnabled}
                  onCheckedChange={setSSAOEnabled}
                />
              </div>
            </div>

            {/* Stats */}
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Triangles:</span>
                <span>{triangleCount.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PerformanceSettingsPanel;
