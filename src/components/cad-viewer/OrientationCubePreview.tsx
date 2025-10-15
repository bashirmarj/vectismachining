import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Box, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCw, RotateCcw } from 'lucide-react';

// Helper function to create a beveled box geometry
function createBeveledBoxGeometry(
  width: number,
  height: number,
  depth: number,
  bevelRadius: number,
  segments: number = 3
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const halfWidth = width / 2 - bevelRadius;
  const halfHeight = height / 2 - bevelRadius;
  
  // Draw rounded rectangle
  shape.moveTo(-halfWidth, -halfHeight + bevelRadius);
  shape.lineTo(-halfWidth, halfHeight - bevelRadius);
  shape.quadraticCurveTo(-halfWidth, halfHeight, -halfWidth + bevelRadius, halfHeight);
  shape.lineTo(halfWidth - bevelRadius, halfHeight);
  shape.quadraticCurveTo(halfWidth, halfHeight, halfWidth, halfHeight - bevelRadius);
  shape.lineTo(halfWidth, -halfHeight + bevelRadius);
  shape.quadraticCurveTo(halfWidth, -halfHeight, halfWidth - bevelRadius, -halfHeight);
  shape.lineTo(-halfWidth + bevelRadius, -halfHeight);
  shape.quadraticCurveTo(-halfWidth, -halfHeight, -halfWidth, -halfHeight + bevelRadius);
  
  // Extrude settings
  const extrudeSettings = {
    depth: depth - bevelRadius * 2,
    bevelEnabled: true,
    bevelThickness: bevelRadius,
    bevelSize: bevelRadius,
    bevelSegments: segments,
  };
  
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geometry.center();
  return geometry;
}

