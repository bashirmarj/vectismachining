import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Circle, Box, Minus, Ruler } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

interface FeatureTreeProps {
  partName: string;
  featureTree: {
    common_dimensions: Array<{
      label: string;
      value: number;
      unit: string;
    }>;
    oriented_sections: Array<{
      orientation: string;
      features: Array<{
        type: 'hole' | 'groove' | 'flat';
        diameter_mm?: number;
        depth_mm?: number;
        through?: boolean;
        inner_diameter_mm?: number;
        outer_diameter_mm?: number;
        area_mm2?: number;
        width_mm?: number;
        length_mm?: number;
      }>;
    }>;
  };
}

export function FeatureTree({ partName, featureTree }: FeatureTreeProps) {
  const [openSections, setOpenSections] = useState<string[]>(['part-root']);

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => 
      prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const getFeatureIcon = (type: string) => {
    switch(type) {
      case 'hole': return <Circle className="h-4 w-4 text-blue-500" />;
      case 'groove': return <Minus className="h-4 w-4 text-orange-500" />;
      case 'flat': return <Box className="h-4 w-4 text-green-500" />;
      default: return <Ruler className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const formatFeatureLabel = (feature: any) => {
    if (feature.type === 'hole') {
      return `Ø${feature.diameter_mm.toFixed(1)} × ${feature.depth_mm.toFixed(1)} mm ${feature.through ? '(Through)' : '(Blind)'}`;
    }
    if (feature.type === 'groove') {
      return `Groove: ID${feature.inner_diameter_mm.toFixed(1)} - OD${feature.outer_diameter_mm.toFixed(1)} × ${feature.depth_mm.toFixed(1)} mm`;
    }
    if (feature.type === 'flat') {
      return `Flat: ${feature.width_mm.toFixed(1)} × ${feature.length_mm.toFixed(1)} mm`;
    }
    return 'Unknown feature';
  };

  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ruler className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          Feature Recognition
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {/* Part Root */}
        <Collapsible open={openSections.includes('part-root')} onOpenChange={() => toggleSection('part-root')}>
          <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-purple-100/50 dark:hover:bg-purple-900/20 p-2 rounded transition-colors">
            <ChevronRight className={`h-4 w-4 transition-transform ${openSections.includes('part-root') ? 'rotate-90' : ''}`} />
            <Box className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span className="font-semibold text-sm">{partName}</span>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="ml-6 mt-2 space-y-2">
            {/* Common Dimensions */}
            {featureTree.common_dimensions.length > 0 && (
              <div className="bg-card border border-purple-100 dark:border-purple-900 rounded p-2 space-y-1">
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Common Dimensions</p>
                {featureTree.common_dimensions.map((dim, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{dim.label}:</span>
                    <span className="font-mono font-medium">{dim.value.toFixed(1)} {dim.unit}</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Oriented Sections */}
            {featureTree.oriented_sections.map((section, sectionIdx) => (
              <Collapsible 
                key={sectionIdx}
                open={openSections.includes(`section-${sectionIdx}`)}
                onOpenChange={() => toggleSection(`section-${sectionIdx}`)}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded transition-colors">
                  <ChevronRight className={`h-3 w-3 transition-transform ${openSections.includes(`section-${sectionIdx}`) ? 'rotate-90' : ''}`} />
                  <span className="text-sm font-medium">{section.orientation}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {section.features.length}
                  </Badge>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="ml-6 mt-1 space-y-1">
                  {section.features.map((feature, featureIdx) => (
                    <div key={featureIdx} className="flex items-start gap-2 p-2 bg-card border border-border rounded text-xs">
                      {getFeatureIcon(feature.type)}
                      <span className="flex-1">{formatFeatureLabel(feature)}</span>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
