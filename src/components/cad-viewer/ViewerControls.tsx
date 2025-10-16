import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Scissors, Grid3x3, Ruler, Maximize2, Move3D, Circle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

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
    <TooltipProvider>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        {/* Glass-morphism horizontal toolbar */}
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-full px-6 py-2 shadow-2xl flex items-center gap-4">
          {/* View Controls Section */}
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mr-2">
              View
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onFitView}
                  className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white transition-all"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black/90 text-white border-white/20">
                <p className="text-xs">Fit View (Space)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleSectionCut}
                  className={`h-8 w-8 rounded-full transition-all border ${
                    showSectionCut
                      ? 'bg-primary/20 border-primary/40 text-white'
                      : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                  }`}
                >
                  <Scissors className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black/90 text-white border-white/20">
                <p className="text-xs">Section Cut</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onToggleEdges}
                  className={`h-8 w-8 rounded-full transition-all border ${
                    showEdges
                      ? 'bg-primary/20 border-primary/40 text-white'
                      : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                  }`}
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black/90 text-white border-white/20">
                <p className="text-xs">Toggle Edges (E)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          <Separator orientation="vertical" className="bg-white/10 h-6" />

          {/* Measurement Tools Section */}
          <div className="flex items-center gap-1.5">
            <Label className="text-[10px] font-semibold text-white/70 uppercase tracking-wider mr-2">
              Measure
            </Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMeasurementModeChange(measurementMode === 'distance' ? null : 'distance')}
                  className={`h-8 w-8 rounded-full transition-all border ${
                    measurementMode === 'distance'
                      ? 'bg-primary/20 border-primary/40 text-white'
                      : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                  }`}
                >
                  <Move3D className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black/90 text-white border-white/20">
                <p className="text-xs">Distance (M)</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMeasurementModeChange(measurementMode === 'radius' ? null : 'radius')}
                  className={`h-8 w-8 rounded-full transition-all border ${
                    measurementMode === 'radius'
                      ? 'bg-primary/20 border-primary/40 text-white'
                      : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                  }`}
                >
                  <Circle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black/90 text-white border-white/20">
                <p className="text-xs">Diameter</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onMeasurementModeChange(measurementMode === 'angle' ? null : 'angle')}
                  className={`h-8 w-8 rounded-full transition-all border ${
                    measurementMode === 'angle'
                      ? 'bg-primary/20 border-primary/40 text-white'
                      : 'bg-white/5 hover:bg-white/15 border-white/10 text-white'
                  }`}
                >
                  <Ruler className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-black/90 text-white border-white/20">
                <p className="text-xs">Angle</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        
        {/* Section Cut Slider - Appears below toolbar when active */}
        {showSectionCut && (
          <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 backdrop-blur-md bg-white/10 border border-white/20 rounded-lg px-4 py-2">
            <Label className="text-[9px] text-white/60 mb-1 block">Section Position</Label>
            <Slider
              value={[sectionPosition]}
              onValueChange={(values) => onSectionPositionChange(values[0])}
              min={-200}
              max={200}
              step={1}
              className="w-48"
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
