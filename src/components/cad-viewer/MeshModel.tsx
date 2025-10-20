import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface SelectedFeature {
  triangleStart: number;
  triangleEnd: number;
  center: [number, number, number];
}

interface MeshModelProps {
  vertices: number[];
  indices: number[];
  normals: number[];
  vertex_colors?: string[];
  selectedFeature?: SelectedFeature | null; // ⭐ NEW: Selected feature for highlighting
}

const MeshModel: React.FC<MeshModelProps> = ({ 
  vertices, 
  indices, 
  normals, 
  vertex_colors,
  selectedFeature 
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  // Convert flat arrays to THREE.js BufferAttribute format
  const geometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    
    // Set vertices
    const verticesArray = new Float32Array(vertices);
    geom.setAttribute('position', new THREE.BufferAttribute(verticesArray, 3));
    
    // Set indices
    const indicesArray = new Uint32Array(indices);
    geom.setIndex(new THREE.BufferAttribute(indicesArray, 1));
    
    // Set normals
    const normalsArray = new Float32Array(normals);
    geom.setAttribute('normal', new THREE.BufferAttribute(normalsArray, 3));
    
    return geom;
  }, [vertices, indices, normals]);

  // ⭐ NEW: Dynamic color array based on selection
  const colors = useMemo(() => {
    const colorArray = new Float32Array(vertices.length); // RGB for each vertex
    
    if (!vertex_colors || vertex_colors.length === 0) {
      // Default grey if no colors provided
      for (let i = 0; i < vertices.length / 3; i++) {
        colorArray[i * 3] = 0.6;     // R
        colorArray[i * 3 + 1] = 0.6; // G
        colorArray[i * 3 + 2] = 0.6; // B
      }
      return colorArray;
    }

    // Parse hex colors from backend
    for (let i = 0; i < vertex_colors.length; i++) {
      const hexColor = vertex_colors[i];
      const color = new THREE.Color(hexColor);
      
      colorArray[i * 3] = color.r;
      colorArray[i * 3 + 1] = color.g;
      colorArray[i * 3 + 2] = color.b;
    }

    // ⭐ HIGHLIGHT: Override colors for selected feature
    if (selectedFeature) {
      const { triangleStart, triangleEnd } = selectedFeature;
      const highlightColor = new THREE.Color('#FFA500'); // Bright Orange

      // Each triangle has 3 vertices
      for (let triIdx = triangleStart; triIdx < triangleEnd; triIdx++) {
        // Get the 3 vertex indices for this triangle
        const v1Idx = indices[triIdx * 3];
        const v2Idx = indices[triIdx * 3 + 1];
        const v3Idx = indices[triIdx * 3 + 2];

        // Color all 3 vertices orange
        [v1Idx, v2Idx, v3Idx].forEach(vIdx => {
          colorArray[vIdx * 3] = highlightColor.r;
          colorArray[vIdx * 3 + 1] = highlightColor.g;
          colorArray[vIdx * 3 + 2] = highlightColor.b;
        });
      }
    }

    return colorArray;
  }, [vertex_colors, vertices.length, selectedFeature, indices]);

  // Update geometry colors when selection changes
  useEffect(() => {
    if (geometry && colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.attributes.color.needsUpdate = true;
    }
  }, [geometry, colors]);

  // Material that uses vertex colors
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.3,
      roughness: 0.7,
      side: THREE.DoubleSide,
      flatShading: false,
    });
  }, []);

  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry} 
      material={material}
      castShadow
      receiveShadow
    />
  );
};

export default MeshModel;
