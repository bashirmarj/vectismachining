import { useState, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
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
  const [measurement, setMeasurement] = useState<string | null>(null);
  const { camera, gl } = useThree();
  
  const handleClick = (event: any) => {
    if (!enabled || !mode) return;
    
    const intersects = event.intersections;
    if (intersects.length > 0) {
      const point = intersects[0].point;
      
      if (mode === 'distance' && points.length < 2) {
        const newPoints = [...points, { position: point.clone() }];
        setPoints(newPoints);
        
        if (newPoints.length === 2) {
          const distance = newPoints[0].position.distanceTo(newPoints[1].position);
          setMeasurement(`${distance.toFixed(2)} mm`);
        }
      } else if (mode === 'radius') {
        // For radius/diameter detection on circular edges
        setMeasurement('Radius detection in progress...');
      }
    }
  };
  
  const clearMeasurements = () => {
    setPoints([]);
    setMeasurement(null);
  };
  
  return (
    <>
      {/* Render measurement points */}
      {points.map((point, index) => (
        <mesh key={index} position={point.position}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      ))}
      
      {/* Render measurement line */}
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
      
      {/* Display measurement result */}
      {measurement && points.length === 2 && (
        <Html position={points[0].position.clone().lerp(points[1].position, 0.5)}>
          <div className="bg-background/95 backdrop-blur px-3 py-1.5 rounded border border-border shadow-lg">
            <p className="text-sm font-semibold text-foreground whitespace-nowrap">
              {measurement}
            </p>
          </div>
        </Html>
      )}
    </>
  );
}
