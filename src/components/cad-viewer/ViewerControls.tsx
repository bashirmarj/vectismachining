import { useEffect } from 'react';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface ViewerControlsProps {
  enableRotate?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  showEdges?: boolean;
  showHiddenEdges?: boolean;
  displayStyle?: 'solid' | 'wireframe' | 'translucent';
  setShowEdges?: (val: boolean) => void;
  setShowHiddenEdges?: (val: boolean) => void;
  setDisplayStyle?: (val: 'solid' | 'wireframe' | 'translucent') => void;
}

export function ViewerControls({
  enableRotate = true,
  enableZoom = true,
  enablePan = true,
  showEdges,
  showHiddenEdges,
  displayStyle,
  setShowEdges,
  setShowHiddenEdges,
  setDisplayStyle
}: ViewerControlsProps) {
  useEffect(() => {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = false;
    renderer.setPixelRatio(window.devicePixelRatio);
  }, []);

  return (
    <>
      {/* Orbit Controls */}
      <OrbitControls
        makeDefault
        enableRotate={enableRotate}
        enableZoom={enableZoom}
        enablePan={enablePan}
        rotateSpeed={0.8}
        zoomSpeed={0.9}
        panSpeed={0.6}
        dampingFactor={0.15}
        enableDamping
      />

      {/* Edge/Display toggles UI (if connected to parent panel) */}
      {setShowEdges && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            background: 'rgba(40,40,40,0.7)',
            borderRadius: 8,
            padding: '6px 8px',
            color: '#fff',
            fontSize: 13,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}
        >
          <button
            style={{
              background: showEdges ? '#4caf50' : '#555',
              border: 'none',
              borderRadius: 4,
              padding: '4px 6px',
              color: '#fff',
              cursor: 'pointer'
            }}
            onClick={() => setShowEdges(!showEdges)}
          >
            {showEdges ? 'Hide Edges' : 'Show Edges'}
          </button>

          {showEdges && setShowHiddenEdges && (
            <button
              style={{
                background: showHiddenEdges ? '#ff9800' : '#555',
                border: 'none',
                borderRadius: 4,
                padding: '4px 6px',
                color: '#fff',
                cursor: 'pointer'
              }}
              onClick={() => setShowHiddenEdges(!showHiddenEdges)}
            >
              {showHiddenEdges ? 'Hide Hidden Edges' : 'Show Hidden Edges'}
            </button>
          )}

          {setDisplayStyle && (
            <button
              style={{
                background:
                  displayStyle === 'solid'
                    ? '#2196f3'
                    : displayStyle === 'wireframe'
                    ? '#9c27b0'
                    : '#607d8b',
                border: 'none',
                borderRadius: 4,
                padding: '4px 6px',
                color: '#fff',
                cursor: 'pointer'
              }}
              onClick={() =>
                setDisplayStyle(
                  displayStyle === 'solid'
                    ? 'wireframe'
                    : displayStyle === 'wireframe'
                    ? 'translucent'
                    : 'solid'
                )
              }
            >
              Mode: {displayStyle}
            </button>
          )}
        </div>
      )}
    </>
  );
}
