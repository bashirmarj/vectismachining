import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Scissors, Grid3x3, Ruler } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface ViewerControlsProps {
  showSectionCut: boolean;
  onToggleSectionCut: () => void;
  sectionPosition: number;
  onSectionPositionChange: (value: number) => void;
  showEdges: boolean;
  onToggleEdges: () => void;
  showDimensions: boolean;
  onToggleDimensions: () => void;
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
}: ViewerControlsProps) {
  return (
    <Card className="absolute top-4 right-4 p-4 bg-background/95 backdrop-blur z-10 space-y-4 w-64">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Viewer Controls</Label>
        
        <div className="flex gap-2">
          <Button
            variant={showEdges ? "default" : "outline"}
            size="sm"
            onClick={onToggleEdges}
            className="flex-1"
          >
            <Grid3x3 className="h-4 w-4 mr-2" />
            Edges
          </Button>
          
          <Button
            variant={showSectionCut ? "default" : "outline"}
            size="sm"
            onClick={onToggleSectionCut}
            className="flex-1"
          >
            <Scissors className="h-4 w-4 mr-2" />
            Section
          </Button>
        </div>
        
        <Button
          variant={showDimensions ? "default" : "outline"}
          size="sm"
          onClick={onToggleDimensions}
          className="w-full"
        >
          <Ruler className="h-4 w-4 mr-2" />
          Dimensions
        </Button>
      </div>
      
      {showSectionCut && (
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
      )}
    </Card>
  );
}
