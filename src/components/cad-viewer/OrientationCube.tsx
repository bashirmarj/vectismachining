import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';

interface OrientationCubeProps {
  onViewChange: (position: [number, number, number]) => void;
}

export function OrientationCube({ onViewChange }: OrientationCubeProps) {
  const cubeRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);
  
  // Update cube rotation to match camera
  useFrame(() => {
    if (cubeRef.current && camera) {
      const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion.clone().invert());
      cubeRef.current.rotation.copy(rotation);
    }
  });
  
  const views = [
    { name: 'Front', position: [0, 0, 300] as [number, number, number], faceIndex: 0 },
    { name: 'Back', position: [0, 0, -300] as [number, number, number], faceIndex: 1 },
    { name: 'Right', position: [300, 0, 0] as [number, number, number], faceIndex: 2 },
    { name: 'Left', position: [-300, 0, 0] as [number, number, number], faceIndex: 3 },
    { name: 'Top', position: [0, 300, 0] as [number, number, number], faceIndex: 4 },
    { name: 'Bottom', position: [0, -300, 0] as [number, number, number], faceIndex: 5 },
  ];
  
  // Create materials for each face
  const faceMaterials = views.map((_, index) => {
    const isHovered = hoveredFace === index;
    return (
      <meshStandardMaterial
        key={index}
        color={isHovered ? '#3b82f6' : '#4a5568'}
        transparent
        opacity={isHovered ? 0.9 : 0.7}
        emissive={isHovered ? '#3b82f6' : '#000000'}
        emissiveIntensity={isHovered ? 0.3 : 0}
      />
    );
  });
  
  return (
    <Html
      position={[0, 0, 0]}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '100px',
        height: '100px',
        pointerEvents: 'auto',
      }}
    >
      <div className="relative w-full h-full">
        <div className="absolute inset-0 backdrop-blur-sm bg-black/20 rounded-lg border border-white/20" />
        <div className="absolute inset-0 flex items-center justify-center">
          {/* 3D Cube rendered with Canvas inside HTML */}
          <group ref={cubeRef} scale={0.4}>
            {/* Cube with clickable faces */}
            <mesh
              onPointerOver={() => setHoveredFace(0)}
              onPointerOut={() => setHoveredFace(null)}
              onClick={() => onViewChange(views[0].position)}
              position={[0, 0, 1]}
            >
              <planeGeometry args={[1.8, 1.8]} />
              <meshStandardMaterial
                color={hoveredFace === 0 ? '#3b82f6' : '#4a5568'}
                transparent
                opacity={0.7}
                emissive={hoveredFace === 0 ? '#3b82f6' : '#000000'}
                emissiveIntensity={hoveredFace === 0 ? 0.3 : 0}
              />
            </mesh>
            
            {/* Face labels */}
            <Html position={[0, 0, 1.05]} center>
              <div className="text-white text-[10px] font-bold pointer-events-none">F</div>
            </Html>
            <Html position={[0, 0, -1.05]} center>
              <div className="text-white text-[10px] font-bold pointer-events-none">B</div>
            </Html>
            <Html position={[1.05, 0, 0]} center>
              <div className="text-white text-[10px] font-bold pointer-events-none">R</div>
            </Html>
            <Html position={[-1.05, 0, 0]} center>
              <div className="text-white text-[10px] font-bold pointer-events-none">L</div>
            </Html>
            <Html position={[0, 1.05, 0]} center>
              <div className="text-white text-[10px] font-bold pointer-events-none">T</div>
            </Html>
            <Html position={[0, -1.05, 0]} center>
              <div className="text-white text-[10px] font-bold pointer-events-none">B</div>
            </Html>
            
            {/* Cube edges */}
            <lineSegments>
              <edgesGeometry args={[new THREE.BoxGeometry(2, 2, 2)]} />
              <lineBasicMaterial color="#ffffff" linewidth={2} opacity={0.5} transparent />
            </lineSegments>
          </group>
        </div>
        
        {/* View buttons overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none">
          {views.slice(0, 4).map((view, index) => (
            <button
              key={view.name}
              onClick={() => onViewChange(view.position)}
              onMouseEnter={() => setHoveredFace(index)}
              onMouseLeave={() => setHoveredFace(null)}
              className="text-[9px] text-white/70 hover:text-white transition-colors pointer-events-auto px-1.5 py-0.5 rounded hover:bg-white/10"
            >
              {view.name.charAt(0)}
            </button>
          ))}
        </div>
      </div>
    </Html>
  );
}
