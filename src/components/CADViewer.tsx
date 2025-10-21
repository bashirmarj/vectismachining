import { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Camera, Home, Box, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { MeshModel } from './MeshModel';

interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  width: number;
  height: number;
  depth: number;
}

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  vertex_colors?: string[];
  triangle_count: number;
  feature_edges?: number[][][];
}

interface CADViewerProps {
  meshData: MeshData;
  boundingBox: BoundingBox;
  showEdges?: boolean;
  showHiddenEdges?: boolean;
  displayStyle?: 'solid' | 'wireframe' | 'translucent';
  topologyColors?: boolean;
}

export function CADViewer({ 
  meshData, 
  boundingBox,
  showEdges = true,
  showHiddenEdges = false,
  displayStyle = 'solid',
  topologyColors = true
}: CADViewerProps) {
  // State for controlling view orientation and camera
  const [viewMode, setViewMode] = useState<'perspective' | 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right'>('perspective');
  const [rotationTarget, setRotationTarget] = useState<[number, number, number]>(boundingBox.center);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Section plane controls
  const [sectionPlane, setSectionPlane] = useState<'none' | 'xy' | 'xz' | 'yz'>('none');
  const [sectionPosition, setSectionPosition] = useState(0);

  // Refs for mouse interaction and camera control
  const canvasRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const meshRef = useRef<THREE.Group>(null);
  const mouse = useRef(new THREE.Vector2());
  const raycaster = useRef(new THREE.Raycaster());

  // Calculate viewport settings based on bounding box
  const viewportSettings = {
    minDistance: Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 0.5,
    maxDistance: Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 5
  };

  // Handle cursor-based rotation center WITHOUT camera repositioning
  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only process left mouse button (rotation)
    if (event.button !== 0) return;
    
    // Safety checks
    if (!cameraRef.current || !meshRef.current || !canvasRef.current || !controlsRef.current) {
      return;
    }
    
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = canvasRef.current.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;
    
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Raycast to find intersection with mesh
    raycaster.current.setFromCamera(mouse.current, cameraRef.current);
    const intersects = raycaster.current.intersectObject(meshRef.current, true);
    
    if (intersects.length > 0) {
      // Get the clicked point
      const clickedPoint = intersects[0].point;
      const newTarget = new THREE.Vector3(clickedPoint.x, clickedPoint.y, clickedPoint.z);
      const oldTarget = new THREE.Vector3(...rotationTarget);
      
      // CRITICAL FIX: Calculate camera offset from OLD target
      const cameraOffset = cameraRef.current.position.clone().sub(oldTarget);
      
      // Calculate new camera position to maintain same view
      const newCameraPosition = newTarget.clone().add(cameraOffset);
      
      // Update both target AND camera position simultaneously
      setRotationTarget([newTarget.x, newTarget.y, newTarget.z]);
      
      // Update controls (this happens before React re-render)
      controlsRef.current.target.copy(newTarget);
      cameraRef.current.position.copy(newCameraPosition);
      controlsRef.current.update();
      
      console.log('🎯 Rotation center set to cursor without camera jump');
    }
  };

  const resetCamera = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const distance = maxDim * 2.5;
    const target = new THREE.Vector3(...boundingBox.center);
    
    cameraRef.current.position.set(
      target.x + distance * 0.5,
      target.y + distance * 0.5,
      target.z + distance * 0.7
    );
    
    setRotationTarget(boundingBox.center);
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
  };
  
  const setIsometricView = () => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const distance = maxDim * 2;
    const target = new THREE.Vector3(...boundingBox.center);
    
    const phi = Math.PI / 4;
    const theta = Math.asin(Math.tan(Math.PI / 6));
    
    cameraRef.current.position.set(
      target.x + distance * Math.sin(phi) * Math.cos(theta),
      target.y + distance * Math.sin(theta),
      target.z + distance * Math.cos(phi) * Math.cos(theta)
    );
    
    setRotationTarget(boundingBox.center);
    controlsRef.current.target.copy(target);
    controlsRef.current.update();
  };
  
  const orientMainCameraToDirection = (direction: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return;
    
    const maxDim = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const distance = maxDim * 2.5;
    const target = new THREE.Vector3(...boundingBox.center);
    
    const cameraDirection = direction.clone().normalize().multiplyScalar(-1);
    const newPosition = target.clone().add(cameraDirection.multiplyScalar(distance));
    
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(direction.y) > 0.99) {
      up.set(0, 0, direction.y > 0 ? -1 : 1);
    }
    
    const lookAtMatrix = new THREE.Matrix4().lookAt(newPosition, target, up);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
    
    const startPos = cameraRef.current.position.clone();
    const startQuat = cameraRef.current.quaternion.clone();
    const duration = 600;
    const t0 = performance.now();
    
    const animate = (t: number) => {
      const elapsed = t - t0;
      const k = Math.min(1, elapsed / duration);
      const easedK = 1 - Math.pow(1 - k, 3);
      
      cameraRef.current.position.lerpVectors(startPos, newPosition, easedK);
      cameraRef.current.quaternion.slerpQuaternions(startQuat, targetQuat, easedK);
      
      setRotationTarget(boundingBox.center);
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
      
      if (k < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  const handleViewChange = (view: typeof viewMode) => {
    setIsTransitioning(true);
    setViewMode(view);

    setTimeout(() => {
      const directions = {
        front: new THREE.Vector3(0, 0, 1),
        back: new THREE.Vector3(0, 0, -1),
        top: new THREE.Vector3(0, 1, 0),
        bottom: new THREE.Vector3(0, -1, 0),
        left: new THREE.Vector3(-1, 0, 0),
        right: new THREE.Vector3(1, 0, 0)
      };

      if (view === 'perspective') {
        resetCamera();
      } else if (view in directions) {
        orientMainCameraToDirection(directions[view as keyof typeof directions]);
      }

      setTimeout(() => setIsTransitioning(false), 650);
    }, 50);
  };

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Top Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('perspective')}
            className={viewMode === 'perspective' ? 'bg-blue-100' : ''}
            title="Perspective View"
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsometricView()}
            title="Isometric View"
          >
            <Box className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={resetCamera}
            title="Reset Camera"
          >
            <Home className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-gray-300" />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('front')}
            className={viewMode === 'front' ? 'bg-blue-100' : ''}
            title="Front View"
          >
            Front
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('back')}
            className={viewMode === 'back' ? 'bg-blue-100' : ''}
            title="Back View"
          >
            Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('top')}
            className={viewMode === 'top' ? 'bg-blue-100' : ''}
            title="Top View"
          >
            Top
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('bottom')}
            className={viewMode === 'bottom' ? 'bg-blue-100' : ''}
            title="Bottom View"
          >
            Bottom
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('left')}
            className={viewMode === 'left' ? 'bg-blue-100' : ''}
            title="Left View"
          >
            Left
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewChange('right')}
            className={viewMode === 'right' ? 'bg-blue-100' : ''}
            title="Right View"
          >
            Right
          </Button>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div 
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        className="relative w-full h-full bg-gradient-to-br from-slate-50 to-slate-100"
      >
        <Canvas
          shadows
          camera={{
            position: [
              boundingBox.center[0] + boundingBox.width,
              boundingBox.center[1] + boundingBox.height,
              boundingBox.center[2] + boundingBox.depth * 1.5
            ],
            fov: 50,
            near: 0.1,
            far: 10000
          }}
          gl={{ 
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true
          }}
          onCreated={({ camera }) => {
            if (camera instanceof THREE.PerspectiveCamera) {
              cameraRef.current = camera;
            }
          }}
        >
          {/* Professional lighting setup */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={0.8}
            castShadow
            shadow-mapSize={[2048, 2048]}
          />
          <directionalLight position={[-10, -10, -5]} intensity={0.3} />
          <hemisphereLight intensity={0.4} groundColor="#444444" />

          {/* Main mesh */}
          <group ref={meshRef}>
            <MeshModel
              meshData={meshData}
              sectionPlane={sectionPlane}
              sectionPosition={sectionPosition}
              showEdges={showEdges}
              showHiddenEdges={showHiddenEdges}
              displayStyle={displayStyle}
              topologyColors={topologyColors}
            />
          </group>

          {/* Ground plane */}
          <mesh 
            rotation={[-Math.PI / 2, 0, 0]} 
            position={[boundingBox.center[0], boundingBox.min[1] - 0.01, boundingBox.center[2]]}
            receiveShadow
          >
            <planeGeometry args={[boundingBox.width * 3, boundingBox.depth * 3]} />
            <shadowMaterial opacity={0.15} />
          </mesh>

          {/* Grid helper */}
          <gridHelper
            args={[
              Math.max(boundingBox.width, boundingBox.depth) * 2,
              20,
              '#cccccc',
              '#e0e0e0'
            ]}
            position={[boundingBox.center[0], boundingBox.min[1], boundingBox.center[2]]}
          />

          {/* SolidWorks-style orbit controls with cursor rotation */}
          <OrbitControls
            ref={controlsRef}
            makeDefault
            target={rotationTarget}
            enableDamping={true}
            dampingFactor={0.15}
            minDistance={viewportSettings.minDistance}
            maxDistance={viewportSettings.maxDistance}
            rotateSpeed={1.0}
            panSpeed={1.0}
            zoomSpeed={1.2}
            screenSpacePanning={true}
            minAzimuthAngle={-Infinity}
            maxAzimuthAngle={Infinity}
            enableZoom={true}
            zoomToCursor={true}
            mouseButtons={{
              LEFT: THREE.MOUSE.ROTATE,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: THREE.MOUSE.PAN
            }}
          />
        </Canvas>

        {/* Orientation Cube */}
        <div className="absolute bottom-4 right-4 w-24 h-24">
          <OrientationCube onFaceClick={handleViewChange} currentView={viewMode} />
        </div>
      </div>

      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 text-xs space-y-1">
        <div className="font-semibold text-gray-700">Model Info</div>
        <div className="text-gray-600">
          Triangles: {meshData.triangle_count.toLocaleString()}
        </div>
        <div className="text-gray-600">
          Size: {boundingBox.width.toFixed(1)} × {boundingBox.height.toFixed(1)} × {boundingBox.depth.toFixed(1)} cm
        </div>
        <div className="text-gray-600">
          View: {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}
        </div>
      </div>
    </div>
  );
}

// Orientation Cube Component
function OrientationCube({ 
  onFaceClick, 
  currentView 
}: { 
  onFaceClick: (view: 'front' | 'back' | 'top' | 'bottom' | 'left' | 'right') => void;
  currentView: string;
}) {
  const cubeRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);

  return (
    <Canvas
      camera={{ position: [0, 0, 4], fov: 50 }}
      gl={{ alpha: true, antialias: true }}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 5, 5]} intensity={0.6} />
      
      <group ref={groupRef}>
        <mesh ref={cubeRef}>
          <boxGeometry args={[1.5, 1.5, 1.5]} />
          <meshStandardMaterial 
            color="#4A90E2"
            metalness={0.3}
            roughness={0.4}
            transparent
            opacity={0.9}
          />
        </mesh>
        
        {/* Face labels */}
        <sprite position={[0, 0, 0.76]} onClick={() => onFaceClick('front')}>
          <spriteMaterial color="#ffffff" transparent opacity={0.9} />
        </sprite>
      </group>
      
      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
