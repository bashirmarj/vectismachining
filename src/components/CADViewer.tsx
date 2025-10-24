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
import { MeasurementTool } from "./cad-viewer/MeasurementTool"; // Keep as backup
import { OrientationCubePreview, OrientationCubeHandle } from "./cad-viewer/OrientationCubePreview";
import LightingRig from "./cad-viewer/LightingRig";
import VisualEffects from "./cad-viewer/VisualEffects";
import PerformanceSettingsPanel from "./cad-viewer/PerformanceSettingsPanel";
// ========== PHASE 2: NEW IMPORTS ==========
import { AdvancedMeasurementTool } from "./cad-viewer/AdvancedMeasurementTool";
import { MeasurementPanel } from "./cad-viewer/MeasurementPanel";
// ========== PHASE 2.5: UNIFIED TOOLBAR ==========
import { UnifiedCADToolbar } from "./cad-viewer/UnifiedCADToolbar";
// ==========================================

interface CADViewerProps {
  file?: File;
  fileUrl?: string;
  fileName: string;
  meshId?: string;
  meshData?: MeshData;
  detectedFeatures?: any;
  usePhase1Enhancement?: boolean;
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
  usePhase1Enhancement = false,
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
        console.log("🔍 Fetching mesh data for ID:", meshId);
        const { data, error: fetchError } = await supabase.from("cad_meshes").select("*").eq("id", meshId).single();

        if (fetchError) throw fetchError;
        if (!data) throw new Error("No mesh data found");

        console.log("✅ Mesh data loaded from database:", {
          vertices: data.vertices.length,
          triangles: data.triangle_count,
          hasFeatureEdges: !!data.feature_edges,
        });

