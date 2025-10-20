import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ChevronDown,
  Circle,
  Box,
  Cylinder,
  Eye,
} from 'lucide-react';

// ⭐ NEW: Interface for feature selection
interface SelectedFeature {
  type: 'through_hole' | 'blind_hole' | 'bore' | 'boss' | 'fillet';
  index: number;
  triangleStart: number;
  triangleEnd: number;
  center: [number, number, number];
  diameter?: number;
  label: string;
}

interface ManufacturingFeatures {
  through_holes?: Array<{
    diameter: number;
    position: [number, number, number];
    triangle_start?: number;
    triangle_end?: number;
    center?: [number, number, number];
  }>;
  blind_holes?: Array<{
    diameter: number;
    depth?: number;
    position: [number, number, number];
    triangle_start?: number;
    triangle_end?: number;
    center?: [number, number, number];
  }>;
  bores?: Array<{
    diameter: number;
    position: [number, number, number];
    triangle_start?: number;
    triangle_end?: number;
    center?: [number, number, number];
  }>;
  bosses?: Array<{
    diameter: number;
    position: [number, number, number];
    triangle_start?: number;
    triangle_end?: number;
    center?: [number, number, number];
  }>;
  fillets?: Array<{
    area: number;
    triangle_start?: number;
    triangle_end?: number;
    center?: [number, number, number];
  }>;
}

interface FeatureSummary {
  through_holes: number;
  blind_holes: number;
  bores: number;
  bosses: number;
  fillets: number;
  complexity_score: number;
}

interface FeatureTreeProps {
  manufacturing_features?: ManufacturingFeatures;
  feature_summary?: FeatureSummary;
  onFeatureSelect?: (feature: SelectedFeature | null) => void; // ⭐ NEW: Callback for selection
}

