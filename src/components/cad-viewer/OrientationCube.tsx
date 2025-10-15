import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RotateCw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrientationCubeProps {
  onViewChange: (position: [number, number, number]) => void;
}

export function OrientationCube({ onViewChange }: OrientationCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer; cube: THREE.Mesh } | null>(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const w = 120;
    const h = 120;
    
    // Create mini Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 100);
    camera.position.set(3, 2.5, 4);
    camera.lookAt(0, 0, 0);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Create the cube with realistic materials
    const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);
    const cubeMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8b92a0,
      metalness: 0.4,
      roughness: 0.6,
      flatShading: true
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
    
    // Add edges for definition
    const edges = new THREE.EdgesGeometry(cubeGeometry, 15);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x3a4350, linewidth: 1.5 });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    cube.add(edgeLines);
    
    // Create face labels with better styling
    const createFaceLabel = (text: string, color: string = '#ffffff') => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0)';
      ctx.fillRect(0, 0, 256, 256);
      
      // Text
      ctx.fillStyle = color;
      ctx.font = 'bold 120px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 128);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };
    
    // Add labels to cube faces
    const faceTextures = [
      createFaceLabel('R', '#e8eaed'), // Right
      createFaceLabel('L', '#e8eaed'), // Left  
      createFaceLabel('T', '#e8eaed'), // Top
      createFaceLabel('B', '#e8eaed'), // Bottom
      createFaceLabel('F', '#e8eaed'), // Front
      createFaceLabel('Bk', '#e8eaed'), // Back
    ];
    
    faceTextures.forEach((texture, i) => {
      const spriteMat = new THREE.SpriteMaterial({ 
        map: texture, 
        transparent: true,
        opacity: 0.9,
        depthTest: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(1.2, 1.2, 1);
      
      // Position sprites on faces
      const positions = [
        [1.05, 0, 0], [-1.05, 0, 0],
        [0, 1.05, 0], [0, -1.05, 0],
        [0, 0, 1.05], [0, 0, -1.05]
      ];
      sprite.position.set(positions[i][0], positions[i][1], positions[i][2]);
      cube.add(sprite);
    });
    
    // Lighting for depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-3, -2, -3);
    scene.add(fillLight);
    
    // Store refs
    sceneRef.current = { scene, camera, renderer, cube };
    
    // Click handler
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(cube, false);
      
      if (intersects.length > 0) {
        const normal = intersects[0].face?.normal.clone();
        if (!normal) return;
        
        // Transform normal to world space
        normal.applyMatrix4(new THREE.Matrix4().extractRotation(cube.matrixWorld));
        
        const absX = Math.abs(normal.x);
        const absY = Math.abs(normal.y);
        const absZ = Math.abs(normal.z);
        
        let viewPos: [number, number, number];
        
        if (absX > absY && absX > absZ) {
          viewPos = normal.x > 0 ? [300, 0, 0] : [-300, 0, 0];
        } else if (absY > absX && absY > absZ) {
          viewPos = normal.y > 0 ? [0, 300, 0] : [0, -300, 0];
        } else {
          viewPos = normal.z > 0 ? [0, 0, 300] : [0, 0, -300];
        }
        
        onViewChange(viewPos);
      }
    };
    
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'pointer';
    
    // Animation loop
    let rotation = 0;
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Slow rotation for visual interest
      rotation += 0.003;
      cube.rotation.y = rotation;
      cube.rotation.x = Math.sin(rotation * 0.5) * 0.1;
      
      renderer.render(scene, camera);
    };
    animate();
    
    return () => {
      renderer.domElement.removeEventListener('click', onClick);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [onViewChange]);
  
  const handleRotation = (direction: 'up' | 'down' | 'left' | 'right') => {
    const rotationMap = {
      up: [0, 300, 0] as [number, number, number],
      down: [0, -300, 0] as [number, number, number],
      left: [-300, 0, 0] as [number, number, number],
      right: [300, 0, 0] as [number, number, number],
    };
    onViewChange(rotationMap[direction]);
  };
  
  return (
    <div className="absolute top-4 right-20 z-30 flex flex-col items-center">
      {/* Top rotation icon */}
      <button
        onClick={() => handleRotation('up')}
        className="mb-1 p-1 hover:bg-white/10 rounded transition-colors"
        title="View from top"
      >
        <ChevronUp className="w-4 h-4 text-white/70 hover:text-white" />
      </button>
      
      <div className="flex items-center gap-1">
        {/* Left rotation */}
        <button
          onClick={() => handleRotation('left')}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="View from left"
        >
          <ChevronLeft className="w-4 h-4 text-white/70 hover:text-white" />
        </button>
        
        {/* Cube container */}
        <div
          ref={containerRef}
          className="relative"
          style={{
            width: '120px',
            height: '120px',
            background: 'rgba(30, 41, 59, 0.6)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
          }}
        />
        
        {/* Right rotation */}
        <button
          onClick={() => handleRotation('right')}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="View from right"
        >
          <ChevronRight className="w-4 h-4 text-white/70 hover:text-white" />
        </button>
      </div>
      
      {/* Bottom rotation icon */}
      <button
        onClick={() => handleRotation('down')}
        className="mt-1 p-1 hover:bg-white/10 rounded transition-colors"
        title="View from bottom"
      >
        <ChevronDown className="w-4 h-4 text-white/70 hover:text-white" />
      </button>
    </div>
  );
}
