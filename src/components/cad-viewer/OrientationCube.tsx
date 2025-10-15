import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface OrientationCubeProps {
  onViewChange: (position: [number, number, number]) => void;
}

export function OrientationCube({ onViewChange }: OrientationCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const w = 86;
    const h = 86;
    
    // Mini Three.js scene for orientation cube
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0, 8);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    // Create cube with 6 materials (one per face)
    const materials = [
      new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.2, roughness: 0.8 }), // Right
      new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.2, roughness: 0.8 }), // Left
      new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.2, roughness: 0.8 }), // Top
      new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.2, roughness: 0.8 }), // Bottom
      new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.2, roughness: 0.8 }), // Front
      new THREE.MeshStandardMaterial({ color: 0x9aa4b2, metalness: 0.2, roughness: 0.8 }), // Back
    ];
    
    const cube = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 3), materials);
    scene.add(cube);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    
    // Add face labels using canvas textures
    const createTextTexture = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 32);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    };
    
    const labels = [
      { text: 'R', pos: [1.6, 0, 0] as [number, number, number] },
      { text: 'L', pos: [-1.6, 0, 0] as [number, number, number] },
      { text: 'T', pos: [0, 1.6, 0] as [number, number, number] },
      { text: 'B', pos: [0, -1.6, 0] as [number, number, number] },
      { text: 'F', pos: [0, 0, 1.6] as [number, number, number] },
      { text: 'Bk', pos: [0, 0, -1.6] as [number, number, number] },
    ];
    
    labels.forEach(({ text, pos }) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createTextTexture(text),
          depthTest: false,
        })
      );
      sprite.position.set(pos[0], pos[1], pos[2]);
      sprite.scale.set(1.2, 0.6, 1);
      cube.add(sprite);
    });
    
    // Raycasting for face detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const viewOrientations: Record<string, [number, number, number]> = {
      Right: [300, 0, 0],
      Left: [-300, 0, 0],
      Top: [0, 300, 0],
      Bottom: [0, -300, 0],
      Front: [0, 0, 300],
      Back: [0, 0, -300],
    };
    
    const faceIndexToView = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back'];
    
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(cube, false);
      
      if (intersects.length > 0) {
        const faceIndex = intersects[0].faceIndex;
        if (faceIndex !== undefined) {
          // Each face has 2 triangles, so divide by 2
          const materialIndex = Math.floor(faceIndex / 2);
          const viewName = faceIndexToView[materialIndex];
          if (viewName && viewOrientations[viewName]) {
            onViewChange(viewOrientations[viewName]);
          }
        }
      }
    };
    
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'pointer';
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      // Cube doesn't rotate on its own; it should sync with main camera if needed
      renderer.render(scene, camera);
    };
    animate();
    
    return () => {
      renderer.domElement.removeEventListener('click', onClick);
      container.removeChild(renderer.domElement);
      renderer.dispose();
    };
  }, [onViewChange]);
  
  return (
    <div
      ref={containerRef}
      className="absolute bottom-4 right-4 z-30"
      style={{
        width: '86px',
        height: '86px',
        background: 'rgba(255, 255, 255, 0.06)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    />
  );
}
