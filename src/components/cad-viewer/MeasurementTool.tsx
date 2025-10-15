import { useState, useRef, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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
  const labelRef = useRef<CSS2DObject | null>(null);
  const css2DRendererRef = useRef<CSS2DRenderer | null>(null);
  
  // Initialize CSS2DRenderer
  useEffect(() => {
    const canvas = gl.domElement;
    const parent = canvas.parentElement;
    if (!parent) return;
    
    const css2DRenderer = new CSS2DRenderer();
    css2DRenderer.setSize(parent.clientWidth, parent.clientHeight);
    css2DRenderer.domElement.style.position = 'absolute';
    css2DRenderer.domElement.style.top = '0';
    css2DRenderer.domElement.style.left = '0';
    css2DRenderer.domElement.style.pointerEvents = 'none';
    parent.appendChild(css2DRenderer.domElement);
    
    css2DRendererRef.current = css2DRenderer;
    
    // Render loop
    const animate = () => {
      if (css2DRendererRef.current) {
        css2DRendererRef.current.render(scene, camera);
      }
      requestAnimationFrame(animate);
    };
    animate();
    
    return () => {
      if (css2DRenderer.domElement.parentElement) {
        css2DRenderer.domElement.parentElement.removeChild(css2DRenderer.domElement);
      }
    };
  }, [scene, camera, gl]);
  
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
      
      // Filter out markers and labels
      const validIntersects = intersects.filter(
        (i) => !markersRef.current.includes(i.object as THREE.Mesh)
      );
      
      if (validIntersects.length > 0) {
        const point = validIntersects[0].point;
        
        if (mode === 'distance') {
          if (points.length < 2) {
            const newPoints = [...points, { position: point.clone() }];
            setPoints(newPoints);
            
            // Add marker
            const markerGeom = new THREE.SphereGeometry(1.6, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({ color: 0xff385c });
            const marker = new THREE.Mesh(markerGeom, markerMat);
            marker.position.copy(point);
            scene.add(marker);
            markersRef.current.push(marker);
            
            // If two points, show distance
            if (newPoints.length === 2) {
              const distance = newPoints[0].position.distanceTo(newPoints[1].position);
              const midpoint = newPoints[0].position.clone().add(newPoints[1].position).multiplyScalar(0.5);
              
              // Create CSS2D label
              const labelDiv = document.createElement('div');
              labelDiv.style.color = '#fff';
              labelDiv.style.fontSize = '12px';
              labelDiv.style.background = 'rgba(0,0,0,0.7)';
              labelDiv.style.padding = '4px 8px';
              labelDiv.style.borderRadius = '8px';
              labelDiv.style.fontWeight = 'bold';
              labelDiv.textContent = `${distance.toFixed(2)} mm`;
              
              const label = new CSS2DObject(labelDiv);
              label.position.copy(midpoint);
              scene.add(label);
              labelRef.current = label;
            }
          } else {
            // Reset on third click
            clearMeasurements();
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
  
  const clearMeasurements = () => {
    // Remove markers
    markersRef.current.forEach((marker) => {
      scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    });
    markersRef.current = [];
    
    // Remove label
    if (labelRef.current) {
      scene.remove(labelRef.current);
      labelRef.current = null;
    }
    
    setPoints([]);
  };
  
  // Clear on mode change or disable
  useEffect(() => {
    if (!enabled) {
      clearMeasurements();
    }
  }, [enabled, mode]);
  
  // Render line between points
  return (
    <>
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
    </>
  );
}
