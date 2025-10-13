import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid } from '@react-three/drei';
import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CADViewerProps {
  fileUrl: string;
  fileName: string;
}

export function CADViewer({ fileUrl, fileName }: CADViewerProps) {
  const isSTL = fileName.toLowerCase().endsWith('.stl');
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Box className="h-5 w-5 text-primary" />
          3D Model Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[500px]">
        {isSTL ? (
          <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
            <Suspense fallback={<Loader2 className="h-8 w-8 animate-spin" />}>
              <Stage environment="city" intensity={0.6}>
                {/* STL loader placeholder - displays a sample cube */}
                <mesh>
                  <boxGeometry args={[1, 1, 1]} />
                  <meshStandardMaterial color="hsl(var(--primary))" />
                </mesh>
              </Stage>
              <Grid infiniteGrid />
              <OrbitControls makeDefault />
            </Suspense>
          </Canvas>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              3D preview not available for {fileName.split('.').pop()?.toUpperCase()} files
            </p>
            <Button variant="outline" onClick={() => window.open(fileUrl, '_blank')}>
              Download File
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
