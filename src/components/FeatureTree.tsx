import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  ChevronDown,
  Circle,
  Box,
  Cylinder,
  Wrench,
  Drill,
  AlertCircle,
} from 'lucide-react';

// TypeScript Interfaces
interface ManufacturingFeature {
  diameter?: number;
  radius?: number;
  depth?: number;
  area?: number;
  position?: [number, number, number];
  axis?: [number, number, number];
}

interface FeatureSummary {
  through_holes: number;
  blind_holes: number;
  bores: number;
  bosses: number;
  total_holes: number;
  fillets: number;
  planar_faces: number;
  complexity_score: number;
}

interface ManufacturingFeatures {
  through_holes?: ManufacturingFeature[];
  blind_holes?: ManufacturingFeature[];
  bores?: ManufacturingFeature[];
  bosses?: ManufacturingFeature[];
  planar_faces?: ManufacturingFeature[];
  fillets?: ManufacturingFeature[];
  complex_surfaces?: ManufacturingFeature[];
}

interface FeatureTreeProps {
  features?: ManufacturingFeatures;
  featureSummary?: FeatureSummary;
  // Support old format for backward compatibility
  featureTree?: {
    oriented_sections?: any[];
    common_dimensions?: any;
  };
}

const FeatureTree: React.FC<FeatureTreeProps> = ({ 
  features, 
  featureSummary,
  featureTree 
}) => {
  // State for expandable sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([
      'manufacturing',
      'surfaces',
      'through-holes',
      'blind-holes',
      'bores',
      'bosses'
    ])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const expandAll = () => {
    setExpandedSections(new Set([
      'manufacturing',
      'surfaces',
      'through-holes',
      'blind-holes',
      'bores',
      'bosses',
      'planar-faces',
      'fillets'
    ]));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  // Helper to format numbers
  const formatNumber = (num: number | undefined, decimals: number = 2): string => {
    if (num === undefined || num === null) return 'N/A';
    return num.toFixed(decimals);
  };

  // Get complexity color
  const getComplexityColor = (score: number): string => {
    if (score <= 3) return 'text-green-600';
    if (score <= 6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getComplexityBadge = (score: number): string => {
    if (score <= 3) return 'bg-green-100 text-green-800';
    if (score <= 6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  // Check if we have new format data
  const hasNewFormat = features || featureSummary;
  
  // If no data at all, show empty state
  if (!hasNewFormat && !featureTree) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            No Feature Data Available
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Upload and analyze a CAD file to see detected manufacturing features.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Render new format (manufacturing features)
  if (hasNewFormat) {
    return (
      <div className="space-y-4">
        {/* Header Card with Summary */}
        {featureSummary && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Manufacturing Features</CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={expandAll}>
                    Expand All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={collapseAll}>
                    Collapse All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Complexity Score */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium">Complexity Score</span>
                <Badge className={getComplexityBadge(featureSummary.complexity_score)}>
                  {featureSummary.complexity_score} / 10
                </Badge>
              </div>

              {/* Quick Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="text-2xl font-bold text-yellow-700">
                    {featureSummary.through_holes}
                  </div>
                  <div className="text-sm text-gray-600">Through-Holes</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-2xl font-bold text-orange-700">
                    {featureSummary.blind_holes}
                  </div>
                  <div className="text-sm text-gray-600">Blind Holes</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-700">
                    {featureSummary.bores}
                  </div>
                  <div className="text-sm text-gray-600">Bores</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-700">
                    {featureSummary.bosses}
                  </div>
                  <div className="text-sm text-gray-600">Bosses</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Features Card */}
        {features && (
          <Card>
            <CardHeader>
              <CardTitle>Detailed Feature Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {/* Manufacturing Features Section */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('manufacturing')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.has('manufacturing') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-medium">Manufacturing Features</span>
                  </div>
                  <Badge variant="secondary">
                    {(features.through_holes?.length || 0) + 
                     (features.blind_holes?.length || 0) + 
                     (features.bores?.length || 0) + 
                     (features.bosses?.length || 0)}
                  </Badge>
                </button>
                
                {expandedSections.has('manufacturing') && (
                  <div className="p-3 space-y-3">
                    {/* Through-Holes */}
                    {features.through_holes && features.through_holes.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleSection('through-holes')}
                          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedSections.has('through-holes') ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <Drill className="w-4 h-4 text-yellow-600" />
                            <span className="text-sm font-medium">Through-Holes</span>
                          </div>
                          <Badge variant="outline" className="bg-yellow-50">
                            {features.through_holes.length}
                          </Badge>
                        </button>
                        
                        {expandedSections.has('through-holes') && (
                          <div className="ml-6 mt-2 space-y-2">
                            {features.through_holes.map((hole, idx) => (
                              <div key={idx} className="p-2 bg-yellow-50 rounded text-sm">
                                <div className="font-medium">Hole {idx + 1}</div>
                                <div className="text-gray-600 space-y-1 mt-1">
                                  <div>Diameter: {formatNumber(hole.diameter)} mm</div>
                                  {hole.area && <div>Area: {formatNumber(hole.area)} mm²</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Blind Holes */}
                    {features.blind_holes && features.blind_holes.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleSection('blind-holes')}
                          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedSections.has('blind-holes') ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <Drill className="w-4 h-4 text-orange-600" />
                            <span className="text-sm font-medium">Blind Holes</span>
                          </div>
                          <Badge variant="outline" className="bg-orange-50">
                            {features.blind_holes.length}
                          </Badge>
                        </button>
                        
                        {expandedSections.has('blind-holes') && (
                          <div className="ml-6 mt-2 space-y-2">
                            {features.blind_holes.map((hole, idx) => (
                              <div key={idx} className="p-2 bg-orange-50 rounded text-sm">
                                <div className="font-medium">Blind Hole {idx + 1}</div>
                                <div className="text-gray-600 space-y-1 mt-1">
                                  <div>Diameter: {formatNumber(hole.diameter)} mm</div>
                                  {hole.depth && <div>Depth: {formatNumber(hole.depth)} mm</div>}
                                  {hole.area && <div>Area: {formatNumber(hole.area)} mm²</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bores */}
                    {features.bores && features.bores.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleSection('bores')}
                          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedSections.has('bores') ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <Cylinder className="w-4 h-4 text-red-600" />
                            <span className="text-sm font-medium">Bores</span>
                          </div>
                          <Badge variant="outline" className="bg-red-50">
                            {features.bores.length}
                          </Badge>
                        </button>
                        
                        {expandedSections.has('bores') && (
                          <div className="ml-6 mt-2 space-y-2">
                            {features.bores.map((bore, idx) => (
                              <div key={idx} className="p-2 bg-red-50 rounded text-sm">
                                <div className="font-medium">Bore {idx + 1}</div>
                                <div className="text-gray-600 space-y-1 mt-1">
                                  <div>Diameter: {formatNumber(bore.diameter)} mm</div>
                                  {bore.area && <div>Area: {formatNumber(bore.area)} mm²</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bosses */}
                    {features.bosses && features.bosses.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleSection('bosses')}
                          className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedSections.has('bosses') ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <Box className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium">Bosses</span>
                          </div>
                          <Badge variant="outline" className="bg-blue-50">
                            {features.bosses.length}
                          </Badge>
                        </button>
                        
                        {expandedSections.has('bosses') && (
                          <div className="ml-6 mt-2 space-y-2">
                            {features.bosses.map((boss, idx) => (
                              <div key={idx} className="p-2 bg-blue-50 rounded text-sm">
                                <div className="font-medium">Boss {idx + 1}</div>
                                <div className="text-gray-600 space-y-1 mt-1">
                                  <div>Diameter: {formatNumber(boss.diameter)} mm</div>
                                  {boss.area && <div>Area: {formatNumber(boss.area)} mm²</div>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Surface Features Section */}
              <div className="border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('surfaces')}
                  className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedSections.has('surfaces') ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <span className="font-medium">Surface Features</span>
                  </div>
                  <Badge variant="secondary">
                    {(features.planar_faces?.length || 0) + 
                     (features.fillets?.length || 0)}
                  </Badge>
                </button>
                
                {expandedSections.has('surfaces') && (
                  <div className="p-3 space-y-2">
                    {/* Planar Faces */}
                    {features.planar_faces && features.planar_faces.length > 0 && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Wrench className="w-4 h-4 text-gray-600" />
                          <span className="text-sm">Planar Faces</span>
                        </div>
                        <Badge variant="outline">{features.planar_faces.length}</Badge>
                      </div>
                    )}

                    {/* Fillets */}
                    {features.fillets && features.fillets.length > 0 && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <Circle className="w-4 h-4 text-purple-600" />
                          <span className="text-sm">Fillets/Rounds</span>
                        </div>
                        <Badge variant="outline">{features.fillets.length}</Badge>
                      </div>
                    )}

                    {/* Complex Surfaces */}
                    {features.complex_surfaces && features.complex_surfaces.length > 0 && (
                      <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-gray-600" />
                          <span className="text-sm">Complex Surfaces</span>
                        </div>
                        <Badge variant="outline">{features.complex_surfaces.length}</Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Fallback: Render old format (for backward compatibility)
  if (featureTree?.oriented_sections) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feature Tree (Legacy Format)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">
            This part uses an older analysis format. Re-upload for detailed manufacturing features.
          </p>
          {/* You can keep your old rendering logic here if needed */}
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default FeatureTree;
