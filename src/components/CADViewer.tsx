import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid } from '@react-three/drei';
import { Suspense, useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName: string;
  meshId?: string;
}

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  triangle_count: number;
}

// Component to render mesh from database-stored geometry
function MeshModel({ meshData }: { meshData: MeshData }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    
    geo.setAttribute('position', new THREE.Float32BufferAttribute(meshData.vertices, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(meshData.normals, 3));
    geo.setIndex(meshData.indices);
    geo.computeBoundingSphere();
    
    return geo;
  }, [meshData]);
  
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

export function CADViewer({ file, fileUrl, fileName, meshId }: CADViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meshData, setMeshData] = useState<MeshData | null>(null);
  
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const isRenderableFormat = ['stl', 'step', 'stp', 'iges', 'igs'].includes(fileExtension);
  
  // Fetch mesh data from database when meshId is provided
  useEffect(() => {
    if (!meshId) return;
    
    const fetchMesh = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('cad_meshes')
          .select('vertices, indices, normals, triangle_count')
          .eq('id', meshId)
          .single();
        
        if (error) throw error;
        if (data) {
          setMeshData(data as MeshData);
        }
      } catch (err: any) {
        console.error('Error fetching mesh:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMesh();
  }, [meshId]);
  
  // Determine if we have valid 3D data to display
  const hasValidModel = meshData && meshData.vertices && meshData.vertices.length > 0;
  
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading 3D model...</p>
          </div>
        ) : hasValidModel ? (
          <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
            <Suspense fallback={null}>
              <Stage environment="city" intensity={0.6}>
                <MeshModel meshData={meshData!} />
              </Stage>
              <Grid infiniteGrid />
              <OrbitControls makeDefault />
            </Suspense>
          </Canvas>
        ) : isRenderableFormat ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              3D preview unavailable
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              The file analysis is complete and you can proceed with quoting. 
              3D visualization requires browser support for complex CAD files.
            </p>
            <Button variant="outline" onClick={handleDownload}>
              Download File
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              3D preview not available for {fileExtension.toUpperCase()} files
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
