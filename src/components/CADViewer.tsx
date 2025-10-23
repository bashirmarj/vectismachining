import { Canvas } from "@react-three/fiber";
import { TrackballControls, PerspectiveCamera, ContactShadows, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { Suspense, useMemo, useEffect, useState, useRef, useCallback } from "react";
import { CardContent } from "@/components/ui/card";
import { Loader2, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { MeshModel } from "./cad-viewer/MeshModel";
import { DimensionAnnotations } from "./cad-viewer/DimensionAnnotations";
import { MeasurementTool } from "./cad-viewer/MeasurementTool";
import { OrientationCubePreview, OrientationCubeHandle } from "./cad-viewer/OrientationCubePreview";
import LightingRig from "./cad-viewer/LightingRig";
import VisualEffects from "./cad-viewer/VisualEffects";
import PerformanceSettingsPanel from "./cad-viewer/PerformanceSettingsPanel";
// Phase 1 Enhancement (Optional) - Only import if you created the enhancements folder
// import { SceneEnhancementWrapper } from "./cad-viewer/enhancements/SceneEnhancementWrapper";

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName: string;
  meshId?: string;
  meshData?: MeshData;
  detectedFeatures?: any;
  usePhase1Enhancement?: boolean; // NEW: Toggle Phase 1 enhancements (requires enhancements folder)
}

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  face_types?: string[];
  triangle_count: number;
  feature_edges?: number[][][];
}

