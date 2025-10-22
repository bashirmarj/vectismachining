import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import ModelMesh from './ModelMesh';
import * as THREE from 'three';

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
}

const Canvas3D = ({ meshData, detectedFeatures }: Canvas3DProps) => {
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

      {/* Lighting - Professional 3-point setup */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={0.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-5, -5, -3]}
        intensity={0.3}
      />
      <hemisphereLight args={['#ffffff', '#444444', 0.3]} />

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
      <ModelMesh meshData={meshData} />

      {/* Grid helper (optional) */}
      <gridHelper args={[maxDim * 2, 20, '#888888', '#444444']} position={[0, boundingBox.min.y, 0]} />
    </Canvas>
  );
};

export default Canvas3D;
