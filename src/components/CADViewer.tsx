import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid } from '@react-three/drei';
import { Suspense, useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';
import { Triangle } from '@/lib/geometryAnalyzer';

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName: string;
  triangles?: Triangle[];
}

// Component to render triangles directly from geometry data
function TriangleMeshModel({ triangles }: { triangles: Triangle[] }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    
    const positions: number[] = [];
    const normals: number[] = [];
    
    for (const tri of triangles) {
      // Add vertices
      for (const vertex of tri.vertices) {
        positions.push(vertex.x, vertex.y, vertex.z);
        normals.push(tri.normal.x, tri.normal.y, tri.normal.z);
      }
    }
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.computeBoundingSphere();
    
    return geo;
  }, [triangles]);
  
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

export function CADViewer({ file, fileUrl, fileName, triangles }: CADViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const isRenderableFormat = ['stl', 'step', 'stp', 'iges', 'igs'].includes(fileExtension);
  
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
        {isRenderableFormat && triangles && triangles.length > 0 ? (
          <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.6}>
                <TriangleMeshModel triangles={triangles} />
              </Stage>
              <Grid infiniteGrid />
              <OrbitControls makeDefault />
            </Suspense>
          </Canvas>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-16 w-16 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground text-center">
              Parsing {fileExtension.toUpperCase()} file...
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-destructive" />
            <p className="text-sm text-destructive text-center">
              {error}
            </p>
            <Button variant="outline" onClick={handleDownload}>
              Download File
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              {isRenderableFormat 
                ? 'Analyzing file to display 3D model...' 
                : `3D preview not available for ${fileExtension.toUpperCase()} files`}
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
