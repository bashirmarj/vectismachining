import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Scissors, Grid3x3, Ruler, Maximize2, Move3D, Circle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface ViewerControlsProps {
  showSectionCut: boolean;
  onToggleSectionCut: () => void;
  sectionPosition: number;
  onSectionPositionChange: (value: number) => void;
  showEdges: boolean;
  onToggleEdges: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
  measurementMode: 'distance' | 'angle' | 'radius' | null;
  onMeasurementModeChange: (mode: 'distance' | 'angle' | 'radius' | null) => void;
  onFitView: () => void;
}

export function ViewerControls({
  showSectionCut,
  onToggleSectionCut,
  sectionPosition,
  onSectionPositionChange,
  showEdges,
  onToggleEdges,
  showDimensions,
  onToggleDimensions,
  measurementMode,
  onMeasurementModeChange,
  onFitView,
}: ViewerControlsProps) {
  return (
    <Card className="absolute top-4 right-4 p-4 bg-background/95 backdrop-blur z-10 space-y-4 w-72 shadow-lg">
      <div className="space-y-3">
        <Label className="text-sm font-semibold">View Controls</Label>
        
        {/* Primary view controls */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={showEdges ? "default" : "outline"}
            size="sm"
            onClick={onToggleEdges}
          >
            <Grid3x3 className="h-4 w-4 mr-1.5" />
            Edges
          </Button>
          
          <Button
            variant={showSectionCut ? "default" : "outline"}
            size="sm"
            onClick={onToggleSectionCut}
          >
            <Scissors className="h-4 w-4 mr-1.5" />
            Section
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={onFitView}
          >
            <Maximize2 className="h-4 w-4 mr-1.5" />
            Fit View
          </Button>
          
          <Button
            variant={showDimensions ? "default" : "outline"}
            size="sm"
            onClick={onToggleDimensions}
          >
            <Ruler className="h-4 w-4 mr-1.5" />
            Dims
          </Button>
        </div>
        
        {showSectionCut && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Section Position</Label>
              <Slider
                value={[sectionPosition]}
                onValueChange={(values) => onSectionPositionChange(values[0])}
                min={-200}
                max={200}
                step={1}
                className="w-full"
              />
            </div>
          </>
        )}
        
        <Separator />
        
        {/* Measurement tools */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold">Measurement Tools</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={measurementMode === 'distance' ? "default" : "outline"}
              size="sm"
              onClick={() => onMeasurementModeChange(measurementMode === 'distance' ? null : 'distance')}
            >
              <Move3D className="h-4 w-4" />
            </Button>
            
            <Button
              variant={measurementMode === 'radius' ? "default" : "outline"}
              size="sm"
              onClick={() => onMeasurementModeChange(measurementMode === 'radius' ? null : 'radius')}
            >
              <Circle className="h-4 w-4" />
            </Button>
            
            <Button
              variant={measurementMode === 'angle' ? "default" : "outline"}
              size="sm"
              onClick={() => onMeasurementModeChange(measurementMode === 'angle' ? null : 'angle')}
            >
              <Ruler className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {measurementMode === 'distance' && 'Click two points to measure distance'}
            {measurementMode === 'radius' && 'Click circular edge to measure radius'}
            {measurementMode === 'angle' && 'Click two edges to measure angle'}
            {!measurementMode && 'Select a measurement tool'}
          </p>
        </div>
      </div>
    </Card>
  );
}
