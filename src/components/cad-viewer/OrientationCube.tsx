import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface OrientationCubeProps {
  onViewChange: (position: [number, number, number]) => void;
}

export function OrientationCube({ onViewChange }: OrientationCubeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{ scene: THREE.Scene; camera: THREE.Camera; renderer: THREE.WebGLRenderer; cube: THREE.Group } | null>(null);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const w = 100;
    const h = 100;
    
    // Create mini Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0, 8);
    
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    
    // Create cube group
    const cubeGroup = new THREE.Group();
    
    // Create the main cube with edges
    const cubeGeometry = new THREE.BoxGeometry(2.5, 2.5, 2.5);
    const cubeMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x4a5568,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cubeGroup.add(cube);
    
    // Add edges for the cube
    const edges = new THREE.EdgesGeometry(cubeGeometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x9ca3af, linewidth: 2 });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    cubeGroup.add(edgeLines);
    
    // Create axes arrows (X, Y, Z)
    const arrowLength = 2;
    const arrowHeadLength = 0.4;
    const arrowHeadWidth = 0.25;
    
    // X axis - Red (Right)
    const xArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0xef4444,
      arrowHeadLength,
      arrowHeadWidth
    );
    cubeGroup.add(xArrow);
    
    // Y axis - Green (Up)
    const yArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x22c55e,
      arrowHeadLength,
      arrowHeadWidth
    );
    cubeGroup.add(yArrow);
    
    // Z axis - Blue (Front)
    const zArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 0, 0),
      arrowLength,
      0x3b82f6,
      arrowHeadLength,
      arrowHeadWidth
    );
    cubeGroup.add(zArrow);
    
    // Add axis labels using sprites
    const createTextSprite = (text: string, color: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      ctx.font = 'bold 48px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 32);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(0.5, 0.5, 1);
      return sprite;
    };
    
    const xLabel = createTextSprite('X', 0xef4444);
    xLabel.position.set(2.5, 0, 0);
    cubeGroup.add(xLabel);
    
    const yLabel = createTextSprite('Y', 0x22c55e);
    yLabel.position.set(0, 2.5, 0);
    cubeGroup.add(yLabel);
    
    const zLabel = createTextSprite('Z', 0x3b82f6);
    zLabel.position.set(0, 0, 2.5);
    cubeGroup.add(zLabel);
    
    // Add face labels for orientation
    const faceLabelMaterial = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = 'bold 60px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 64, 64);
      return new THREE.CanvasTexture(canvas);
    };
    
    const faceLabels = [
      { text: 'R', pos: [1.3, 0, 0], view: [300, 0, 0] as [number, number, number] },
      { text: 'L', pos: [-1.3, 0, 0], view: [-300, 0, 0] as [number, number, number] },
      { text: 'T', pos: [0, 1.3, 0], view: [0, 300, 0] as [number, number, number] },
      { text: 'B', pos: [0, -1.3, 0], view: [0, -300, 0] as [number, number, number] },
      { text: 'F', pos: [0, 0, 1.3], view: [0, 0, 300] as [number, number, number] },
      { text: 'Bk', pos: [0, 0, -1.3], view: [0, 0, -300] as [number, number, number] },
    ];
    
    faceLabels.forEach(({ text, pos }) => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ 
          map: faceLabelMaterial(text),
          depthTest: false,
          transparent: true
        })
      );
      sprite.position.set(pos[0], pos[1], pos[2]);
      sprite.scale.set(0.8, 0.8, 1);
      cubeGroup.add(sprite);
    });
    
    scene.add(cubeGroup);
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Store refs
    sceneRef.current = { scene, camera, renderer, cube: cubeGroup };
    
    // Click handler for face selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(cube, false);
      
      if (intersects.length > 0) {
        // Determine which face was clicked based on the normal
        const normal = intersects[0].face?.normal;
        if (!normal) return;
        
        // Transform normal by cube rotation
        const worldNormal = normal.clone().applyQuaternion(cubeGroup.quaternion);
        
        // Find the dominant axis
        const absX = Math.abs(worldNormal.x);
        const absY = Math.abs(worldNormal.y);
        const absZ = Math.abs(worldNormal.z);
        
        let viewPos: [number, number, number];
        
        if (absX > absY && absX > absZ) {
          viewPos = worldNormal.x > 0 ? [300, 0, 0] : [-300, 0, 0];
        } else if (absY > absX && absY > absZ) {
          viewPos = worldNormal.y > 0 ? [0, 300, 0] : [0, -300, 0];
        } else {
          viewPos = worldNormal.z > 0 ? [0, 0, 300] : [0, 0, -300];
        }
        
        onViewChange(viewPos);
      }
    };
    
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'pointer';
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      
      // Subtle auto-rotation for visual appeal
      cubeGroup.rotation.y += 0.002;
      cubeGroup.rotation.x += 0.001;
      
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
        width: '100px',
        height: '100px',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    />
  );
}
