import { useState, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface MeasurementPoint {
  position: THREE.Vector3;
}

interface MeasurementToolProps {
  enabled: boolean;
  mode: 'distance' | 'angle' | 'radius' | null;
}

export function MeasurementTool({ enabled, mode }: MeasurementToolProps) {
  const [points, setPoints] = useState<MeasurementPoint[]>([]);
  const { scene, gl, camera } = useThree();
  
  const markersRef = useRef<THREE.Mesh[]>([]);
  
  // Handle clicks for measurement
  useEffect(() => {
    if (!enabled || !mode) return;
    
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onClick = (event: MouseEvent) => {
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      // Filter out markers
      const validIntersects = intersects.filter(
        (i) => !markersRef.current.includes(i.object as THREE.Mesh)
      );
      
      if (validIntersects.length > 0) {
        const point = validIntersects[0].point;
        
        if (mode === 'distance') {
          if (points.length < 2) {
            const newPoints = [...points, { position: point.clone() }];
            setPoints(newPoints);
          } else {
            // Reset on third click
            setPoints([{ position: point.clone() }]);
          }
        }
      }
    };
    
    const canvas = gl.domElement;
    canvas.addEventListener('click', onClick);
    
    return () => {
      canvas.removeEventListener('click', onClick);
    };
  }, [enabled, mode, points, scene, camera, gl]);
  
  // Clear on mode change or disable
  useEffect(() => {
    if (!enabled) {
      setPoints([]);
    }
  }, [enabled, mode]);
  
  // Calculate distance
  const distance = points.length === 2 
    ? points[0].position.distanceTo(points[1].position) 
    : null;
  
  const midpoint = points.length === 2
    ? points[0].position.clone().add(points[1].position).multiplyScalar(0.5)
    : null;
  
  return (
    <>
      {/* Render measurement markers */}
      {points.map((point, index) => (
        <mesh
          key={index}
          position={point.position}
          ref={(mesh) => {
            if (mesh && !markersRef.current.includes(mesh)) {
              markersRef.current[index] = mesh;
            }
          }}
        >
          <sphereGeometry args={[1.6, 16, 16]} />
          <meshBasicMaterial color="#ff385c" />
        </mesh>
      ))}
      
      {/* Render line between points */}
      {points.length === 2 && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                ...points[0].position.toArray(),
                ...points[1].position.toArray(),
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#00ff00" linewidth={2} />
        </line>
      )}
      
      {/* Display measurement label */}
      {distance !== null && midpoint && (
        <Html position={midpoint}>
          <div
            style={{
              color: '#fff',
              fontSize: '12px',
              background: 'rgba(0, 0, 0, 0.7)',
              padding: '4px 8px',
              borderRadius: '8px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {distance.toFixed(2)} mm
          </div>
        </Html>
      )}
    </>
  );
}
