import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, Stage, Grid } from '@react-three/drei';
import { Suspense, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName: string;
}

function STLModel({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);
  
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color="hsl(var(--primary))" 
        metalness={0.3}
        roughness={0.4}
      />
    </mesh>
  );
}

export function CADViewer({ file, fileUrl, fileName }: CADViewerProps) {
  const isSTL = fileName.toLowerCase().endsWith('.stl');
  
  // Create object URL for File objects, cleanup on unmount
  const objectUrl = useMemo(() => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return fileUrl;
  }, [file, fileUrl]);

  useEffect(() => {
    return () => {
      if (file && objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file, objectUrl]);

  const handleDownload = () => {
    if (objectUrl) {
      window.open(objectUrl, '_blank');
    }
  };
  
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Box className="h-5 w-5 text-primary" />
          3D Model Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="h-[500px]">
        {isSTL && objectUrl ? (
          <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.6}>
                <STLModel url={objectUrl} />
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
            <Button variant="outline" onClick={handleDownload}>
              Download File
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
