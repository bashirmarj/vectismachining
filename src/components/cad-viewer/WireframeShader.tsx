import { useMemo } from 'react';
import * as THREE from 'three';

interface WireframeShaderProps {
  geometry: THREE.BufferGeometry;
  color?: string;
  thickness?: number;
}

export function WireframeShader({ geometry, color = '#000000', thickness = 1.2 }: WireframeShaderProps) {
  const wireframeGeometry = useMemo(() => {
    const geo = geometry.clone();
    const positionAttribute = geo.attributes.position;
    const count = positionAttribute.count;
    
    // Create barycentric coordinate attribute
    const barycentric = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i += 3) {
      // First vertex of triangle: (1, 0, 0)
      barycentric[i * 3] = 1;
      barycentric[i * 3 + 1] = 0;
      barycentric[i * 3 + 2] = 0;
      
      // Second vertex: (0, 1, 0)
      barycentric[(i + 1) * 3] = 0;
      barycentric[(i + 1) * 3 + 1] = 1;
      barycentric[(i + 1) * 3 + 2] = 0;
      
      // Third vertex: (0, 0, 1)
      barycentric[(i + 2) * 3] = 0;
      barycentric[(i + 2) * 3 + 1] = 0;
      barycentric[(i + 2) * 3 + 2] = 1;
    }
    
    geo.setAttribute('barycentric', new THREE.BufferAttribute(barycentric, 3));
    return geo;
  }, [geometry]);
  
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: `
        attribute vec3 barycentric;
        varying vec3 vBarycentric;
        
        void main() {
          vBarycentric = barycentric;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vBarycentric;
        uniform vec3 wireColor;
        uniform float thickness;
        
        void main() {
          // Calculate distance to nearest edge
          vec3 d = fwidth(vBarycentric);
          vec3 edge = smoothstep(vec3(0.0), d * thickness, vBarycentric);
          float minEdge = min(min(edge.x, edge.y), edge.z);
          
          // Discard pixels far from edges
          if (minEdge > 0.9) discard;
          
          // Draw edge pixels
          gl_FragColor = vec4(wireColor, 1.0);
        }
      `,
      uniforms: {
        wireColor: { value: new THREE.Color(color) },
        thickness: { value: thickness },
      },
      side: THREE.DoubleSide,
    });
  }, [color, thickness]);
  
  return <mesh geometry={wireframeGeometry} material={material} />;
}
