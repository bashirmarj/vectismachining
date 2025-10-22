import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import ModelMesh from './ModelMesh';
import * as THREE from 'three';
import { animateCameraToView, getViewPresetVectors } from '@/lib/cameraAnimations';
import type { ViewPreset } from '@/lib/cameraAnimations';

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  triangle_count: number;
  vertex_colors?: number[];
  feature_edges?: number[];
}

interface Canvas3DProps {
  meshData: MeshData;
  detectedFeatures?: any;
  displayStyle?: 'solid' | 'wireframe' | 'shaded-edges';
  onViewPreset?: (preset: ViewPreset) => void;
  viewPresetTrigger?: { preset: ViewPreset; timestamp: number };
  cameraRotationCallback?: (rotation: THREE.Euler) => void;
}

const Canvas3D = ({ 
  meshData, 
  detectedFeatures, 
  displayStyle = 'solid',
  viewPresetTrigger,
  cameraRotationCallback 
}: Canvas3DProps) => {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  // Calculate bounding box for camera positioning
  const boundingBox = (() => {
    if (!meshData.vertices || meshData.vertices.length === 0) {
      return { 
        min: new THREE.Vector3(-50, -50, -50), 
        max: new THREE.Vector3(50, 50, 50),
        center: new THREE.Vector3(0, 0, 0),
        size: new THREE.Vector3(100, 100, 100)
      };
    }

    const positions = new Float32Array(meshData.vertices);
    const box = new THREE.Box3();
    
    for (let i = 0; i < positions.length; i += 3) {
      box.expandByPoint(new THREE.Vector3(
        positions[i],
        positions[i + 1],
        positions[i + 2]
      ));
    }

    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);

    return { min: box.min, max: box.max, center, size };
  })();

  const maxDim = Math.max(boundingBox.size.x, boundingBox.size.y, boundingBox.size.z);
  const cameraDistance = maxDim * 2;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space: Fit view
      if (e.code === 'Space') {
        e.preventDefault();
        handleFitView();
      }
      
      // Home: Reset to isometric
      if (e.code === 'Home') {
        e.preventDefault();
        setIsometricView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleFitView = () => {
    if (!controlsRef.current || !cameraRef.current) return;

    const camera = cameraRef.current;
    const controls = controlsRef.current;

    // Reset target to model center
    controls.target.copy(boundingBox.center);

    // Position camera at isometric view
    const offset = cameraDistance / Math.sqrt(3);
    camera.position.set(
      boundingBox.center.x + offset,
      boundingBox.center.y + offset,
      boundingBox.center.z + offset
    );

    controls.update();
  };

  const setIsometricView = () => {
    handleFitView();
  };

  // Set initial camera position on mount
  useEffect(() => {
    if (controlsRef.current && cameraRef.current) {
      handleFitView();
    }
  }, [meshData]);

  // Handle view preset changes
  useEffect(() => {
    if (!viewPresetTrigger || !cameraRef.current || !controlsRef.current) return;

    const box = new THREE.Box3(boundingBox.min, boundingBox.max);
    const { position, target } = getViewPresetVectors(viewPresetTrigger.preset, box);

    animateCameraToView({
      camera: cameraRef.current,
      controls: controlsRef.current,
      targetPosition: position,
      targetLookAt: target,
      duration: 800,
    });
  }, [viewPresetTrigger]);

  // Update camera rotation callback for orientation cube
  useEffect(() => {
    if (!cameraRotationCallback || !cameraRef.current) return;

    const updateRotation = () => {
      if (cameraRef.current) {
        cameraRotationCallback(cameraRef.current.rotation.clone());
      }
      requestAnimationFrame(updateRotation);
    };

    updateRotation();
  }, [cameraRotationCallback]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ 
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true
      }}
    >
      {/* Camera */}
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        fov={45}
        near={0.1}
        far={cameraDistance * 10}
        position={[cameraDistance, cameraDistance, cameraDistance]}
      />

      {/* Environment Map for realistic reflections */}
      <Environment preset="studio" />

      {/* Lighting - Professional setup */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={1.0}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={0.1}
        shadow-camera-far={500}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />
      {/* Rim light for edge definition */}
      <directionalLight
        position={[-8, 5, -8]}
        intensity={0.4}
        color="#b0c4de"
      />
      {/* Fill light from below */}
      <hemisphereLight args={['#ffffff', '#666666', 0.4]} />

      {/* Controls - Clean OrbitControls, no custom rotation */}
      <OrbitControls
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.05}
        enableRotate={true}
        enablePan={true}
        enableZoom={true}
        minDistance={maxDim * 0.5}
        maxDistance={cameraDistance * 5}
        target={boundingBox.center}
      />

      {/* Model */}
      <ModelMesh meshData={meshData} displayStyle={displayStyle} />

      {/* Grid helper (optional) */}
      <gridHelper args={[maxDim * 2, 20, '#888888', '#444444']} position={[0, boundingBox.min.y, 0]} />
    </Canvas>
  );
};

export default Canvas3D;
