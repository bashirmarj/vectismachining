import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid } from '@react-three/drei';
import { Suspense, useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
// @ts-ignore - occt-import-js has no type definitions
import occtimportjs from 'occt-import-js';

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
  const isSTEP = ['step', 'stp'].includes(fileExtension);
  const isIGES = ['iges', 'igs'].includes(fileExtension);
  const isRenderableFormat = ['stl', 'step', 'stp', 'iges', 'igs'].includes(fileExtension);
  
  // Parse STEP/IGES files client-side using occt-import-js (industry standard approach)
  useEffect(() => {
    if (!file && !fileUrl) return;
    if (!isSTEP && !isIGES) return;
    
    const parseCADFile = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log(`🔧 Client-side parsing ${fileExtension.toUpperCase()} file: ${fileName}`);
        
        // Load the file as ArrayBuffer
        let fileBuffer: Uint8Array;
        if (file) {
          const arrayBuffer = await file.arrayBuffer();
          fileBuffer = new Uint8Array(arrayBuffer);
        } else if (fileUrl) {
          const response = await fetch(fileUrl);
          const arrayBuffer = await response.arrayBuffer();
          fileBuffer = new Uint8Array(arrayBuffer);
        } else {
          throw new Error('No file source provided');
        }
        
        // Initialize occt-import-js
        const occt = await occtimportjs();
        
        // Parse STEP or IGES file
        console.log(`📖 Parsing ${fileExtension.toUpperCase()} geometry...`);
        const result = isSTEP 
          ? occt.ReadStepFile(fileBuffer, null)
          : occt.ReadIgesFile(fileBuffer, null);
        
        if (!result.success) {
          throw new Error(`Failed to parse ${fileExtension.toUpperCase()} file`);
        }
        
        console.log(`✅ Successfully parsed ${fileExtension.toUpperCase()} file:`, {
          meshCount: result.meshes?.length || 0,
          faceCount: result.faces?.length || 0
        });
        
        // Convert occt result to mesh data
        if (result.meshes && result.meshes.length > 0) {
          const firstMesh = result.meshes[0];
          
          // Extract vertices, indices, and normals from occt mesh
          const vertices = firstMesh.attributes.position.array;
          const indices = firstMesh.index ? Array.from(firstMesh.index.array) : [];
          const normals = firstMesh.attributes.normal?.array || new Float32Array(vertices.length);
          
          const parsedMeshData: MeshData = {
            vertices: Array.from(vertices) as number[],
            indices: indices as number[],
            normals: Array.from(normals) as number[],
            triangle_count: indices.length / 3
          };
          
          console.log(`✅ Mesh data extracted: ${parsedMeshData.triangle_count} triangles`);
          setMeshData(parsedMeshData);
        } else {
          throw new Error('No mesh data found in file');
        }
        
      } catch (err: any) {
        console.error(`❌ Error parsing ${fileExtension.toUpperCase()} file:`, err);
        setError(err.message || `Failed to parse ${fileExtension.toUpperCase()} file`);
      } finally {
        setIsLoading(false);
      }
    };
    
    parseCADFile();
  }, [file, fileUrl, fileName, fileExtension, isSTEP, isIGES]);
  
  // Fetch mesh data from database when meshId is provided (for admin view)
  useEffect(() => {
    if (!meshId) return;
    if (meshData) return; // Skip if already parsed client-side
    
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
  }, [meshId, meshData]);
  
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
            <p className="text-sm text-muted-foreground">
              {isSTEP || isIGES ? `Parsing ${fileExtension.toUpperCase()} geometry...` : 'Loading 3D model...'}
            </p>
            <p className="text-xs text-muted-foreground">This may take a few seconds</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-destructive" />
            <p className="text-sm text-destructive text-center">
              Failed to load 3D preview
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              {error}
            </p>
            <Button variant="outline" onClick={handleDownload}>
              Download File
            </Button>
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
              Upload a file to view 3D preview
            </p>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              Supports STEP, IGES, and STL formats
            </p>
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