const FeatureTree: React.FC<FeatureTreeProps> = ({ 
  manufacturing_features, 
  feature_summary,
  onFeatureSelect 
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['through_holes', 'blind_holes', 'bores', 'bosses'])
  );
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // ⭐ NEW: Handle feature click
  const handleFeatureClick = (feature: SelectedFeature, featureId: string) => {
    if (selectedFeatureId === featureId) {
      // Deselect if clicking the same feature
      setSelectedFeatureId(null);
      onFeatureSelect?.(null);
    } else {
      // Select new feature
      setSelectedFeatureId(featureId);
      onFeatureSelect?.(feature);
    }
  };

  if (!manufacturing_features || !feature_summary) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="w-5 h-5" />
            Manufacturing Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Circle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No feature data available</p>
            <p className="text-sm mt-1">Upload and analyze a CAD file to see detected features.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const through_holes = manufacturing_features.through_holes || [];
  const blind_holes = manufacturing_features.blind_holes || [];
  const bores = manufacturing_features.bores || [];
  const bosses = manufacturing_features.bosses || [];
  const fillets = manufacturing_features.fillets || [];

  const totalFeatures = 
    through_holes.length + 
    blind_holes.length + 
    bores.length + 
    bosses.length + 
    fillets.length;

  // ⭐ SECTION: Through-Holes
  const renderThroughHoles = () => {
    if (through_holes.length === 0) return null;
    
    const isExpanded = expandedSections.has('through_holes');

    return (
      <div className="mb-3">
        <button
          onClick={() => toggleSection('through_holes')}
          className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <Circle className="w-4 h-4 flex-shrink-0 text-yellow-600" fill="currentColor" />
          <span className="font-medium">Through-Holes</span>
          <Badge variant="secondary" className="ml-auto">{through_holes.length}</Badge>
        </button>

        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {through_holes.map((hole, idx) => {
              const featureId = `through_hole_${idx}`;
              const isSelected = selectedFeatureId === featureId;
              const hasMapping = hole.triangle_start !== undefined && hole.triangle_end !== undefined;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (hasMapping) {
                      handleFeatureClick({
                        type: 'through_hole',
                        index: idx,
                        triangleStart: hole.triangle_start!,
                        triangleEnd: hole.triangle_end!,
                        center: hole.center || hole.position,
                        diameter: hole.diameter,
                        label: `Through-Hole ${idx + 1} - Ø${hole.diameter.toFixed(1)}mm`
                      }, featureId);
                    }
                  }}
                  disabled={!hasMapping}
                  className={`w-full flex items-center gap-2 p-2 pl-6 rounded text-sm transition-colors ${
                    isSelected 
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                      : 'hover:bg-accent'
                  } ${!hasMapping ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Cylinder className="w-3 h-3 flex-shrink-0 text-yellow-600" />
                  <span className="flex-1 text-left">
                    Hole {idx + 1} - Ø{hole.diameter.toFixed(1)}mm (Through)
                  </span>
                  {isSelected && <Eye className="w-4 h-4 text-orange-500" />}
                  {hasMapping && !isSelected && (
                    <span className="text-xs text-muted-foreground">Click to highlight</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ⭐ SECTION: Blind Holes
  const renderBlindHoles = () => {
    if (blind_holes.length === 0) return null;
    
    const isExpanded = expandedSections.has('blind_holes');

    return (
      <div className="mb-3">
        <button
          onClick={() => toggleSection('blind_holes')}
          className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <Circle className="w-4 h-4 flex-shrink-0 text-red-600" fill="currentColor" />
          <span className="font-medium">Blind Holes</span>
          <Badge variant="secondary" className="ml-auto">{blind_holes.length}</Badge>
        </button>

        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {blind_holes.map((hole, idx) => {
              const featureId = `blind_hole_${idx}`;
              const isSelected = selectedFeatureId === featureId;
              const hasMapping = hole.triangle_start !== undefined && hole.triangle_end !== undefined;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (hasMapping) {
                      handleFeatureClick({
                        type: 'blind_hole',
                        index: idx,
                        triangleStart: hole.triangle_start!,
                        triangleEnd: hole.triangle_end!,
                        center: hole.center || hole.position,
                        diameter: hole.diameter,
                        label: `Blind Hole ${idx + 1} - Ø${hole.diameter.toFixed(1)}mm × ${hole.depth?.toFixed(1) || '?'}mm deep`
                      }, featureId);
                    }
                  }}
                  disabled={!hasMapping}
                  className={`w-full flex items-center gap-2 p-2 pl-6 rounded text-sm transition-colors ${
                    isSelected 
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                      : 'hover:bg-accent'
                  } ${!hasMapping ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Cylinder className="w-3 h-3 flex-shrink-0 text-red-600" />
                  <span className="flex-1 text-left">
                    Hole {idx + 1} - Ø{hole.diameter.toFixed(1)}mm × {hole.depth?.toFixed(1) || '?'}mm deep
                  </span>
                  {isSelected && <Eye className="w-4 h-4 text-orange-500" />}
                  {hasMapping && !isSelected && (
                    <span className="text-xs text-muted-foreground">Click to highlight</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ⭐ SECTION: Bores
  const renderBores = () => {
    if (bores.length === 0) return null;
    
    const isExpanded = expandedSections.has('bores');

    return (
      <div className="mb-3">
        <button
          onClick={() => toggleSection('bores')}
          className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <Circle className="w-4 h-4 flex-shrink-0 text-purple-600" fill="currentColor" />
          <span className="font-medium">Bores</span>
          <Badge variant="secondary" className="ml-auto">{bores.length}</Badge>
        </button>

        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {bores.map((bore, idx) => {
              const featureId = `bore_${idx}`;
              const isSelected = selectedFeatureId === featureId;
              const hasMapping = bore.triangle_start !== undefined && bore.triangle_end !== undefined;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (hasMapping) {
                      handleFeatureClick({
                        type: 'bore',
                        index: idx,
                        triangleStart: bore.triangle_start!,
                        triangleEnd: bore.triangle_end!,
                        center: bore.center || bore.position,
                        diameter: bore.diameter,
                        label: `Bore ${idx + 1} - Ø${bore.diameter.toFixed(1)}mm`
                      }, featureId);
                    }
                  }}
                  disabled={!hasMapping}
                  className={`w-full flex items-center gap-2 p-2 pl-6 rounded text-sm transition-colors ${
                    isSelected 
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                      : 'hover:bg-accent'
                  } ${!hasMapping ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Cylinder className="w-3 h-3 flex-shrink-0 text-purple-600" />
                  <span className="flex-1 text-left">
                    Bore {idx + 1} - Ø{bore.diameter.toFixed(1)}mm
                  </span>
                  {isSelected && <Eye className="w-4 h-4 text-orange-500" />}
                  {hasMapping && !isSelected && (
                    <span className="text-xs text-muted-foreground">Click to highlight</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ⭐ SECTION: Bosses
  const renderBosses = () => {
    if (bosses.length === 0) return null;
    
    const isExpanded = expandedSections.has('bosses');

    return (
      <div className="mb-3">
        <button
          onClick={() => toggleSection('bosses')}
          className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <Circle className="w-4 h-4 flex-shrink-0 text-green-600" fill="currentColor" />
          <span className="font-medium">Bosses</span>
          <Badge variant="secondary" className="ml-auto">{bosses.length}</Badge>
        </button>

        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {bosses.map((boss, idx) => {
              const featureId = `boss_${idx}`;
              const isSelected = selectedFeatureId === featureId;
              const hasMapping = boss.triangle_start !== undefined && boss.triangle_end !== undefined;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (hasMapping) {
                      handleFeatureClick({
                        type: 'boss',
                        index: idx,
                        triangleStart: boss.triangle_start!,
                        triangleEnd: boss.triangle_end!,
                        center: boss.center || boss.position,
                        diameter: boss.diameter,
                        label: `Boss ${idx + 1} - Ø${boss.diameter.toFixed(1)}mm`
                      }, featureId);
                    }
                  }}
                  disabled={!hasMapping}
                  className={`w-full flex items-center gap-2 p-2 pl-6 rounded text-sm transition-colors ${
                    isSelected 
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                      : 'hover:bg-accent'
                  } ${!hasMapping ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Cylinder className="w-3 h-3 flex-shrink-0 text-green-600" />
                  <span className="flex-1 text-left">
                    Boss {idx + 1} - Ø{boss.diameter.toFixed(1)}mm
                  </span>
                  {isSelected && <Eye className="w-4 h-4 text-orange-500" />}
                  {hasMapping && !isSelected && (
                    <span className="text-xs text-muted-foreground">Click to highlight</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ⭐ SECTION: Fillets
  const renderFillets = () => {
    if (fillets.length === 0) return null;
    
    const isExpanded = expandedSections.has('fillets');

    return (
      <div className="mb-3">
        <button
          onClick={() => toggleSection('fillets')}
          className="w-full flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors text-left"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 flex-shrink-0" />
          )}
          <Circle className="w-4 h-4 flex-shrink-0 text-blue-600" fill="currentColor" />
          <span className="font-medium">Fillets</span>
          <Badge variant="secondary" className="ml-auto">{fillets.length}</Badge>
        </button>

        {isExpanded && (
          <div className="ml-6 mt-1 space-y-1">
            {fillets.map((fillet, idx) => {
              const featureId = `fillet_${idx}`;
              const isSelected = selectedFeatureId === featureId;
              const hasMapping = fillet.triangle_start !== undefined && fillet.triangle_end !== undefined;

              return (
                <button
                  key={idx}
                  onClick={() => {
                    if (hasMapping) {
                      handleFeatureClick({
                        type: 'fillet',
                        index: idx,
                        triangleStart: fillet.triangle_start!,
                        triangleEnd: fillet.triangle_end!,
                        center: fillet.center || [0, 0, 0],
                        label: `Fillet ${idx + 1}`
                      }, featureId);
                    }
                  }}
                  disabled={!hasMapping}
                  className={`w-full flex items-center gap-2 p-2 pl-6 rounded text-sm transition-colors ${
                    isSelected 
                      ? 'bg-orange-100 dark:bg-orange-900/30 border-2 border-orange-500' 
                      : 'hover:bg-accent'
                  } ${!hasMapping ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <Circle className="w-3 h-3 flex-shrink-0 text-blue-600" />
                  <span className="flex-1 text-left">
                    Fillet {idx + 1}
                  </span>
                  {isSelected && <Eye className="w-4 h-4 text-orange-500" />}
                  {hasMapping && !isSelected && (
                    <span className="text-xs text-muted-foreground">Click to highlight</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="w-5 h-5" />
            Manufacturing Features
          </div>
          <Badge variant="outline" className="text-sm">
            {totalFeatures} {totalFeatures === 1 ? 'Feature' : 'Features'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Complexity Score Badge */}
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Complexity Score</span>
              <Badge 
                variant={
                  feature_summary.complexity_score >= 7 ? 'destructive' : 
                  feature_summary.complexity_score >= 4 ? 'default' : 
                  'secondary'
                }
              >
                {feature_summary.complexity_score}/10
              </Badge>
            </div>
          </div>

          {/* Feature Tree */}
          {renderThroughHoles()}
          {renderBlindHoles()}
          {renderBores()}
          {renderBosses()}
          {renderFillets()}

          {/* Help Text */}
          <div className="mt-4 p-3 bg-muted/50 rounded text-xs text-muted-foreground">
            💡 Click any feature to highlight it in the 3D viewer and zoom to its location
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FeatureTree;