export function CADViewer({
  file,
  fileUrl,
  fileName,
  meshId,
  meshData: propMeshData,
  detectedFeatures,
  usePhase1Enhancement = false, // NEW: Default to false (use existing LightingRig/VisualEffects)
}: CADViewerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedMeshData, setFetchedMeshData] = useState<MeshData | null>(null);

  // Professional viewer controls
  const [sectionPlane, setSectionPlane] = useState<"none" | "xy" | "xz" | "yz">("none");
  const [sectionPosition, setSectionPosition] = useState(0);
  const [showEdges, setShowEdges] = useState(true);
  const [showHiddenEdges, setShowHiddenEdges] = useState(false);
  const [showDimensions, setShowDimensions] = useState(false);
  const [measurementMode, setMeasurementMode] = useState<"distance" | "angle" | "radius" | null>(null);
  const [displayStyle, setDisplayStyle] = useState<"solid" | "wireframe" | "translucent">("solid");
  const showTopologyColors = true; // Always use Fusion 360 topology colors
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const orientationCubeRef = useRef<OrientationCubeHandle>(null);

  // Mesh ref for model access
  const meshRef = useRef<THREE.Mesh>(null);

  // Performance settings for professional visual quality
  const [shadowsEnabled, setShadowsEnabled] = useState(true);
  const [ssaoEnabled, setSSAOEnabled] = useState(true);
  const [quality, setQuality] = useState<"low" | "medium" | "high">("medium");

  const fileExtension = fileName.split(".").pop()?.toLowerCase() || "";
  const isSTEP = ["step", "stp"].includes(fileExtension);
  const isIGES = ["iges", "igs"].includes(fileExtension);
  const isRenderableFormat = ["stl", "step", "stp", "iges", "igs"].includes(fileExtension);

  // Fetch mesh data from database when meshId is provided
  useEffect(() => {
    if (propMeshData) {
      console.log("✅ Mesh data received from backend:", {
        vertices: propMeshData.vertices.length,
        triangles: propMeshData.triangle_count,
        hasFeatureEdges: !!propMeshData.feature_edges,
      });
      setFetchedMeshData(propMeshData);
      return;
    }

    if (!meshId) {
      console.log("⚠️ No mesh data available (no propMeshData or meshId)");
      return;
    }

    if (fetchedMeshData) return;

    const fetchMesh = async () => {
      setIsLoading(true);
      try {
        console.log(`📥 Fetching mesh from database: ${meshId}`);
        const { data, error } = await supabase
          .from("cad_meshes")
          .select("vertices, indices, normals, face_types, triangle_count, feature_edges")
          .eq("id", meshId)
          .single();

        if (error) throw error;
        if (data) {
          console.log("✅ Mesh data fetched from database:", {
            vertices: data.vertices.length,
            triangles: data.triangle_count,
          });
          setFetchedMeshData(data as MeshData);
        }
      } catch (err: any) {
        console.error("❌ Error fetching mesh:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMesh();
  }, [meshId, propMeshData, fetchedMeshData]);

  const activeMeshData = propMeshData || fetchedMeshData;

  // Calculate bounding box for camera and annotations
  const boundingBox = useMemo(() => {
    if (!activeMeshData || !activeMeshData.vertices || activeMeshData.vertices.length === 0) {
      return {
        width: 100,
        height: 100,
        depth: 100,
        center: [0, 0, 0] as [number, number, number],
        min: new THREE.Vector3(-50, -50, -50),
        max: new THREE.Vector3(50, 50, 50),
        size: new THREE.Vector3(100, 100, 100),
      };
    }

    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < activeMeshData.vertices.length; i += 3) {
      minX = Math.min(minX, activeMeshData.vertices[i]);
      maxX = Math.max(maxX, activeMeshData.vertices[i]);
      minY = Math.min(minY, activeMeshData.vertices[i + 1]);
      maxY = Math.max(maxY, activeMeshData.vertices[i + 1]);
      minZ = Math.min(minZ, activeMeshData.vertices[i + 2]);
      maxZ = Math.max(maxZ, activeMeshData.vertices[i + 2]);
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const depth = maxZ - minZ;
    const centerTuple: [number, number, number] = [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2];
    const min = new THREE.Vector3(minX, minY, minZ);
    const max = new THREE.Vector3(maxX, maxY, maxZ);
    const center = new THREE.Vector3(...centerTuple);
    const size = new THREE.Vector3(width, height, depth);

    return { width, height, depth, center: centerTuple, min, max, size, centerVec: center };
  }, [activeMeshData]);

  const hasValidModel = activeMeshData && activeMeshData.vertices && activeMeshData.vertices.length > 0;

  const objectUrl = useMemo(() => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return fileUrl;
  }, [file, fileUrl]);

  useEffect(() => {
    return () => {
      if (file && objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file, objectUrl]);

  const handleDownload = () => {
    if (objectUrl) {
      window.open(objectUrl, "_blank");
    }
  };

  const handleFitView = () => {
    if (!controlsRef.current || !cameraRef.current) return;

    const maxDimension = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const distance = maxDimension * 2.5;
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    const newPosition = new THREE.Vector3(...boundingBox.center).add(direction.multiplyScalar(distance));

    cameraRef.current.position.copy(newPosition);
    controlsRef.current.target.set(...boundingBox.center);
    controlsRef.current.update();
  };

  const setIsometricView = useCallback(() => {
    if (!controlsRef.current || !cameraRef.current) return;

    const maxDimension = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
    const distance = maxDimension * 1.8;
    const direction = new THREE.Vector3(1, 1, 1).normalize();
    const newPosition = new THREE.Vector3(...boundingBox.center).add(direction.multiplyScalar(distance));

    cameraRef.current.position.copy(newPosition);
    cameraRef.current.up.set(0, 0, 1);
    controlsRef.current.target.set(...boundingBox.center);
    controlsRef.current.update();

    if (orientationCubeRef.current) {
      orientationCubeRef.current.updateFromCamera(cameraRef.current);
    }
  }, [boundingBox]);

  const orientMainCameraToDirection = useCallback(
    (direction: THREE.Vector3) => {
      if (!cameraRef.current || !controlsRef.current) return;

      const maxDimension = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth);
      const distance = maxDimension * 1.8;
      const newPosition = new THREE.Vector3(...boundingBox.center).add(direction.clone().multiplyScalar(distance));

      cameraRef.current.position.copy(newPosition);
      controlsRef.current.target.set(...boundingBox.center);
      controlsRef.current.update();
    },
    [boundingBox],
  );

  const handleCubeUpVectorChange = useCallback((newUp: THREE.Vector3) => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.up.copy(newUp);
    cameraRef.current.updateProjectionMatrix();
    controlsRef.current.update();
  }, []);

  useEffect(() => {
    if (controlsRef.current && orientationCubeRef.current) {
      const controls = controlsRef.current;
      const handleChange = () => {
        if (cameraRef.current && orientationCubeRef.current) {
          orientationCubeRef.current.updateFromCamera(cameraRef.current);
        }
      };
      controls.addEventListener("change", handleChange);
      return () => controls.removeEventListener("change", handleChange);
    }
  }, []);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === "KeyE" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setShowEdges((prev) => !prev);
      } else if (e.code === "KeyM" && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        setMeasurementMode((prev) => (prev === null ? "distance" : null));
      } else if (e.code === "Escape") {
        e.preventDefault();
        setMeasurementMode(null);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [showEdges, measurementMode]);

  return (
    <div className="h-full bg-white rounded-lg overflow-hidden">
      <CardContent className="h-full p-0">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {isSTEP || isIGES
                ? `Processing ${fileExtension.toUpperCase()} geometry on server...`
                : "Loading 3D model..."}
            </p>
            <p className="text-xs text-muted-foreground">
              {isSTEP || isIGES ? "This may take 5-10 seconds for complex parts" : "This may take a few seconds"}
            </p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-destructive" />
            <p className="text-sm text-destructive text-center">Failed to load 3D preview</p>
            <p className="text-xs text-muted-foreground text-center max-w-md">{error}</p>
            <Button variant="outline" onClick={handleDownload}>
              Download File
            </Button>
          </div>
        ) : hasValidModel ? (
          <div className="relative h-full" style={{ background: "#f8f9fa" }}>
            {/* Isometric Reset Button - Top Left */}
            <button
              onClick={setIsometricView}
              className="absolute top-5 left-5 z-30 p-2 hover:bg-gray-100 rounded-lg transition-all"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(0, 0, 0, 0.1)",
              }}
              title="Isometric View"
            >
              <Box className="w-4 h-4 text-gray-700 hover:text-gray-900" />
            </button>

            {/* Orientation Cube - Top Right */}
            <div className="absolute top-5 right-5 z-30">
              <OrientationCubePreview
                ref={orientationCubeRef}
                onOrientationChange={orientMainCameraToDirection}
                onUpVectorChange={handleCubeUpVectorChange}
                onDisplayStyleChange={setDisplayStyle}
              />
            </div>

            {/* Vectis Manufacturing Watermark */}
            <div className="absolute bottom-4 left-4 z-10 text-xs text-black/30 font-medium">
              Vectis Manufacturing | Automating Precision
            </div>

            <Canvas
              shadows
              camera={{ position: [150, 150, 150], fov: 45 }}
              gl={{
                antialias: true,
                alpha: false,
                preserveDrawingBuffer: true,
                powerPreference: "high-performance",
                localClippingEnabled: true,
                toneMapping: THREE.NoToneMapping,
                sortObjects: true,
              }}
              onCreated={({ gl }) => {
                gl.shadowMap.enabled = shadowsEnabled;
                gl.shadowMap.type = THREE.PCFSoftShadowMap;
              }}
              dpr={[1, 2]}
            >
              <Suspense fallback={null}>
                {/* Clean white background */}
                <color attach="background" args={["#f8f9fa"]} />
                <fog
                  attach="fog"
                  args={[
                    "#f8f9fa",
                    Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 10,
                    Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 20,
                  ]}
                />

                {/* Professional 5-light PBR setup with shadows */}
                <LightingRig
                  shadowsEnabled={shadowsEnabled}
                  intensity={1.0}
                  modelBounds={{
                    min: boundingBox.min,
                    max: boundingBox.max,
                    center: boundingBox.centerVec,
                    size: boundingBox.size,
                  }}
                />

                {/* Subtle grid (light gray) */}
                <gridHelper
                  args={[
                    Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 4,
                    20,
                    "#e0e0e0",
                    "#f0f0f0",
                  ]}
                  position={[boundingBox.center[0], boundingBox.min.y - 0.01, boundingBox.center[2]]}
                />

                {/* Auto-framed camera */}
                <PerspectiveCamera
                  ref={cameraRef}
                  makeDefault
                  position={[
                    boundingBox.center[0] + boundingBox.width * 1.5,
                    boundingBox.center[1] + boundingBox.height * 1.5,
                    boundingBox.center[2] + boundingBox.depth * 1.5,
                  ]}
                  fov={45}
                  near={Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 0.01}
                  far={Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 15}
                />

                {/* 3D Model */}
                <MeshModel
                  ref={meshRef}
                  meshData={activeMeshData!}
                  sectionPlane={sectionPlane}
                  sectionPosition={sectionPosition}
                  showEdges={showEdges}
                  showHiddenEdges={showHiddenEdges}
                  displayStyle={displayStyle}
                  topologyColors={showTopologyColors}
                />

                {/* Dimension Annotations */}
                {showDimensions && detectedFeatures && (
                  <DimensionAnnotations features={detectedFeatures} boundingBox={boundingBox} />
                )}

                {/* Measurement Tool */}
                <MeasurementTool enabled={measurementMode !== null} mode={measurementMode} />

                {/* Visual effects (SSAO, Bloom, FXAA, Environment) */}
                <VisualEffects enabled={ssaoEnabled} quality={quality} />

                {/* Camera controls with trackball rotation for CAD-style interaction */}
                <TrackballControls
                  ref={controlsRef}
                  makeDefault
                  target={boundingBox.center}
                  dynamicDampingFactor={0.2}
                  minDistance={Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 0.01}
                  maxDistance={Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 5}
                  rotateSpeed={1.8}
                  panSpeed={0.8}
                  zoomSpeed={1.2}
                  staticMoving={false}
                  noPan={false}
                  noRotate={false}
                />
              </Suspense>

              {/* XYZ Axis Gizmo - Bottom Right */}
              <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                <GizmoViewport
                  axisColors={["#ff0000", "#00ff00", "#0000ff"]}
                  labelColor="white"
                  labels={["X", "Y", "Z"]}
                />
              </GizmoHelper>
            </Canvas>

            {/* Performance Settings Panel */}
            <PerformanceSettingsPanel
              shadowsEnabled={shadowsEnabled}
              setShadowsEnabled={setShadowsEnabled}
              ssaoEnabled={ssaoEnabled}
              setSSAOEnabled={setSSAOEnabled}
              quality={quality}
              setQuality={setQuality}
              triangleCount={activeMeshData.triangle_count}
            />
          </div>
        ) : isRenderableFormat ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">Upload a file to view 3D preview</p>
            <p className="text-xs text-muted-foreground text-center max-w-md">Supports STEP, IGES, and STL formats</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Box className="h-16 w-16 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              3D preview not available for {fileExtension.toUpperCase()} files
            </p>
            <Button variant="outline" onClick={handleDownload}>
              Download File
            </Button>
          </div>
        )}
      </CardContent>
    </div>
  );
}
