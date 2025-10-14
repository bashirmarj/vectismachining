import { Html } from '@react-three/drei';
import { useMemo } from 'react';

interface DetectedFeatures {
  primary_dimensions?: {
    width_mm?: number;
    height_mm?: number;
    length_mm?: number;
    major_diameter_mm?: number;
  };
  holes?: Array<{
    diameter_mm: number;
    depth_mm: number;
    position: [number, number, number];
  }>;
}

interface DimensionAnnotationsProps {
  features?: DetectedFeatures;
  boundingBox: {
    width: number;
    height: number;
    depth: number;
  };
}

export function DimensionAnnotations({ features, boundingBox }: DimensionAnnotationsProps) {
  const annotations = useMemo(() => {
    const dims = [];
    
    if (!features?.primary_dimensions) return dims;
    
    const pd = features.primary_dimensions;
    
    // Main dimensions
    if (pd.major_diameter_mm) {
      dims.push({
        label: `Ø${pd.major_diameter_mm.toFixed(1)}mm`,
        position: [boundingBox.width / 2, boundingBox.height / 2, 0] as [number, number, number],
      });
    }
    
    if (pd.length_mm) {
      dims.push({
        label: `L${pd.length_mm.toFixed(1)}mm`,
        position: [0, 0, boundingBox.depth / 2] as [number, number, number],
      });
    }
    
    if (pd.width_mm && pd.height_mm) {
      dims.push({
        label: `${pd.width_mm.toFixed(1)}×${pd.height_mm.toFixed(1)}mm`,
        position: [boundingBox.width / 2, boundingBox.height / 2, 0] as [number, number, number],
      });
    }
    
    // Hole annotations
    if (features.holes) {
      features.holes.forEach((hole, idx) => {
        dims.push({
          label: `Ø${hole.diameter_mm.toFixed(1)}mm${hole.depth_mm ? ` ×${hole.depth_mm.toFixed(1)}mm` : ''}`,
          position: hole.position,
        });
      });
    }
    
    return dims;
  }, [features, boundingBox]);
  
  if (annotations.length === 0) return null;
  
  return (
    <group>
      {annotations.map((annotation, idx) => (
        <Html
          key={idx}
          position={annotation.position}
          center
          distanceFactor={15}
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium shadow-lg whitespace-nowrap">
            {annotation.label}
          </div>
        </Html>
      ))}
    </group>
  );
}
