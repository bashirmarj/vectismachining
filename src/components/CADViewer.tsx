import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { Suspense, useMemo, useEffect, useState, useRef } from 'react';
import { CardContent } from '@/components/ui/card';
import { Loader2, Box, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { MeshModel } from './cad-viewer/MeshModel';
import { ViewerControls } from './cad-viewer/ViewerControls';
import { DimensionAnnotations } from './cad-viewer/DimensionAnnotations';
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
  const cubeHostRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; cube: THREE.Mesh } | null>(null);
  
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
  
  // Initialize orientation cube
  useEffect(() => {
    const host = cubeHostRef.current;
    if (!host) return;
    
    const w = 100;
    const h = 100;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a); // Dark background
    
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0, 8);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    
    // Create cube with darker material for better contrast
    const cubeGeometry = new THREE.BoxGeometry(3, 3, 3);
    const cube = new THREE.Mesh(
      cubeGeometry,
      new THREE.MeshStandardMaterial({
        color: 0x606870, // Darker gray for better contrast
        metalness: 0.5,
        roughness: 0.5,
        flatShading: false
      })
    );
    
    // Add subtle white edge lines for definition
    const edges = new THREE.EdgesGeometry(cubeGeometry, 1);
    const edgeLines = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        linewidth: 1,
        transparent: true,
        opacity: 0.15
      })
    );
    cube.add(edgeLines);
    
    scene.add(cube);
    
    // Stronger lighting for dramatic face differentiation
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    
    // Strong key light from top-front-right
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(8, 8, 8);
    scene.add(keyLight);
    
    // Subtle fill light
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight.position.set(-5, -3, -5);
    scene.add(fillLight);
    
    // Face labels helper
    const makeFaceLabel = (txt: string, pos: [number, number, number]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 64, 32);
      
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false })
      );
      sprite.position.set(...pos);
      sprite.scale.set(1.2, 0.6, 1);
      cube.add(sprite);
    };
    
    // Add face labels
    makeFaceLabel('R', [1.6, 0, 0]);
    makeFaceLabel('L', [-1.6, 0, 0]);
    makeFaceLabel('T', [0, 1.6, 0]);
    makeFaceLabel('B', [0, -1.6, 0]);
    makeFaceLabel('F', [0, 0, 1.6]);
    makeFaceLabel('Bk', [0, 0, -1.6]);
    
    // Click-to-orient
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(cube, false)[0];
      if (!hit || !hit.face) return;
      
      const normal = hit.face.normal.clone().normalize().negate();
      orientMainCameraToNormal(normal);
    };
    
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'pointer';
    
    cubeRef.current = { scene, camera, renderer, cube };
    
    // Render loop with camera sync
    const render = () => {
      requestAnimationFrame(render);
      
      // Sync cube rotation with main camera inside render loop
      if (cameraRef.current) {
        cube.quaternion.copy(cameraRef.current.quaternion);
      }
      
      renderer.render(scene, camera);
    };
    render();
    
    return () => {
      renderer.domElement.removeEventListener('click', onClick);
      host.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, []);
  
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
  
  // Smooth quaternion-based camera orientation
  const orientMainCameraToNormal = (normal: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);
    
    let alignedNormal: THREE.Vector3;
    
    if (absX > absY && absX > absZ) {
      alignedNormal = new THREE.Vector3(normal.x > 0 ? 1 : -1, 0, 0);
    } else if (absY > absX && absY > absZ) {
      alignedNormal = new THREE.Vector3(0, normal.y > 0 ? 1 : -1, 0);
    } else {
      alignedNormal = new THREE.Vector3(0, 0, normal.z > 0 ? 1 : -1);
    }
    
    const targetQuat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      alignedNormal
    );
    
    const start = cameraRef.current.quaternion.clone();
    const dur = 500;
    const t0 = performance.now();
    
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      cameraRef.current.quaternion.slerpQuaternions(start, targetQuat, k);
      controlsRef.current.update();
      if (k < 1) requestAnimationFrame(step);
    };
    
    requestAnimationFrame(step);
  };
  
  const handleViewChange = (direction: 'up' | 'down' | 'left' | 'right') => {
    const rotationMap = {
      up: new THREE.Vector3(0, 1, 0),
      down: new THREE.Vector3(0, -1, 0),
      left: new THREE.Vector3(-1, 0, 0),
      right: new THREE.Vector3(1, 0, 0),
    };
    orientMainCameraToNormal(rotationMap[direction]);
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
            
            {/* Isometric Reset Button - Top Left */}
            <button
              onClick={setIsometricView}
              className="absolute top-5 left-5 z-30 p-2 hover:bg-white/20 rounded-lg transition-all"
              style={{
                background: 'rgba(26, 26, 26, 0.95)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
              title="Isometric View"
            >
              <Box className="w-4 h-4 text-white/80 hover:text-white" />
            </button>
            
            {/* Orientation Cube - Meviy Style */}
            <div className="absolute bottom-5 right-5 z-30 flex flex-col items-center">
              {/* Top rotation icon */}
              <button
                onClick={() => handleViewChange('up')}
                className="mb-1 p-1 hover:bg-white/20 rounded transition-colors"
                title="View from top"
              >
                <ChevronUp className="w-4 h-4 text-white/80 hover:text-white" />
              </button>
              
              <div className="flex items-center gap-1">
                {/* Left rotation */}
                <button
                  onClick={() => handleViewChange('left')}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="View from left"
                >
                  <ChevronLeft className="w-4 h-4 text-white/80 hover:text-white" />
                </button>
                
                {/* Cube container - Dark Meviy style */}
                <div
                  ref={cubeHostRef}
                  className="relative"
                  style={{
                    width: '100px',
                    height: '100px',
                    background: 'rgba(26, 26, 26, 0.95)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                  }}
                />
                
                {/* Right rotation */}
                <button
                  onClick={() => handleViewChange('right')}
                  className="p-1 hover:bg-white/20 rounded transition-colors"
                  title="View from right"
                >
                  <ChevronRight className="w-4 h-4 text-white/80 hover:text-white" />
                </button>
              </div>
              
              {/* Bottom rotation icon */}
              <button
                onClick={() => handleViewChange('down')}
                className="mt-1 p-1 hover:bg-white/20 rounded transition-colors"
                title="View from bottom"
              >
                <ChevronDown className="w-4 h-4 text-white/80 hover:text-white" />
              </button>
            </div>
            
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
