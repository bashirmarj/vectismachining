import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { Suspense, useMemo, useEffect, useState, useRef } from 'react';
import { CardContent } from '@/components/ui/card';
import { Loader2, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { MeshModel } from './cad-viewer/MeshModel';
import { ViewerControls } from './cad-viewer/ViewerControls';
import { DimensionAnnotations } from './cad-viewer/DimensionAnnotations';
import { OrientationCube } from './cad-viewer/OrientationCube';
import { MeasurementTool } from './cad-viewer/MeasurementTool';
import { AutoRotate } from './cad-viewer/AutoRotate';

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName: string;
  meshId?: string;
  detectedFeatures?: any;
}

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  face_types?: string[];
  triangle_count: number;
}

export function CADViewer({ file, fileUrl, fileName, meshId, detectedFeatures }: CADViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meshData, setMeshData] = useState<MeshData | null>(null);
  
  // Professional viewer controls
  const [showSectionCut, setShowSectionCut] = useState(false);
  const [sectionPosition, setSectionPosition] = useState(0);
  const [showEdges, setShowEdges] = useState(true);
  const [showDimensions, setShowDimensions] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<'distance' | 'angle' | 'radius' | null>(null);
  const [isIdle, setIsIdle] = useState(false);
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const isSTEP = ['step', 'stp'].includes(fileExtension);
  const isIGES = ['iges', 'igs'].includes(fileExtension);
  const isRenderableFormat = ['stl', 'step', 'stp', 'iges', 'igs'].includes(fileExtension);
  
  // STEP/IGES files are now processed server-side via geometry service
  // Mesh data is fetched from database using meshId (provided after server analysis)
  
  // Fetch mesh data from database when meshId is provided (for admin view)
  useEffect(() => {
    if (!meshId) return;
    if (meshData) return; // Skip if already parsed client-side
    
    const fetchMesh = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('cad_meshes')
          .select('vertices, indices, normals, face_types, triangle_count')
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
  
  // Calculate bounding box for camera and annotations
  const boundingBox = useMemo(() => {
    if (!meshData || !meshData.vertices || meshData.vertices.length === 0) {
      return { width: 100, height: 100, depth: 100, center: [0, 0, 0] as [number, number, number] };
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < meshData.vertices.length; i += 3) {
      minX = Math.min(minX, meshData.vertices[i]);
      maxX = Math.max(maxX, meshData.vertices[i]);
      minY = Math.min(minY, meshData.vertices[i + 1]);
      maxY = Math.max(maxY, meshData.vertices[i + 1]);
      minZ = Math.min(minZ, meshData.vertices[i + 2]);
      maxZ = Math.max(maxZ, meshData.vertices[i + 2]);
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;
    const center: [number, number, number] = [
      (minX + maxX) / 2,
      (minY + maxY) / 2,
      (minZ + maxZ) / 2,
    ];
    
    return { width, height, depth, center };
  }, [meshData]);
  
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
  
  const handleFitView = () => {
    if (controlsRef.current && cameraRef.current) {
      const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
      const distance = maxDim * 2;
      
      cameraRef.current.position.set(
        boundingBox.center[0] + distance,
        boundingBox.center[1] + distance,
        boundingBox.center[2] + distance
      );
      
      controlsRef.current.target.set(...boundingBox.center);
      controlsRef.current.update();
    }
  };
  
  const handleViewChange = (position: [number, number, number]) => {
    if (cameraRef.current && controlsRef.current) {
      const duration = 1000; // Animation duration in ms
      const startPos = cameraRef.current.position.clone();
      const targetPos = new THREE.Vector3(
        boundingBox.center[0] + position[0],
        boundingBox.center[1] + position[1],
        boundingBox.center[2] + position[2]
      );
      
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
        
        cameraRef.current.position.lerpVectors(startPos, targetPos, eased);
        controlsRef.current.target.set(...boundingBox.center);
        controlsRef.current.update();
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };
      
      animate();
    }
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.code === 'Space') {
        e.preventDefault();
        handleFitView();
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        setShowEdges(!showEdges);
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        setMeasurementMode(measurementMode ? null : 'distance');
      } else if (e.code === 'Escape') {
        e.preventDefault();
        setMeasurementMode(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showEdges, measurementMode]);
  
  // Idle detection for auto-rotation
  useEffect(() => {
    const resetIdleTimer = () => {
      setIsIdle(false);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => setIsIdle(true), 5000);
    };
    
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    resetIdleTimer();
    
    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, []);
  
  return (
    <div className="h-full bg-white rounded-lg overflow-hidden">
      <CardContent className="h-full p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {isSTEP || isIGES 
                ? `Processing ${fileExtension.toUpperCase()} geometry on server...` 
                : 'Loading 3D model...'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isSTEP || isIGES 
                ? 'This may take 5-10 seconds for complex parts'
                : 'This may take a few seconds'}
            </p>
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
          <div className="relative h-full" style={{ background: 'linear-gradient(180deg, #202020 0%, #1b1b1b 100%)' }}>
            <ViewerControls
              showSectionCut={showSectionCut}
              onToggleSectionCut={() => setShowSectionCut(!showSectionCut)}
              sectionPosition={sectionPosition}
              onSectionPositionChange={setSectionPosition}
              showEdges={showEdges}
              onToggleEdges={() => setShowEdges(!showEdges)}
              showDimensions={showDimensions}
              onToggleDimensions={() => setShowDimensions(!showDimensions)}
              measurementMode={measurementMode}
              onMeasurementModeChange={setMeasurementMode}
              onFitView={handleFitView}
            />
            
            {/* Vectis Manufacturing Watermark */}
            <div className="absolute bottom-4 left-4 z-10 text-xs text-white/30 font-medium">
              Vectis Manufacturing | Automating Precision
            </div>
            
            <Canvas
              camera={{ position: [150, 150, 150], fov: 45 }}
              gl={{
                antialias: true,
                alpha: false,
                preserveDrawingBuffer: true,
                powerPreference: "high-performance",
                localClippingEnabled: true,
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.2,
              }}
              dpr={[1, 2]}
            >
              <Suspense fallback={null}>
                {/* Professional dark scene lighting */}
                <color attach="background" args={['#1b1b1b']} />
                <fog attach="fog" args={['#1b1b1b', 300, 1000]} />
                
                {/* Multi-point lighting for industrial look */}
                <ambientLight intensity={0.4} />
                <directionalLight
                  position={[10, 10, 5]}
                  intensity={0.8}
                  castShadow
                  shadow-mapSize-width={2048}
                  shadow-mapSize-height={2048}
                />
                <directionalLight position={[-10, 5, -5]} intensity={0.3} />
                <hemisphereLight args={['#ffffff', '#3a3a3a', 0.3]} />
                
                {/* Subtle grid (faint gray) */}
                <gridHelper
                  args={[500, 50, '#3a3a3a', '#3a3a3a']}
                  position={[0, -boundingBox.height / 2 - 10, 0]}
                  material-opacity={0.25}
                  material-transparent
                />
                
                {/* Environment for reflections */}
                <Environment preset="city" />
                
                {/* Auto-framed camera */}
                <PerspectiveCamera
                  ref={cameraRef}
                  makeDefault
                  position={[
                    boundingBox.center[0] + boundingBox.width * 1.5,
                    boundingBox.center[1] + boundingBox.height * 1.5,
                    boundingBox.center[2] + boundingBox.depth * 1.5,
                  ]}
                  fov={45}
                />
                
                {/* 3D Model with auto-rotation when idle */}
                <AutoRotate enabled={isIdle}>
                  <MeshModel
                    meshData={meshData!}
                    showSectionCut={showSectionCut}
                    sectionPosition={sectionPosition}
                    showEdges={showEdges}
                  />
                </AutoRotate>
                
                {/* Soft contact shadow */}
                <mesh
                  rotation={[-Math.PI / 2, 0, 0]}
                  position={[0, -boundingBox.height / 2 - 10.5, 0]}
                  receiveShadow
                >
                  <planeGeometry args={[boundingBox.width * 3, boundingBox.depth * 3]} />
                  <shadowMaterial opacity={0.15} />
                </mesh>
                
                {/* Dimension Annotations */}
                {showDimensions && detectedFeatures && (
                  <DimensionAnnotations
                    features={detectedFeatures}
                    boundingBox={boundingBox}
                  />
                )}
                
                {/* Measurement Tool */}
                <MeasurementTool
                  enabled={measurementMode !== null}
                  mode={measurementMode}
                />
                
                {/* Orientation Cube */}
                <OrientationCube onViewChange={handleViewChange} />
                
                {/* Camera controls with damping and inertia */}
                <OrbitControls
                  ref={controlsRef}
                  makeDefault
                  target={boundingBox.center}
                  enableDamping
                  dampingFactor={0.08}
                  minDistance={Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 0.5}
                  maxDistance={Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 5}
                  rotateSpeed={0.6}
                  panSpeed={0.8}
                  zoomSpeed={1.2}
                  enabled={!isIdle}
                />
              </Suspense>
            </Canvas>
          </div>
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
    </div>
  );
}
