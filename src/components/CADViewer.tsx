import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { Suspense, useMemo, useEffect, useState, useRef } from 'react';
import { CardContent } from '@/components/ui/card';
import { Loader2, Box, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { MeshModel } from './cad-viewer/MeshModel';
import { DimensionAnnotations } from './cad-viewer/DimensionAnnotations';
import { MeasurementTool } from './cad-viewer/MeasurementTool';
import { OrientationCubePreview, OrientationCubeHandle } from './cad-viewer/OrientationCubePreview';

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName: string;
  meshId?: string;
  meshData?: MeshData;
  detectedFeatures?: any;
}

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  face_types?: string[];
  triangle_count: number;
  feature_edges?: number[][][];
}

export function CADViewer({ file, fileUrl, fileName, meshId, meshData: propMeshData, detectedFeatures }: CADViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedMeshData, setFetchedMeshData] = useState<MeshData | null>(null);
  
  // Professional viewer controls
  const [sectionPlane, setSectionPlane] = useState<'none' | 'xy' | 'xz' | 'yz'>('none');
  const [sectionPosition, setSectionPosition] = useState(0);
  const [showEdges, setShowEdges] = useState(true);
  const [showHiddenEdges, setShowHiddenEdges] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<'distance' | 'angle' | 'radius' | null>(null);
  const [displayStyle, setDisplayStyle] = useState<'solid' | 'wireframe' | 'translucent'>('solid');
  const showTopologyColors = true; // Always use Fusion 360 topology colors
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const orientationCubeRef = useRef<OrientationCubeHandle>(null);
  
  const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
  const isSTEP = ['step', 'stp'].includes(fileExtension);
  const isIGES = ['iges', 'igs'].includes(fileExtension);
  const isRenderableFormat = ['stl', 'step', 'stp', 'iges', 'igs'].includes(fileExtension);
  
  // STEP/IGES files are now processed server-side via geometry service
  // Mesh data is fetched from database using meshId (provided after server analysis)
  
  // Fetch mesh data from database when meshId is provided (for admin view)
  useEffect(() => {
    // Priority 1: Use mesh data passed via props
    if (propMeshData) {
      console.log('✅ Mesh data received from backend:', {
        vertices: propMeshData.vertices.length,
        triangles: propMeshData.triangle_count,
        hasFeatureEdges: !!propMeshData.feature_edges
      });
      setFetchedMeshData(propMeshData);
      return;
    }
    
    // Priority 2: Fetch from database if meshId is provided
    if (!meshId) {
      console.log('⚠️ No mesh data available (no propMeshData or meshId)');
      return;
    }
    
    if (fetchedMeshData) return; // Already fetched
    
    const fetchMesh = async () => {
      setIsLoading(true);
      try {
        console.log(`📥 Fetching mesh from database: ${meshId}`);
        const { data, error } = await supabase
          .from('cad_meshes')
          .select('vertices, indices, normals, face_types, triangle_count, feature_edges')
          .eq('id', meshId)
          .single();
        
        if (error) throw error;
        if (data) {
          console.log('✅ Mesh data fetched from database:', {
            vertices: data.vertices.length,
            triangles: data.triangle_count
          });
          setFetchedMeshData(data as MeshData);
        }
      } catch (err: any) {
        console.error('❌ Error fetching mesh:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchMesh();
  }, [meshId, propMeshData, fetchedMeshData]);
  
  // Use mesh data from props or fetched data
  const activeMeshData = propMeshData || fetchedMeshData;
  
  // Calculate bounding box for camera and annotations
  const boundingBox = useMemo(() => {
    if (!activeMeshData || !activeMeshData.vertices || activeMeshData.vertices.length === 0) {
      return { width: 100, height: 100, depth: 100, center: [0, 0, 0] as [number, number, number] };
    }
    
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    
    for (let i = 0; i < activeMeshData.vertices.length; i += 3) {
      minX = Math.min(minX, activeMeshData.vertices[i]);
      maxX = Math.max(maxX, activeMeshData.vertices[i]);
      minY = Math.min(minY, activeMeshData.vertices[i + 1]);
      maxY = Math.max(maxY, activeMeshData.vertices[i + 1]);
      minZ = Math.min(minZ, activeMeshData.vertices[i + 2]);
      maxZ = Math.max(maxZ, activeMeshData.vertices[i + 2]);
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
  }, [activeMeshData]);
  
  // Determine if we have valid 3D data to display
  const hasValidModel = activeMeshData && activeMeshData.vertices && activeMeshData.vertices.length > 0;
  
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
  
  // Helper function to classify click region (face, edge, or corner)
  const classifyClickRegion = (localPoint: THREE.Vector3) => {
    const faceDistance = 1.5; // Cube is 3x3x3, so face distance from center is 1.5
    const edgeThreshold = 0.4;
    const cornerThreshold = 0.6;
    
    const absX = Math.abs(localPoint.x);
    const absY = Math.abs(localPoint.y);
    const absZ = Math.abs(localPoint.z);
    
    const nearMaxX = absX > (faceDistance - edgeThreshold);
    const nearMaxY = absY > (faceDistance - edgeThreshold);
    const nearMaxZ = absZ > (faceDistance - edgeThreshold);
    
    const edgeCount = [nearMaxX, nearMaxY, nearMaxZ].filter(Boolean).length;
    
    // CORNER: All 3 dimensions near maximum
    if (edgeCount === 3) {
      const direction = new THREE.Vector3(
        Math.sign(localPoint.x),
        Math.sign(localPoint.y),
        Math.sign(localPoint.z)
      ).normalize();
      
      return {
        type: 'corner' as const,
        direction,
        description: `Corner (${Math.sign(localPoint.x) > 0 ? '+' : '-'}X, ${Math.sign(localPoint.y) > 0 ? '+' : '-'}Y, ${Math.sign(localPoint.z) > 0 ? '+' : '-'}Z)`
      };
    }
    // EDGE: Exactly 2 dimensions near maximum
    else if (edgeCount === 2) {
      const direction = new THREE.Vector3(
        nearMaxX ? Math.sign(localPoint.x) : 0,
        nearMaxY ? Math.sign(localPoint.y) : 0,
        nearMaxZ ? Math.sign(localPoint.z) : 0
      ).normalize();
      
      return {
        type: 'edge' as const,
        direction,
        description: 'Edge view'
      };
    }
    // FACE: Only 1 dimension near maximum
    else {
      if (absX > absY && absX > absZ) {
        return {
          type: 'face' as const,
          direction: new THREE.Vector3(Math.sign(localPoint.x), 0, 0),
          description: Math.sign(localPoint.x) > 0 ? 'Right' : 'Left'
        };
      } else if (absY > absX && absY > absZ) {
        return {
          type: 'face' as const,
          direction: new THREE.Vector3(0, Math.sign(localPoint.y), 0),
          description: Math.sign(localPoint.y) > 0 ? 'Top' : 'Bottom'
        };
      } else {
        return {
          type: 'face' as const,
          direction: new THREE.Vector3(0, 0, Math.sign(localPoint.z)),
          description: Math.sign(localPoint.z) > 0 ? 'Front' : 'Back'
        };
      }
    }
  };

  // Orientation cube removed - using OrientationCubePreview component instead
  
  // Isometric view helper
  const setIsometricView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const distance = maxDim * 2;
    const target = new THREE.Vector3(...boundingBox.center);
    
    // Isometric angles: 45° horizontal, 35.264° vertical
    const phi = Math.PI / 4; // 45°
    const theta = Math.asin(Math.tan(Math.PI / 6)); // 35.264°
    
    cameraRef.current.position.set(
      target.x + distance * Math.sin(phi) * Math.cos(theta),
      target.y + distance * Math.sin(theta),
      target.z + distance * Math.cos(phi) * Math.cos(theta)
    );
    
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
  };
  
  // Smooth camera orientation to any direction (face, edge, or corner)
  const orientMainCameraToDirection = (direction: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const distance = maxDim * 2.5;
    const target = new THREE.Vector3(...boundingBox.center);
    
    // INVERT direction: to look AT a face, camera must be OPPOSITE to it
    const cameraDirection = direction.clone().normalize().multiplyScalar(-1);
    
    // Calculate new camera position
    const newPosition = target.clone().add(
      cameraDirection.multiplyScalar(distance)
    );
    
    // Handle up vector for top/bottom views
    const up = new THREE.Vector3(0, 1, 0);
    // Check the ORIGINAL direction for top/bottom (before inverting)
    if (Math.abs(direction.y) > 0.99) {
      up.set(0, 0, direction.y > 0 ? -1 : 1);
    }
    
    const lookAtMatrix = new THREE.Matrix4().lookAt(
      newPosition,
      target,
      up
    );
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
    
    // Smooth animation
    const startPos = cameraRef.current.position.clone();
    const startQuat = cameraRef.current.quaternion.clone();
    const duration = 600;
    const t0 = performance.now();
    
    const animate = (t: number) => {
      const elapsed = t - t0;
      const k = Math.min(1, elapsed / duration);
      const easedK = 1 - Math.pow(1 - k, 3); // Ease-out cubic
      
      cameraRef.current.position.lerpVectors(startPos, newPosition, easedK);
      cameraRef.current.quaternion.slerpQuaternions(startQuat, targetQuat, easedK);
      
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
      
      if (k < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };
  
  // Handle UP vector change from orientation cube
  const handleCubeUpVectorChange = (newUpVector: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const target = new THREE.Vector3(...boundingBox.center);
    
    // Animate the main camera's UP vector
    const startUp = cameraRef.current.up.clone();
    const duration = 400;
    const t0 = performance.now();
    
    const animate = (t: number) => {
      const elapsed = t - t0;
      const k = Math.min(1, elapsed / duration);
      const easedK = 1 - Math.pow(1 - k, 3);
      
      const currentUp = startUp.clone().lerp(newUpVector, easedK).normalize();
      cameraRef.current.up.copy(currentUp);
      cameraRef.current.lookAt(target);
      
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
      
      if (k < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };
  
  const handleViewChange = (direction: 'up' | 'down' | 'left' | 'right') => {
    const rotationMap = {
      up: new THREE.Vector3(0, 1, 0),
      down: new THREE.Vector3(0, -1, 0),
      left: new THREE.Vector3(-1, 0, 0),
      right: new THREE.Vector3(1, 0, 0),
    };
    
    const directionVector = rotationMap[direction];
    
    // Rotate main camera
    orientMainCameraToDirection(directionVector);
    
    // Also rotate the orientation cube preview
    if (orientationCubeRef.current) {
      orientationCubeRef.current.rotateCube(directionVector);
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
          <div className="relative h-full" style={{ background: '#f8f9fa' }}>
            
            {/* Isometric Reset Button - Top Left */}
            <button
              onClick={setIsometricView}
              className="absolute top-5 left-5 z-30 p-2 hover:bg-gray-100 rounded-lg transition-all"
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
              }}
              title="Isometric View"
            >
              <Box className="w-4 h-4 text-gray-700 hover:text-gray-900" />
            </button>
            
            
            {/* Orientation Cube - Top Right */}
            <div className="absolute top-5 right-5 z-30">
              <OrientationCubePreview 
                ref={orientationCubeRef}
                onOrientationChange={orientMainCameraToDirection}
                onUpVectorChange={handleCubeUpVectorChange}
                onDisplayStyleChange={setDisplayStyle}
              />
            </div>
            
            {/* Vectis Manufacturing Watermark */}
            <div className="absolute bottom-4 left-4 z-10 text-xs text-black/30 font-medium">
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
                toneMapping: THREE.NoToneMapping,
                sortObjects: true,
              }}
              dpr={[1, 2]}
            >
              <Suspense fallback={null}>
                {/* Clean white background */}
                <color attach="background" args={['#f8f9fa']} />
                <fog attach="fog" args={['#f8f9fa', 300, 1000]} />
                
                {/* Professional CAD lighting - subtle depth without color variation */}
                <ambientLight intensity={0.5} />
                <directionalLight 
                  position={[10, 10, 5]} 
                  intensity={0.6}
                  color="#ffffff"
                />
                <directionalLight 
                  position={[-5, -5, -3]} 
                  intensity={0.2}
                  color="#ffffff"
                />
                
                {/* Subtle grid (light gray) */}
...
                
                
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
                
                {/* 3D Model */}
                <MeshModel
                  meshData={activeMeshData!}
                  sectionPlane={sectionPlane}
                  sectionPosition={sectionPosition}
                  showEdges={showEdges}
                  showHiddenEdges={showHiddenEdges}
                  displayStyle={displayStyle}
                  topologyColors={showTopologyColors}
                />
                
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
