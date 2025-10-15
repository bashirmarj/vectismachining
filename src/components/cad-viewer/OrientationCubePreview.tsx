import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Box, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCw, RotateCcw } from 'lucide-react';

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

  useEffect(() => {
    if (!cubeContainerRef.current) return;

    // Setup renderer
    cubeRenderer.setSize(150, 150);
    cubeRenderer.setClearColor(0x1a1a1a, 1);
    cubeContainerRef.current.appendChild(cubeRenderer.domElement);

    // Setup scene
    cubeScene.background = new THREE.Color(0x1a1a1a);

    // Create cube
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x606870,
      metalness: 0.5,
      roughness: 0.5,
    });
    const cube = new THREE.Mesh(geometry, material);
    cubeRef.current = cube;

    // Add edges
    const edges = new THREE.EdgesGeometry(geometry);
    const lineMaterial = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      linewidth: 1,
      transparent: true,
      opacity: 0.15
    });
    const line = new THREE.LineSegments(edges, lineMaterial);
    cube.add(line);

    cubeScene.add(cube);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
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

    // Add face labels
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 256;

    const faces = [
      { text: 'Front', position: [0, 0, 1], rotation: [0, 0, 0] },
      { text: 'Back', position: [0, 0, -1], rotation: [0, Math.PI, 0] },
      { text: 'Right', position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
      { text: 'Left', position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
      { text: 'Top', position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
      { text: 'Bottom', position: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] }
    ];

    faces.forEach(face => {
      context.fillStyle = '#1a1a1a';
      context.fillRect(0, 0, 256, 256);
      context.fillStyle = '#ffffff';
      context.font = 'bold 48px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(face.text, 128, 128);

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        opacity: 0.9
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(
        face.position[0] * 1.01,
        face.position[1] * 1.01,
        face.position[2] * 1.01
      );
      sprite.scale.set(1.5, 1.5, 1);
      cube.add(sprite);
    });

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
      
      // Auto-rotate the cube slowly
      if (cubeRef.current) {
        cubeRef.current.rotation.y += 0.003;
        cubeRef.current.rotation.x += 0.001;
      }
      
      cubeRenderer.render(cubeScene, cubeCamera);
    };
    animate();

    return () => {
      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Remove event listeners
      cubeRenderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      cubeRenderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      // Dispose geometries
      geometry.dispose();
      edges.dispose();

      // Dispose materials
      material.dispose();
      lineMaterial.dispose();

      // Dispose all sprite materials and textures
      cube.children.forEach(child => {
        if (child instanceof THREE.Sprite) {
          if (child.material.map) {
            child.material.map.dispose();
          }
          child.material.dispose();
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
    cubeCamera.position.copy(direction.multiplyScalar(distance));
    cubeCamera.lookAt(0, 0, 0);
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
        className="relative rounded-lg overflow-hidden"
        style={{
          width: '150px',
          height: '150px',
          background: 'rgba(26, 26, 26, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      />

      {/* Directional Arrow Buttons */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => orientCameraToDirection(new THREE.Vector3(0, 1, 0))}
        className="absolute -top-10 left-1/2 -translate-x-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Top View"
      >
        <ChevronUp className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => orientCameraToDirection(new THREE.Vector3(0, -1, 0))}
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Bottom View"
      >
        <ChevronDown className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => orientCameraToDirection(new THREE.Vector3(-1, 0, 0))}
        className="absolute top-1/2 -left-10 -translate-y-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Left View"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => orientCameraToDirection(new THREE.Vector3(1, 0, 0))}
        className="absolute top-1/2 -right-10 -translate-y-1/2 h-8 w-8 bg-background/95 hover:bg-accent border border-border/10"
        title="Right View"
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
