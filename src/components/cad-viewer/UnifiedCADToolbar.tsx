import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Home,
  Eye,
  Ruler,
  Scissors,
  Settings,
  Maximize2,
  Box,
  Grid3x3,
  Layers,
  Triangle,
  Circle,
  SplitSquareVertical,
  SunMedium,
  Sparkles,
  Gauge,
} from "lucide-react";
import { useMeasurementStore } from "@/stores/measurementStore";
import { useState } from "react";

interface UnifiedCADToolbarProps {
  // View controls
  onHomeView: () => void;
  onFrontView: () => void;
  onTopView: () => void;
  onIsometricView: () => void;
  onFitView: () => void;

  // Display modes
  displayStyle: "solid" | "wireframe" | "translucent";
  setDisplayStyle: (style: "solid" | "wireframe" | "translucent") => void;
  showEdges: boolean;
  setShowEdges: (show: boolean) => void;

  // Section planes
  sectionPlane: "none" | "xy" | "xz" | "yz";
  setSectionPlane: (plane: "none" | "xy" | "xz" | "yz") => void;
  sectionPosition: number;
  setSectionPosition: (pos: number) => void;

  // Visual settings
  shadowsEnabled: boolean;
  setShadowsEnabled: (enabled: boolean) => void;
  ssaoEnabled: boolean;
  setSSAOEnabled: (enabled: boolean) => void;
  quality: "low" | "medium" | "high";
  setQuality: (quality: "low" | "medium" | "high") => void;
}

/**
 * Unified CAD Toolbar Component
 * Fusion 360 / Onshape style compact toolbar at top of viewport
 * Consolidates all viewer controls in one professional interface
 */
export function UnifiedCADToolbar({
  onHomeView,
  onFrontView,
  onTopView,
  onIsometricView,
  onFitView,
  displayStyle,
  setDisplayStyle,
  showEdges,
  setShowEdges,
  sectionPlane,
  setSectionPlane,
  sectionPosition,
  setSectionPosition,
  shadowsEnabled,
  setShadowsEnabled,
  ssaoEnabled,
  setSSAOEnabled,
  quality,
  setQuality,
}: UnifiedCADToolbarProps) {
  const { activeTool, setActiveTool } = useMeasurementStore();
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-white/95 backdrop-blur-md rounded-lg shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-1">
          {/* VIEW CONTROLS */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Home className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>View Controls</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Camera Views</DropdownMenuLabel>
              <DropdownMenuItem onClick={onHomeView}>
                <Home className="mr-2 h-4 w-4" />
                Home View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onFrontView}>
                <Box className="mr-2 h-4 w-4" />
                Front View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onTopView}>
                <Grid3x3 className="mr-2 h-4 w-4" />
                Top View
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onIsometricView}>
                <Layers className="mr-2 h-4 w-4" />
                Isometric View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onFitView}>
                <Maximize2 className="mr-2 h-4 w-4" />
                Fit to Screen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* DISPLAY MODE */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={displayStyle !== "solid" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Display Mode</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Display Style</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setDisplayStyle("solid")}>
                <Box className="mr-2 h-4 w-4" />
                Solid {displayStyle === "solid" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisplayStyle("wireframe")}>
                <Grid3x3 className="mr-2 h-4 w-4" />
                Wireframe {displayStyle === "wireframe" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDisplayStyle("translucent")}>
                <Layers className="mr-2 h-4 w-4" />
                Translucent {displayStyle === "translucent" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowEdges(!showEdges)}>
                <Grid3x3 className="mr-2 h-4 w-4" />
                Show Edges {showEdges && "✓"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* MEASUREMENT TOOLS */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={activeTool ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0 relative"
                  >
                    <Ruler className="h-4 w-4" />
                    {activeTool && (
                      <Badge className="absolute -top-1 -right-1 h-3 w-3 p-0 flex items-center justify-center text-[8px] bg-blue-500">
                        !
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Measurement Tools</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>Measure</DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setActiveTool(activeTool === "distance" ? null : "distance")}
              >
                <Ruler className="mr-2 h-4 w-4" />
                Distance {activeTool === "distance" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTool(activeTool === "angle" ? null : "angle")}>
                <Triangle className="mr-2 h-4 w-4" />
                Angle {activeTool === "angle" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setActiveTool(activeTool === "radius" ? null : "radius")}>
                <Circle className="mr-2 h-4 w-4" />
                Radius {activeTool === "radius" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTool(activeTool === "diameter" ? null : "diameter")}
              >
                <Circle className="mr-2 h-4 w-4" />
                Diameter {activeTool === "diameter" && "✓"}
              </DropdownMenuItem>
              {activeTool && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveTool(null)} className="text-red-600">
                    <X className="mr-2 h-4 w-4" />
                    Cancel Tool
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* SECTION PLANES */}
          <DropdownMenu open={sectionMenuOpen} onOpenChange={setSectionMenuOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={sectionPlane !== "none" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <Scissors className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Section Planes</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Section Planes</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setSectionPlane("none")}>
                <SplitSquareVertical className="mr-2 h-4 w-4" />
                None {sectionPlane === "none" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSectionPlane("xy")}>
                <Box className="mr-2 h-4 w-4" />
                XY Plane {sectionPlane === "xy" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSectionPlane("xz")}>
                <Box className="mr-2 h-4 w-4" />
                XZ Plane {sectionPlane === "xz" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSectionPlane("yz")}>
                <Box className="mr-2 h-4 w-4" />
                YZ Plane {sectionPlane === "yz" && "✓"}
              </DropdownMenuItem>

              {sectionPlane !== "none" && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-3">
                    <div className="text-xs text-gray-600 mb-2">Position: {sectionPosition.toFixed(2)}</div>
                    <Slider
                      value={[sectionPosition]}
                      onValueChange={(value) => setSectionPosition(value[0])}
                      min={-1}
                      max={1}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6" />

          {/* VISUAL SETTINGS */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Visual Settings</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>Visual Quality</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setShadowsEnabled(!shadowsEnabled)}>
                <SunMedium className="mr-2 h-4 w-4" />
                Shadows {shadowsEnabled && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSSAOEnabled(!ssaoEnabled)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Ambient Occlusion {ssaoEnabled && "✓"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Performance</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setQuality("low")}>
                <Gauge className="mr-2 h-4 w-4" />
                Low Quality {quality === "low" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuality("medium")}>
                <Gauge className="mr-2 h-4 w-4" />
                Medium Quality {quality === "medium" && "✓"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuality("high")}>
                <Gauge className="mr-2 h-4 w-4" />
                High Quality {quality === "high" && "✓"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Active Tool Indicator */}
        {activeTool && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-blue-50 border border-blue-200 rounded-md px-3 py-1.5 shadow-sm">
            <p className="text-xs text-blue-700 font-medium">
              <span className="capitalize">{activeTool}</span> Tool Active • Click{" "}
              {activeTool === "distance" ? "2" : "3"} points • ESC to cancel
            </p>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}