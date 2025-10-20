import React, { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Grid } from '@react-three/drei';
import MeshModel from './cad-viewer/MeshModel';  // ⭐ FIXED: Correct path
import FeatureTree from './FeatureTree';
import { useCameraAnimation } from '../hooks/useCameraAnimation';  // ⭐ FIXED: Correct path

interface SelectedFeature {
  type: 'through_hole' | 'blind_hole' | 'bore' | 'boss' | 'fillet';
  index: number;
  triangleStart: number;
  triangleEnd: number;
  center: [number, number, number];
  diameter?: number;
  label: string;
}

interface CADViewerProps {
  meshData?: {
    vertices: number[];
    indices: number[];
    normals: number[];
    vertex_colors?: string[];
  };
  manufacturing_features?: any;
  feature_summary?: any;
}

// ⭐ Inner component that has access to Three.js context
const Scene: React.FC<{
  meshData: any;
  selectedFeature: SelectedFeature | null;
}> = ({ meshData, selectedFeature }) => {
  const controlsRef = useRef<any>(null);

  // ⭐ Use camera animation hook
  useCameraAnimation(
    selectedFeature ? {
      center: selectedFeature.center,
      diameter: selectedFeature.diameter || 10,
      duration: 800
    } : null,
    controlsRef.current
  );

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={1} 
        castShadow 
      />
      <directionalLight 
        position={[-10, -10, -5]} 
        intensity={0.5} 
      />

      {/* 3D Model with highlighting */}
      <MeshModel
        vertices={meshData.vertices}
        indices={meshData.indices}
        normals={meshData.normals}
        vertex_colors={meshData.vertex_colors}
        selectedFeature={selectedFeature} // ⭐ Pass selected feature
      />

      {/* Controls */}
      <OrbitControls 
        ref={controlsRef}
        enableDamping
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={1000}
      />

      {/* Environment */}
      <Environment preset="city" />
      <Grid 
        args={[200, 200]} 
        cellColor="#6b7280" 
        sectionColor="#3b82f6" 
        fadeDistance={400}
        fadeStrength={1}
        position={[0, -50, 0]}
      />
    </>
  );
};

const CADViewer: React.FC<CADViewerProps> = ({ 
  meshData, 
  manufacturing_features, 
  feature_summary 
}) => {
  // ⭐ State for selected feature
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);

  if (!meshData || !meshData.vertices || meshData.vertices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-muted">
        <p className="text-muted-foreground">No mesh data available</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Left Panel - Feature Tree */}
      <div className="w-80 overflow-y-auto">
        <FeatureTree
          manufacturing_features={manufacturing_features}
          feature_summary={feature_summary}
          onFeatureSelect={setSelectedFeature} // ⭐ Handle feature selection
        />
      </div>

      {/* Right Panel - 3D Viewer */}
      <div className="flex-1 relative">
        {/* Selected Feature Badge */}
        {selectedFeature && (
          <div className="absolute top-4 left-4 z-10 bg-orange-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <span className="font-medium">{selectedFeature.label}</span>
            <button
              onClick={() => setSelectedFeature(null)}
              className="ml-2 hover:bg-orange-600 rounded px-2 py-1 transition-colors"
            >
              ✕
            </button>
          </div>
        )}

        <Canvas
          camera={{ position: [100, 100, 100], fov: 50 }}
          shadows
          className="bg-gradient-to-b from-gray-900 to-gray-800"
        >
          <Scene 
            meshData={meshData} 
            selectedFeature={selectedFeature}
          />
        </Canvas>
      </div>
    </div>
  );
};

export default CADViewer;