export function OrientationCubePreview() {
  const cubeContainerRef = useRef<HTMLDivElement>(null);
  const [cubeScene] = useState(() => new THREE.Scene());
  const [cubeCamera] = useState(() => new THREE.PerspectiveCamera(50, 1, 0.1, 1000));
  const [cubeRenderer] = useState(() => new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    preserveDrawingBuffer: true 
  }));
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number>();
  const [hoveredRegion, setHoveredRegion] = useState<{
    type: 'face' | 'edge' | 'corner';
    description: string;
  } | null>(null);

  // Helper function to classify click region (face, edge, or corner)
  const classifyClickRegion = (localPoint: THREE.Vector3) => {
    const faceDistance = 1.0; // Half the cube size (2/2)
    const edgeThreshold = 0.25; // Adjusted for beveled edges
    const cornerThreshold = 0.5;
    
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

  useEffect(() => {
    if (!cubeContainerRef.current) return;

    // Setup renderer
    cubeRenderer.setSize(220, 220);
    cubeRenderer.setClearColor(0x2a2a3a, 1);
    cubeContainerRef.current.appendChild(cubeRenderer.domElement);

    // Setup scene
    cubeScene.background = new THREE.Color(0x2a2a3a);

    // Create beveled cube
    const bevelRadius = 0.25; // More visible bevels
    const geometry = createBeveledBoxGeometry(2, 2, 2, bevelRadius, 3);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0xfafafa, // Uniform white color
      metalness: 0,
      roughness: 0.4,
      transparent: false,
      opacity: 1
    });
    const cube = new THREE.Mesh(geometry, material);
    cubeRef.current = cube;

    // Add subtle edges
    const edges = new THREE.EdgesGeometry(geometry, 10);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xdddddd, // Very light gray for subtle edges
      linewidth: 1,
      transparent: true,
      opacity: 0.2 // Very subtle
    });
    const line = new THREE.LineSegments(edges, lineMaterial);
    cube.add(line);

    // Add blue highlight edges (initially hidden)
    const highlightEdges = new THREE.EdgesGeometry(geometry, 10);
    const highlightLineMaterial = new THREE.LineBasicMaterial({
      color: 0x3b82f6, // Blue highlight
      linewidth: 2,
      transparent: true,
      opacity: 0 // Initially invisible
    });
    const highlightLine = new THREE.LineSegments(highlightEdges, highlightLineMaterial);
    cube.add(highlightLine);

    cubeScene.add(cube);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    cubeScene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(8, 8, 8);
    cubeScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.2);
    fillLight.position.set(-5, -3, -5);
    cubeScene.add(fillLight);

    // Position camera
    cubeCamera.position.set(3, 3, 3);
    cubeCamera.lookAt(0, 0, 0);

    // Edge and corner beveling is now integrated into the geometry itself

    // Add face labels using Planes instead of Sprites (fixed to face orientation)
    const faces = [
      { text: 'Front', position: [0, 0, 1], rotation: [0, 0, 0] },
      { text: 'Back', position: [0, 0, -1], rotation: [0, Math.PI, 0] },
      { text: 'Right', position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
      { text: 'Left', position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
      { text: 'Top', position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
      { text: 'Bottom', position: [0, -1, 0], rotation: [Math.PI / 2, 0, Math.PI] }
    ];

    faces.forEach(face => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 512;
      canvas.height = 512;

      // No background for clean look

      // White text with shadow for better readability
      context.shadowColor = 'rgba(0, 0, 0, 0.9)';
      context.shadowBlur = 10;
      context.shadowOffsetX = 3;
      context.shadowOffsetY = 3;
      
      context.fillStyle = '#ffffff';
      context.font = 'bold 80px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(face.text, 256, 256);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      
      // Use PlaneGeometry instead of Sprite to fix orientation to face
      const planeGeometry = new THREE.PlaneGeometry(1.8, 1.8);
      const planeMaterial = new THREE.MeshBasicMaterial({ 
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        fog: false
      });
      const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
      
      // Position and rotate to match face orientation
      planeMesh.position.set(
        face.position[0] * 1.02,
        face.position[1] * 1.02,
        face.position[2] * 1.02
      );
      planeMesh.rotation.set(face.rotation[0], face.rotation[1], face.rotation[2]);
      
      cube.add(planeMesh);
    });

    // Click handler for interactive orientation
    const onClick = (e: MouseEvent) => {
      const rect = cubeRenderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cubeCamera);
      const intersects = raycaster.intersectObject(cube, false);
      
      if (intersects.length === 0) return;
      
      const hit = intersects[0];
      if (!hit || !hit.point) return;
      
      const localPoint = cube.worldToLocal(hit.point.clone());
      const region = classifyClickRegion(localPoint);
      
      console.log(`Clicked ${region.type}: ${region.description}`);
      orientCameraToDirection(region.direction);
    };

    // Hover handler for visual feedback
    const onMouseMove = (e: MouseEvent) => {
      const rect = cubeRenderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, cubeCamera);
      const intersects = raycaster.intersectObject(cube, false);
      
      if (intersects.length === 0) {
        highlightLineMaterial.opacity = 0; // Hide blue highlight
        setHoveredRegion(null);
        cubeRenderer.domElement.style.cursor = 'default';
        return;
      }
      
      const hit = intersects[0];
      if (!hit || !hit.point) {
        highlightLineMaterial.opacity = 0; // Hide blue highlight
        setHoveredRegion(null);
        return;
      }
      
      const localPoint = cube.worldToLocal(hit.point.clone());
      const region = classifyClickRegion(localPoint);
      
      highlightLineMaterial.opacity = 0.9; // Show blue highlight on hover
      
      setHoveredRegion({
        type: region.type,
        description: region.description
      });
      
      cubeRenderer.domElement.style.cursor = 'pointer';
    };

    const onMouseLeave = () => {
      highlightLineMaterial.opacity = 0; // Hide blue highlight
      setHoveredRegion(null);
      cubeRenderer.domElement.style.cursor = 'default';
    };

    cubeRenderer.domElement.addEventListener('click', onClick);
    cubeRenderer.domElement.addEventListener('mousemove', onMouseMove);
    cubeRenderer.domElement.addEventListener('mouseleave', onMouseLeave);

    // Context loss/restore handlers
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      console.log('WebGL context lost - orientation cube');
    };

    const handleContextRestored = () => {
      console.log('WebGL context restored - orientation cube');
      animate();
    };

    cubeRenderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    cubeRenderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      cubeRenderer.render(cubeScene, cubeCamera);
    };
    animate();

    return () => {
      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Remove event listeners
      cubeRenderer.domElement.removeEventListener('click', onClick);
      cubeRenderer.domElement.removeEventListener('mousemove', onMouseMove);
      cubeRenderer.domElement.removeEventListener('mouseleave', onMouseLeave);
      cubeRenderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      cubeRenderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      // Dispose geometries
      geometry.dispose();
      edges.dispose();
      highlightEdges.dispose();

      // Dispose materials
      material.dispose();
      lineMaterial.dispose();
      highlightLineMaterial.dispose();

      // Dispose all mesh materials, textures, and geometries
      cube.children.forEach(child => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => {
                if (mat.map) mat.map.dispose();
                mat.dispose();
              });
            } else {
              if (child.material.map) child.material.map.dispose();
              child.material.dispose();
            }
          }
        }
      });

      // Dispose renderer and force context loss
      cubeRenderer.dispose();
      cubeRenderer.forceContextLoss();

      // Remove DOM element
      if (cubeContainerRef.current && cubeRenderer.domElement.parentNode === cubeContainerRef.current) {
        cubeContainerRef.current.removeChild(cubeRenderer.domElement);
      }
    };
  }, [cubeScene, cubeCamera, cubeRenderer]);

  const orientCameraToDirection = (direction: THREE.Vector3) => {
    const distance = 5;
    const target = new THREE.Vector3(0, 0, 0);
    
    // Calculate new position
    const newPosition = target.clone().add(
      direction.clone().normalize().multiplyScalar(distance)
    );
    
    // Handle up vector for top/bottom views
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(direction.y) > 0.99) {
      up.set(0, 0, direction.y > 0 ? 1 : -1);
    }
    
    cubeCamera.position.copy(newPosition);
    cubeCamera.up.copy(up);
    cubeCamera.lookAt(target);
    cubeCamera.updateProjectionMatrix();
  };

  const setIsometricView = () => {
    const distance = 5;
    const angle = Math.PI / 4; // 45 degrees
    const elevation = Math.asin(Math.tan(Math.PI / 6)); // ~35.264 degrees
    
    cubeCamera.position.set(
      distance * Math.cos(elevation) * Math.cos(angle),
      distance * Math.sin(elevation),
      distance * Math.cos(elevation) * Math.sin(angle)
    );
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
  };

  const rotateCameraClockwise = () => {
    const currentPos = cubeCamera.position.clone();
    const angle = Math.PI / 4; // 45 degrees
    
    const newX = currentPos.x * Math.cos(angle) - currentPos.z * Math.sin(angle);
    const newZ = currentPos.x * Math.sin(angle) + currentPos.z * Math.cos(angle);
    
    cubeCamera.position.set(newX, currentPos.y, newZ);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
  };

  const rotateCameraCounterClockwise = () => {
    const currentPos = cubeCamera.position.clone();
    const angle = -Math.PI / 4; // -45 degrees
    
    const newX = currentPos.x * Math.cos(angle) - currentPos.z * Math.sin(angle);
    const newZ = currentPos.x * Math.sin(angle) + currentPos.z * Math.cos(angle);
    
    cubeCamera.position.set(newX, currentPos.y, newZ);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
  };

  const rotateCameraUp = () => {
    const currentPos = cubeCamera.position.clone().normalize();
    const distance = 5;
    
    // Front (0,0,1) → Top (0,1,0) → Back (0,0,-1) → Bottom (0,-1,0) → Front
    const faces = [
      new THREE.Vector3(0, 0, 1),   // Front
      new THREE.Vector3(0, 1, 0),   // Top
      new THREE.Vector3(0, 0, -1),  // Back
      new THREE.Vector3(0, -1, 0),  // Bottom
    ];
    
    // Find closest face
    let closestIndex = 0;
    let maxDot = -Infinity;
    
    faces.forEach((face, index) => {
      const dot = currentPos.dot(face);
      if (dot > maxDot) {
        maxDot = dot;
        closestIndex = index;
      }
    });
    
    // Move to next face in cycle
    const nextIndex = (closestIndex + 1) % faces.length;
    const nextFace = faces[nextIndex];
    
    cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));
    
    // Handle up vector for top/bottom views
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(nextFace.y) > 0.99) {
      up.set(0, 0, nextFace.y > 0 ? 1 : -1);
    }
    cubeCamera.up.copy(up);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
  };

  const rotateCameraDown = () => {
    const currentPos = cubeCamera.position.clone().normalize();
    const distance = 5;
    
    // Front (0,0,1) → Bottom (0,-1,0) → Back (0,0,-1) → Top (0,1,0) → Front
    const faces = [
      new THREE.Vector3(0, 0, 1),   // Front
      new THREE.Vector3(0, -1, 0),  // Bottom
      new THREE.Vector3(0, 0, -1),  // Back
      new THREE.Vector3(0, 1, 0),   // Top
    ];
    
    // Find closest face
    let closestIndex = 0;
    let maxDot = -Infinity;
    
    faces.forEach((face, index) => {
      const dot = currentPos.dot(face);
      if (dot > maxDot) {
        maxDot = dot;
        closestIndex = index;
      }
    });
    
    // Move to next face in cycle
    const nextIndex = (closestIndex + 1) % faces.length;
    const nextFace = faces[nextIndex];
    
    cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));
    
    // Handle up vector for top/bottom views
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(nextFace.y) > 0.99) {
      up.set(0, 0, nextFace.y > 0 ? 1 : -1);
    }
    cubeCamera.up.copy(up);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
  };

  const rotateCameraLeft = () => {
    const currentPos = cubeCamera.position.clone().normalize();
    const distance = 5;
    
    // Front (0,0,1) → Left (-1,0,0) → Back (0,0,-1) → Right (1,0,0) → Front
    const faces = [
      new THREE.Vector3(0, 0, 1),   // Front
      new THREE.Vector3(-1, 0, 0),  // Left
      new THREE.Vector3(0, 0, -1),  // Back
      new THREE.Vector3(1, 0, 0),   // Right
    ];
    
    // Find closest face
    let closestIndex = 0;
    let maxDot = -Infinity;
    
    faces.forEach((face, index) => {
      const dot = currentPos.dot(face);
      if (dot > maxDot) {
        maxDot = dot;
        closestIndex = index;
      }
    });
    
    // Move to next face in cycle
    const nextIndex = (closestIndex + 1) % faces.length;
    const nextFace = faces[nextIndex];
    
    cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));
    cubeCamera.up.set(0, 1, 0);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
  };

  const rotateCameraRight = () => {
    const currentPos = cubeCamera.position.clone().normalize();
    const distance = 5;
    
    // Front (0,0,1) → Right (1,0,0) → Back (0,0,-1) → Left (-1,0,0) → Front
    const faces = [
      new THREE.Vector3(0, 0, 1),   // Front
      new THREE.Vector3(1, 0, 0),   // Right
      new THREE.Vector3(0, 0, -1),  // Back
      new THREE.Vector3(-1, 0, 0),  // Left
    ];
    
    // Find closest face
    let closestIndex = 0;
    let maxDot = -Infinity;
    
    faces.forEach((face, index) => {
      const dot = currentPos.dot(face);
      if (dot > maxDot) {
        maxDot = dot;
        closestIndex = index;
      }
    });
    
    // Move to next face in cycle
    const nextIndex = (closestIndex + 1) % faces.length;
    const nextFace = faces[nextIndex];
    
    cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));
    cubeCamera.up.set(0, 1, 0);
    cubeCamera.lookAt(0, 0, 0);
    cubeCamera.updateProjectionMatrix();
  };

  return (
    <div className="relative inline-block">
      {/* Isometric Reset Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={setIsometricView}
        className="absolute top-2 left-2 z-10 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Reset to Isometric View"
      >
        <Box className="h-4 w-4" />
      </Button>

      {/* Cube Container */}
      <div 
        ref={cubeContainerRef} 
        className="relative rounded-lg overflow-hidden shadow-lg"
        style={{
          width: '220px',
          height: '220px',
          background: 'rgba(42, 42, 58, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      />

      {/* Hover tooltip */}
      {hoveredRegion && (
        <div 
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md text-xs font-medium text-white whitespace-nowrap pointer-events-none z-50"
          style={{
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
          }}
        >
          {hoveredRegion.description}
          <div className="text-[10px] text-white/60 mt-0.5">
            {hoveredRegion.type === 'face' && 'Orthogonal view'}
            {hoveredRegion.type === 'edge' && 'Two-axis view'}
            {hoveredRegion.type === 'corner' && 'Tri-axial view'}
          </div>
        </div>
      )}

      {/* Directional Arrow Buttons */}
      <Button
        variant="ghost"
        size="icon"
        onClick={rotateCameraUp}
        className="absolute -top-10 left-1/2 -translate-x-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Rotate View Up"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={rotateCameraDown}
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Rotate View Down"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={rotateCameraLeft}
        className="absolute top-1/2 -left-10 -translate-y-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Rotate View Left"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={rotateCameraRight}
        className="absolute top-1/2 -right-10 -translate-y-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Rotate View Right"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Curved Rotation Arrows */}
      <Button
        variant="ghost"
        size="icon"
        onClick={rotateCameraClockwise}
        className="absolute -top-10 -right-10 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Rotate Clockwise"
      >
        <RotateCw className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={rotateCameraCounterClockwise}
        className="absolute -top-10 -left-10 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Rotate Counter-Clockwise"
      >
        <RotateCcw className="h-4 w-4" />
      </Button>
    </div>
  );
}
