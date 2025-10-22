import { useState } from 'react';
import { Orbit, Maximize2, Home, Grid3x3, Box, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Separator } from '@/components/ui/separator';

export type ViewMode = 'orbit' | 'measure' | 'section';
export type DisplayStyle = 'solid' | 'wireframe' | 'shaded-edges';
export type ViewPreset = 'isometric' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom';

interface ToolbarProps {
  activeMode?: ViewMode;
  onModeChange?: (mode: ViewMode) => void;
  displayStyle?: DisplayStyle;
  onDisplayStyleChange?: (style: DisplayStyle) => void;
  onViewPreset?: (preset: ViewPreset) => void;
  onFitView?: () => void;
  onResetCamera?: () => void;
}

const Toolbar = ({
  activeMode = 'orbit',
  onModeChange,
  displayStyle = 'solid',
  onDisplayStyleChange,
  onViewPreset,
  onFitView,
  onResetCamera,
}: ToolbarProps) => {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-2 backdrop-blur-md bg-card/80 border border-border/50 rounded-lg px-3 py-2 shadow-lg">
        {/* View Mode */}
        <div className="flex items-center gap-1">
          <Button
            variant={activeMode === 'orbit' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => onModeChange?.('orbit')}
            className="h-8 w-8 p-0"
            title="Orbit Mode (Default)"
          >
            <Orbit className="h-4 w-4" />
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* View Presets */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              <Grid3x3 className="h-4 w-4" />
              <span className="text-xs">View</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuItem onClick={() => onViewPreset?.('isometric')}>
              Isometric
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewPreset?.('front')}>
              Front
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewPreset?.('back')}>
              Back
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewPreset?.('left')}>
              Left
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewPreset?.('right')}>
              Right
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewPreset?.('top')}>
              Top
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onViewPreset?.('bottom')}>
              Bottom
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Separator orientation="vertical" className="h-6" />

        {/* Display Style */}
        <ToggleGroup
          type="single"
          value={displayStyle}
          onValueChange={(value) => value && onDisplayStyleChange?.(value as DisplayStyle)}
          className="gap-1"
        >
          <ToggleGroupItem value="solid" aria-label="Solid" className="h-8 w-8 p-0" title="Solid">
            <Box className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="wireframe" aria-label="Wireframe" className="h-8 w-8 p-0" title="Wireframe">
            <Grid3x3 className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="shaded-edges" aria-label="Shaded with Edges" className="h-8 w-8 p-0" title="Shaded with Edges">
            <Layers className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Separator orientation="vertical" className="h-6" />

        {/* Quick Actions */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onFitView}
            className="h-8 w-8 p-0"
            title="Fit View (Space)"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetCamera}
            className="h-8 w-8 p-0"
            title="Reset Camera (Home)"
          >
            <Home className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
