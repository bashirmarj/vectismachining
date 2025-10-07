import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { loadSTL, loadOBJ, getFileType } from '@/lib/3d-utils';
import { Loader2 } from 'lucide-react';

interface ModelViewerProps {
  fileUrl: string;
  fileName: string;
}

const Model = ({ fileUrl, fileName }: { fileUrl: string; fileName: string }) => {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [group, setGroup] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fileType = getFileType(fileName);
    setLoading(true);
    setError(null);

    const loadModel = async () => {
      try {
        if (fileType === 'stl') {
          const geo = await loadSTL(fileUrl);
          geo.center();
          geo.computeVertexNormals();
          setGeometry(geo);
        } else if (fileType === 'obj') {
          const obj = await loadOBJ(fileUrl);
          obj.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              child.geometry.center();
              child.geometry.computeVertexNormals();
            }
          });
          setGroup(obj);
        }
        setLoading(false);
      } catch (err) {
        console.error('Error loading model:', err);
        setError('Failed to load 3D model');
        setLoading(false);
      }
    };

    loadModel();
  }, [fileUrl, fileName]);

  if (loading) return null;
  if (error) return null;

  if (geometry) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color="#3b82f6" 
          metalness={0.3} 
          roughness={0.4} 
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  if (group) {
    return <primitive object={group} />;
  }

  return null;
};

export const ModelViewer = ({ fileUrl, fileName }: ModelViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, [fileUrl]);

  return (
    <div className="relative w-full h-full bg-background rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading 3D model...</p>
          </div>
        </div>
      )}
      
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[3, 3, 3]} fov={50} />
        <OrbitControls 
          enableDamping 
          dampingFactor={0.05}
          minDistance={1}
          maxDistance={10}
        />
        
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        
        <Model fileUrl={fileUrl} fileName={fileName} />
        
        <Grid 
          args={[10, 10]}
          cellSize={0.5}
          cellThickness={0.5}
          cellColor="#6b7280"
          sectionSize={1}
          sectionThickness={1}
          sectionColor="#4b5563"
          fadeDistance={25}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />
      </Canvas>

      <div className="absolute bottom-4 left-4 bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg text-xs text-muted-foreground">
        Click & drag to rotate • Scroll to zoom
      </div>
    </div>
  );
};
