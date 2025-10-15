import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

interface OrientationCubeProps {
  onViewChange: (position: [number, number, number]) => void;
  mainCamera?: THREE.Camera;
}

export function OrientationCube({ onViewChange, mainCamera }: OrientationCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; cube: THREE.Mesh } | null>(null);
  
  // Initialize orientation cube scene
  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    
    const w = 100;
    const h = 100;
    
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0, 8);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    
    // Create cube with Meviy-style material
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(3, 3, 3),
      new THREE.MeshStandardMaterial({
        color: 0x8f98a3,
        metalness: 0.2,
        roughness: 0.85
      })
    );
    scene.add(cube);
    
    // Ambient lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    
    // Face labels helper
    const makeFaceLabel = (txt: string, pos: [number, number, number]) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 64, 32);
      
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false })
      );
      sprite.position.set(...pos);
      sprite.scale.set(1.2, 0.6, 1);
      cube.add(sprite);
    };
    
    // Add face labels
    makeFaceLabel('R', [1.6, 0, 0]);
    makeFaceLabel('L', [-1.6, 0, 0]);
    makeFaceLabel('T', [0, 1.6, 0]);
    makeFaceLabel('B', [0, -1.6, 0]);
    makeFaceLabel('F', [0, 0, 1.6]);
    makeFaceLabel('Bk', [0, 0, -1.6]);
    
    // Click-to-orient
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const hit = raycaster.intersectObject(cube, false)[0];
      if (!hit || !hit.face) return;
      
      const normal = hit.face.normal.clone().normalize().negate();
      
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
    };
    
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'pointer';
    
    cubeRef.current = { scene, camera, renderer, cube };
    
    // Render loop
    const render = () => {
      requestAnimationFrame(render);
      renderer.render(scene, camera);
    };
    render();
    
    return () => {
      renderer.domElement.removeEventListener('click', onClick);
      host.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [onViewChange]);
  
  // Sync cube orientation with main camera
  useEffect(() => {
    if (!mainCamera || !cubeRef.current) return;
    
    let animationId: number;
    const syncOrientation = () => {
      if (cubeRef.current?.cube && mainCamera) {
        cubeRef.current.cube.quaternion.copy(mainCamera.quaternion);
      }
      animationId = requestAnimationFrame(syncOrientation);
    };
    
    syncOrientation();
    
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [mainCamera]);
  
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
    <div className="absolute bottom-5 right-5 z-30 flex flex-col items-center">
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
        
        {/* Cube container - Meviy style */}
        <div
          ref={containerRef}
          className="relative"
          style={{
            width: '100px',
            height: '100px',
            background: 'rgba(255, 255, 255, 0.04)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
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