        setFetchedMeshData(data as MeshData);
      } catch (err) {
        console.error("❌ Error fetching mesh:", err);
        setError(err instanceof Error ? err.message : "Failed to load mesh data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMesh();
  }, [meshId, propMeshData, fetchedMeshData]);

  const activeMeshData = propMeshData || fetchedMeshData;

  const boundingBox = useMemo(() => {
    if (!activeMeshData || !activeMeshData.vertices || activeMeshData.vertices.length === 0) {
      return {
        min: new THREE.Vector3(-10, -10, -10),
        max: new THREE.Vector3(10, 10, 10),
        center: new THREE.Vector3(0, 0, 0),
        width: 20,
        height: 20,
        depth: 20,
      };
    }

    const vertices = activeMeshData.vertices;
    let minX = Infinity,
      minY = Infinity,
      minZ = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity,
      maxZ = -Infinity;

    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      const z = vertices[i + 2];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }

    const min = new THREE.Vector3(minX, minY, minZ);
    const max = new THREE.Vector3(maxX, maxY, maxZ);
    const center = new THREE.Vector3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);

    return {
      min,
      max,
      center,
      width: maxX - minX,
      height: maxY - minY,
      depth: maxZ - minZ,
    };
  }, [activeMeshData]);

  const modelBounds = useMemo(
    () => ({
      min: boundingBox.min,
      max: boundingBox.max,
      size: new THREE.Vector3(boundingBox.width, boundingBox.height, boundingBox.depth),
    }),
    [boundingBox],
  );

  const initialCameraPosition: [number, number, number] = useMemo(() => {
    const distance = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 1.5;
    return [
      boundingBox.center.x + distance * 0.5,
      boundingBox.center.y + distance * 0.5,
      boundingBox.center.z + distance * 0.5,
    ];
  }, [boundingBox]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMeasurementMode(null);
        setShowDimensions(false);
      }
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handleFitToView();
      }
      if (e.key === "e" || e.key === "E") {
        setShowEdges(!showEdges);
      }
      if (e.key === "m" || e.key === "M") {
        setMeasurementMode(measurementMode === "distance" ? null : "distance");
      }
      if (e.key === "1") {
        setSectionPlane(sectionPlane === "xy" ? "none" : "xy");
      }
      if (e.key === "2") {
        setSectionPlane(sectionPlane === "xz" ? "none" : "xz");
      }
      if (e.key === "3") {
        setSectionPlane(sectionPlane === "yz" ? "none" : "yz");
      }
      if (e.key === "s" || e.key === "S") {
        setDisplayStyle((prev) => {
          if (prev === "solid") return "wireframe";
          if (prev === "wireframe") return "translucent";
          return "solid";
        });
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [showEdges, showHiddenEdges, showDimensions, measurementMode, sectionPlane, displayStyle]);

  const handleSetView = useCallback(
    (view: string) => {
      if (!controlsRef.current || !cameraRef.current) return;

      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const distance = Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 1.5;

      let newPosition: [number, number, number];

      switch (view) {
        case "front":
          newPosition = [boundingBox.center.x, boundingBox.center.y, boundingBox.center.z + distance];
          break;
        case "back":
          newPosition = [boundingBox.center.x, boundingBox.center.y, boundingBox.center.z - distance];
          break;
        case "top":
          newPosition = [boundingBox.center.x, boundingBox.center.y + distance, boundingBox.center.z];
          break;
        case "bottom":
          newPosition = [boundingBox.center.x, boundingBox.center.y - distance, boundingBox.center.z];
          break;
        case "left":
          newPosition = [boundingBox.center.x - distance, boundingBox.center.y, boundingBox.center.z];
          break;
        case "right":
          newPosition = [boundingBox.center.x + distance, boundingBox.center.y, boundingBox.center.z];
          break;
        case "isometric":
          newPosition = [
            boundingBox.center.x + distance * 0.5,
            boundingBox.center.y + distance * 0.5,
            boundingBox.center.z + distance * 0.5,
          ];
          break;
        default:
          return;
      }

      camera.position.set(...newPosition);
      controls.target.copy(boundingBox.center);
      controls.update();
    },
    [boundingBox],
  );

  const handleFitToView = useCallback(() => {
    if (!controlsRef.current || !cameraRef.current) return;
    handleSetView("isometric");
  }, [handleSetView]);

  const handleDownload = () => {
    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = fileName;
      link.click();
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full min-h-[600px] bg-muted/10 rounded-lg">
        <CardContent className="h-full">
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading 3D model...</p>
            </div>
          </div>
        </CardContent>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full min-h-[600px] bg-muted/10 rounded-lg">
        <CardContent className="h-full">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-destructive font-semibold mb-2">Error loading 3D model</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[600px] bg-background rounded-lg border relative">
      <CardContent className="h-full p-0 relative">
        {activeMeshData ? (
          <div className="relative w-full h-full">
            {/* ========== UNIFIED CAD TOOLBAR (NEW) ========== */}
            <UnifiedCADToolbar
              onHomeView={() => handleSetView("isometric")}
              onFrontView={() => handleSetView("front")}
              onTopView={() => handleSetView("top")}
              onIsometricView={() => handleSetView("isometric")}
              onFitView={handleFitToView}
              displayStyle={displayStyle}
              setDisplayStyle={setDisplayStyle}
              showEdges={showEdges}
              setShowEdges={setShowEdges}
              sectionPlane={sectionPlane}
              setSectionPlane={setSectionPlane}
              sectionPosition={sectionPosition}
              setSectionPosition={setSectionPosition}
              shadowsEnabled={shadowsEnabled}
              setShadowsEnabled={setShadowsEnabled}
              ssaoEnabled={ssaoEnabled}
              setSSAOEnabled={setSSAOEnabled}
              quality={quality}
              setQuality={setQuality}
            />
            {/* =============================================== */}

            {/* ========== ORIENTATION CUBE (PRESERVED) ========== */}
            <div className="absolute top-4 right-4 z-10">
              <OrientationCubePreview
                ref={orientationCubeRef}
                onOrientationChange={(direction) => {
                  // Handle orientation change if needed
                }}
              />
            </div>
            {/* ================================================= */}

            <Canvas
              shadows
              camera={{
                fov: 50,
                near: 0.1,
                far: Math.max(boundingBox.width, boundingBox.height, boundingBox.depth) * 10,
                position: initialCameraPosition,
              }}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
                toneMapping: THREE.ACESFilmicToneMapping,
                toneMappingExposure: 1.0,
                outputColorSpace: THREE.SRGBColorSpace,
              }}
              style={{ background: "linear-gradient(to bottom, #f5f7fa, #c3cfe2)" }}
            >
              <Suspense fallback={null}>
                {/* ========== LIGHTING RIG ========== */}
                <LightingRig shadowsEnabled={shadowsEnabled} modelBounds={modelBounds} />

                {/* 3D Model */}
                <MeshModel
                  ref={meshRef}
                  meshData={activeMeshData}
                  sectionPlane={sectionPlane}
                  sectionPosition={sectionPosition}
                  showEdges={showEdges}
                  showHiddenEdges={showHiddenEdges}
                  displayStyle={displayStyle}
                  topologyColors={showTopologyColors}
                />

                {/* Ground plane with shadows */}
                <ContactShadows
                  position={[0, boundingBox.min.y - 0.1, 0]}
                  opacity={0.3}
                  scale={Math.max(boundingBox.width, boundingBox.depth) * 2}
                  blur={2}
                  far={Math.max(boundingBox.height, boundingBox.depth) * 2}
                />

                {/* Dimension Annotations */}
                {showDimensions && (
                  <DimensionAnnotations
                    features={detectedFeatures}
                    boundingBox={{
                      width: boundingBox.width,
                      height: boundingBox.height,
                      depth: boundingBox.depth,
                    }}
                  />
                )}

                {/* ========== PHASE 2: ADVANCED MEASUREMENT TOOL ========== */}
                <AdvancedMeasurementTool
                  meshData={activeMeshData}
                  meshRef={meshRef}
                  enabled={measurementMode !== null}
                />

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

            {/* ========== PHASE 2: MEASUREMENT PANEL (PRESERVED) ========== */}
            <MeasurementPanel />
            {/* ============================================================ */}

            {/* ========== PERFORMANCE SETTINGS PANEL (PRESERVED) ========== */}
            <PerformanceSettingsPanel
              shadowsEnabled={shadowsEnabled}
              setShadowsEnabled={setShadowsEnabled}
              ssaoEnabled={ssaoEnabled}
              setSSAOEnabled={setSSAOEnabled}
              quality={quality}
              setQuality={setQuality}
              triangleCount={activeMeshData.triangle_count}
            />
            {/* ============================================================ */}
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
