import React from 'react';
import { ChevronDown, ChevronRight, Circle, Box, Cylinder, Square, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface FeatureTreeProps {
  features?: any;
  featureSummary?: any;
}

export default function FeatureTree({ features, featureSummary }: FeatureTreeProps) {
  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['manufacturing', 'surfaces'])
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

  // Handle both old and new API response formats
  const throughHoles = features?.through_holes || [];
  const blindHoles = features?.blind_holes || [];
  const bores = features?.bores || [];
  const bosses = features?.bosses || features?.cylindrical_bosses || [];
  const planarFaces = features?.planar_faces || [];
  const fillets = features?.fillets || [];
  const complexSurfaces = features?.complex_surfaces || [];

  // Get counts from feature_summary if available, otherwise calculate
  const throughHoleCount = featureSummary?.through_holes ?? throughHoles.length;
  const blindHoleCount = featureSummary?.blind_holes ?? blindHoles.length;
  const boreCount = featureSummary?.bores ?? bores.length;
  const bossCount = featureSummary?.bosses ?? bosses.length;
  const planarCount = featureSummary?.planar_faces ?? planarFaces.length;
  const filletCount = featureSummary?.fillets ?? fillets.length;
  const complexityScore = featureSummary?.complexity_score;

  const formatDimension = (value: number) => {
    if (!value) return 'N/A';
    return `${value.toFixed(2)}mm`;
  };

  const formatArea = (value: number) => {
    if (!value) return '';
    return `${value.toFixed(1)}mm²`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Feature Analysis</CardTitle>
          {complexityScore !== undefined && (
            <Badge variant="outline" className="ml-2">
              Complexity: {complexityScore}/10
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Manufacturing Features Section */}
        <div className="border rounded-lg">
          <button
            onClick={() => toggleSection('manufacturing')}
            className="w-full flex items-center justify-between p-3 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has('manufacturing') ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Wrench className="h-4 w-4 text-blue-500" />
              <span className="font-medium">Manufacturing Features</span>
            </div>
            <Badge variant="secondary">
              {throughHoleCount + blindHoleCount + boreCount + bossCount}
            </Badge>
          </button>

          {expandedSections.has('manufacturing') && (
            <div className="px-3 pb-3 space-y-2">
              {/* Through-Holes */}
              {throughHoleCount > 0 && (
                <div className="ml-6 space-y-1">
                  <button
                    onClick={() => toggleSection('through-holes')}
                    className="w-full flex items-center justify-between p-2 hover:bg-accent/50 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has('through-holes') ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <Circle className="h-3 w-3 text-yellow-500" />
                      <span className="text-sm">Through-Holes</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {throughHoleCount}
                    </Badge>
                  </button>

                  {expandedSections.has('through-holes') && throughHoles.length > 0 && (
                    <div className="ml-8 space-y-1">
                      {throughHoles.map((hole: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2 text-xs bg-yellow-50 dark:bg-yellow-950/20 rounded border border-yellow-200 dark:border-yellow-800"
                        >
                          <div className="font-medium text-yellow-700 dark:text-yellow-300">
                            Hole {idx + 1}
                          </div>
                          <div className="text-muted-foreground mt-1 space-y-0.5">
                            <div>Ø {formatDimension(hole.diameter)}</div>
                            {hole.area && <div>Area: {formatArea(hole.area)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Blind Holes */}
              {blindHoleCount > 0 && (
                <div className="ml-6 space-y-1">
                  <button
                    onClick={() => toggleSection('blind-holes')}
                    className="w-full flex items-center justify-between p-2 hover:bg-accent/50 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has('blind-holes') ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <Circle className="h-3 w-3 text-orange-500" />
                      <span className="text-sm">Blind Holes</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {blindHoleCount}
                    </Badge>
                  </button>

                  {expandedSections.has('blind-holes') && blindHoles.length > 0 && (
                    <div className="ml-8 space-y-1">
                      {blindHoles.map((hole: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2 text-xs bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800"
                        >
                          <div className="font-medium text-orange-700 dark:text-orange-300">
                            Blind Hole {idx + 1}
                          </div>
                          <div className="text-muted-foreground mt-1 space-y-0.5">
                            <div>Ø {formatDimension(hole.diameter)}</div>
                            {hole.area && <div>Area: {formatArea(hole.area)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bores */}
              {boreCount > 0 && (
                <div className="ml-6 space-y-1">
                  <button
                    onClick={() => toggleSection('bores')}
                    className="w-full flex items-center justify-between p-2 hover:bg-accent/50 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has('bores') ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <Cylinder className="h-3 w-3 text-red-500" />
                      <span className="text-sm">Bores</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {boreCount}
                    </Badge>
                  </button>

                  {expandedSections.has('bores') && bores.length > 0 && (
                    <div className="ml-8 space-y-1">
                      {bores.map((bore: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2 text-xs bg-red-50 dark:bg-red-950/20 rounded border border-red-200 dark:border-red-800"
                        >
                          <div className="font-medium text-red-700 dark:text-red-300">
                            Bore {idx + 1}
                          </div>
                          <div className="text-muted-foreground mt-1 space-y-0.5">
                            <div>Ø {formatDimension(bore.diameter)}</div>
                            {bore.area && <div>Area: {formatArea(bore.area)}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bosses */}
              {bossCount > 0 && (
                <div className="ml-6 space-y-1">
                  <button
                    onClick={() => toggleSection('bosses')}
                    className="w-full flex items-center justify-between p-2 hover:bg-accent/50 rounded transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {expandedSections.has('bosses') ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      <Cylinder className="h-3 w-3 text-blue-500" />
                      <span className="text-sm">Bosses</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {bossCount}
                    </Badge>
                  </button>

                  {expandedSections.has('bosses') && bosses.length > 0 && (
                    <div className="ml-8 space-y-1">
                      {bosses.map((boss: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-2 text-xs bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800"
                        >
                          <div className="font-medium text-blue-700 dark:text-blue-300">
                            Boss {idx + 1}
                          </div>
                          <div className="text-muted-foreground mt-1 space-y-0.5">
                            <div>Ø {formatDimension(boss.diameter)}</div>
                            {boss.area && <div>Area: {formatArea(boss.area)}</div>}
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
        <div className="border rounded-lg">
          <button
            onClick={() => toggleSection('surfaces')}
            className="w-full flex items-center justify-between p-3 hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-2">
              {expandedSections.has('surfaces') ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <Box className="h-4 w-4 text-purple-500" />
              <span className="font-medium">Surface Features</span>
            </div>
            <Badge variant="secondary">
              {planarCount + filletCount + complexSurfaces.length}
            </Badge>
          </button>

          {expandedSections.has('surfaces') && (
            <div className="px-3 pb-3 space-y-2">
              {/* Planar Faces */}
              {planarCount > 0 && (
                <div className="ml-6">
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <Square className="h-3 w-3 text-gray-500" />
                      <span className="text-sm">Planar Faces</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {planarCount}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Fillets */}
              {filletCount > 0 && (
                <div className="ml-6">
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <Circle className="h-3 w-3 text-purple-500" />
                      <span className="text-sm">Fillets & Rounds</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {filletCount}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Complex Surfaces */}
              {complexSurfaces.length > 0 && (
                <div className="ml-6">
                  <div className="flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <Box className="h-3 w-3 text-indigo-500" />
                      <span className="text-sm">Complex Surfaces</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {complexSurfaces.length}
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
