import * as THREE from 'three';

interface EnhancedMeshMaterialProps {
  color?: string;
  wireframe?: boolean;
}

const EnhancedMeshMaterial = ({ 
  color = '#5b9bd5', 
  wireframe = false 
}: EnhancedMeshMaterialProps) => {
  if (wireframe) {
    return (
      <meshBasicMaterial
        color="#C8D0D8"
        wireframe
      />
    );
  }

  return (
    <meshStandardMaterial
      color={color}
      metalness={0}
      roughness={0.8}
      envMapIntensity={0}
      vertexColors={false}
      side={THREE.DoubleSide}
      flatShading={false}
      toneMapped={false}
    />
  );
};

export default EnhancedMeshMaterial;
