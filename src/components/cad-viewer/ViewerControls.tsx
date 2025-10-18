import { OrbitControls } from '@react-three/drei';

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
  return (
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
  );
}
