import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { Button } from "@/components/ui/button";
import { Box, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RotateCw, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import orientationCubeSTL from "@/assets/orientation-cube.stl?url";

interface OrientationCubePreviewProps {
  onCubeClick?: (direction: THREE.Vector3) => void;
  onOrientationChange?: (direction: THREE.Vector3) => void;
  onUpVectorChange?: (upVector: THREE.Vector3) => void;
  displayMode?: "solid" | "wireframe" | "translucent";
  onDisplayModeChange?: (style: "solid" | "wireframe" | "translucent") => void;
}

export interface OrientationCubeHandle {
  rotateCube: (direction: THREE.Vector3) => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;
}

export const OrientationCubePreview = forwardRef<OrientationCubeHandle, OrientationCubePreviewProps>(
  (
    { onCubeClick, onOrientationChange, onUpVectorChange, displayMode: externalDisplayMode, onDisplayModeChange },
    ref,
  ) => {
    const cubeContainerRef = useRef<HTMLDivElement>(null);
    const [cubeScene] = useState(() => new THREE.Scene());
    const [cubeCamera] = useState(() => new THREE.PerspectiveCamera(50, 1, 0.1, 1000));
    const [cubeRenderer] = useState(
      () =>
        new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
        }),
    );
    const cubeRef = useRef<THREE.Mesh | null>(null);
    const animationFrameRef = useRef<number>();
    const [hoveredRegion, setHoveredRegion] = useState<{
      type: "face" | "edge" | "corner";
      description: string;
    } | null>(null);
    const [displayStyle, setDisplayStyle] = useState<"solid" | "wireframe" | "translucent">(
      externalDisplayMode || "solid",
    );

    // Update internal state when external prop changes
    useEffect(() => {
      if (externalDisplayMode) {
        setDisplayStyle(externalDisplayMode);
      }
    }, [externalDisplayMode]);

    // Helper function to classify click region (face, edge, or corner)
    const classifyClickRegion = (localPoint: THREE.Vector3) => {
      const faceDistance = 1.0; // Half the cube size (2/2)
      const edgeThreshold = 0.25; // Adjusted for beveled edges
      const cornerThreshold = 0.5;

      const absX = Math.abs(localPoint.x);
      const absY = Math.abs(localPoint.y);
      const absZ = Math.abs(localPoint.z);

      const nearMaxX = absX > faceDistance - edgeThreshold;
      const nearMaxY = absY > faceDistance - edgeThreshold;
      const nearMaxZ = absZ > faceDistance - edgeThreshold;

      const edgeCount = [nearMaxX, nearMaxY, nearMaxZ].filter(Boolean).length;

      // CORNER: All 3 dimensions near maximum
      if (edgeCount === 3) {
        const direction = new THREE.Vector3(
          Math.sign(localPoint.x),
          Math.sign(localPoint.y),
          Math.sign(localPoint.z),
        ).normalize();

        return {
          type: "corner" as const,
          direction,
          description: `Corner (${Math.sign(localPoint.x) > 0 ? "+" : "-"}X, ${Math.sign(localPoint.y) > 0 ? "+" : "-"}Y, ${Math.sign(localPoint.z) > 0 ? "+" : "-"}Z)`,
        };
      }

      // EDGE: Exactly 2 dimensions near maximum
      else if (edgeCount === 2) {
        const direction = new THREE.Vector3(
          nearMaxX ? Math.sign(localPoint.x) : 0,
          nearMaxY ? Math.sign(localPoint.y) : 0,
          nearMaxZ ? Math.sign(localPoint.z) : 0,
        ).normalize();

        return {
          type: "edge" as const,
          direction,
          description: "Edge view",
        };
      }

      // FACE: Only 1 dimension near maximum
      else {
        if (absX > absY && absX > absZ) {
          return {
            type: "face" as const,
            direction: new THREE.Vector3(Math.sign(localPoint.x), 0, 0),
            description: Math.sign(localPoint.x) > 0 ? "Right" : "Left",
          };
        } else if (absY > absX && absY > absZ) {
          return {
            type: "face" as const,
            direction: new THREE.Vector3(0, Math.sign(localPoint.y), 0),
            description: Math.sign(localPoint.y) > 0 ? "Top" : "Bottom",
          };
        } else {
          return {
            type: "face" as const,
            direction: new THREE.Vector3(0, 0, Math.sign(localPoint.z)),
            description: Math.sign(localPoint.z) > 0 ? "Front" : "Back",
          };
        }
      }
    };

    useEffect(() => {
      if (!cubeContainerRef.current) return;

      // Setup renderer
      cubeRenderer.setSize(110, 110);
      cubeRenderer.setClearColor(0x000000, 0); // Transparent background
      cubeContainerRef.current.appendChild(cubeRenderer.domElement);

      // Setup scene
      cubeScene.background = null; // No background

      // Load chamfered cube from STL
      const loader = new STLLoader();
      loader.load(orientationCubeSTL, (geometry) => {
        // Center the geometry at origin for proper rotation
        geometry.computeBoundingBox();
        geometry.center();

        const material = new THREE.MeshBasicMaterial({
          color: 0x4a5568, // Medium-dark gray for contrast on light background
          transparent: false,
          opacity: 1,
        });
        const cube = new THREE.Mesh(geometry, material);
        cubeRef.current = cube;

        // Add subtle edges
        const edges = new THREE.EdgesGeometry(geometry, 30);
        const lineMaterial = new THREE.LineBasicMaterial({
          color: 0x1f2937, // Very dark gray for strong contrast
          linewidth: 1,
          transparent: true,
          opacity: 0.6, // More visible edges
        });
        const line = new THREE.LineSegments(edges, lineMaterial);
        cube.add(line);

        // Add blue highlight edges (initially hidden)
        const highlightEdges = new THREE.EdgesGeometry(geometry, 30);
        const highlightLineMaterial = new THREE.LineBasicMaterial({
          color: 0x2563eb, // Darker blue for better visibility
          linewidth: 2,
          transparent: true,
          opacity: 0, // Initially invisible
        });
        const highlightLine = new THREE.LineSegments(highlightEdges, highlightLineMaterial);
        cube.add(highlightLine);

        cubeScene.add(cube);

        // No lighting needed for MeshBasicMaterial (unlit material)

        // Add face labels using Planes instead of Sprites (fixed to face orientation)
        const faces = [
          { text: "Front", position: [0, 0, 1], rotation: [0, 0, 0] },
          { text: "Back", position: [0, 0, -1], rotation: [0, Math.PI, 0] },
          { text: "Right", position: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
          { text: "Left", position: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
          { text: "Top", position: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
          { text: "Bottom", position: [0, -1, 0], rotation: [Math.PI / 2, 0, Math.PI] },
        ];

        // Calculate label distance based on actual cube size
        const box = new THREE.Box3().setFromObject(cube);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const labelDistance = maxDim / 2 + 0.05; // Slightly beyond surface

        faces.forEach((face) => {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;
          canvas.width = 512;
          canvas.height = 512;

          // Black text with light shadow for better readability on gray cube
          context.shadowColor = "rgba(255, 255, 255, 0.8)";
          context.shadowBlur = 8;
          context.shadowOffsetX = 2;
          context.shadowOffsetY = 2;

          context.fillStyle = "#000000";
          context.font = "bold 80px Arial";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(face.text, 256, 256);

          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;

          // Use PlaneGeometry instead of Sprite to fix orientation to face
          const planeGeometry = new THREE.PlaneGeometry(0.8, 0.8);
          const planeMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          });

          const label = new THREE.Mesh(planeGeometry, planeMaterial);
          label.position.set(
            face.position[0] * labelDistance,
            face.position[1] * labelDistance,
            face.position[2] * labelDistance,
          );
          label.rotation.set(face.rotation[0], face.rotation[1], face.rotation[2]);

          cube.add(label);
        });

        // Setup camera
        cubeCamera.position.set(5, 5, 5);
        cubeCamera.lookAt(0, 0, 0);

        // Animation loop
        const animate = () => {
          animationFrameRef.current = requestAnimationFrame(animate);
          cubeRenderer.render(cubeScene, cubeCamera);
        };
        animate();

        // ✅ FIXED: Type-safe click handling with proper type narrowing
        const handleClick = (event: MouseEvent) => {
          if (!cubeRef.current) return;

          const rect = cubeRenderer.domElement.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(x, y), cubeCamera);

          const intersects = raycaster.intersectObject(cubeRef.current, true);

          if (intersects.length > 0) {
            const localPoint = cubeRef.current.worldToLocal(intersects[0].point.clone());
            const region = classifyClickRegion(localPoint);

            if (onCubeClick) {
              onCubeClick(region.direction);
            }
          }
        };

        // ✅ FIXED: Type-safe hover handling
        const handleMouseMove = (event: MouseEvent) => {
          if (!cubeRef.current) return;

          const rect = cubeRenderer.domElement.getBoundingClientRect();
          const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

          const raycaster = new THREE.Raycaster();
          raycaster.setFromCamera(new THREE.Vector2(x, y), cubeCamera);

          const intersects = raycaster.intersectObject(cubeRef.current, true);

          if (intersects.length > 0) {
            const localPoint = cubeRef.current.worldToLocal(intersects[0].point.clone());
            const region = classifyClickRegion(localPoint);
            setHoveredRegion({ type: region.type, description: region.description });

            // ✅ FIXED: Proper type checking before accessing material properties
            cubeRef.current.children.forEach((child) => {
              if (child instanceof THREE.LineSegments) {
                const material = child.material;
                // Type guard to ensure we can access opacity
                if (material instanceof THREE.LineBasicMaterial) {
                  if (child === cubeRef.current?.children[1]) {
                    // Highlight line (second child)
                    material.opacity = 0.8;
                    material.needsUpdate = true;
                  }
                }
              }
            });

            cubeRenderer.domElement.style.cursor = "pointer";
          } else {
            setHoveredRegion(null);

            // ✅ FIXED: Reset highlight with proper type checking
            if (cubeRef.current) {
              cubeRef.current.children.forEach((child) => {
                if (child instanceof THREE.LineSegments) {
                  const material = child.material;
                  if (material instanceof THREE.LineBasicMaterial) {
                    if (child === cubeRef.current?.children[1]) {
                      material.opacity = 0;
                      material.needsUpdate = true;
                    }
                  }
                }
              });
            }

            cubeRenderer.domElement.style.cursor = "default";
          }
        };

        cubeRenderer.domElement.addEventListener("click", handleClick);
        cubeRenderer.domElement.addEventListener("mousemove", handleMouseMove);

        return () => {
          cubeRenderer.domElement.removeEventListener("click", handleClick);
          cubeRenderer.domElement.removeEventListener("mousemove", handleMouseMove);
        };
      });

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        cubeRenderer.dispose();
      };
    }, [cubeScene, cubeCamera, cubeRenderer, onCubeClick]);

    // Imperative methods for parent component
    useImperativeHandle(ref, () => ({
      rotateCube: (direction: THREE.Vector3) => {
        if (!cubeRef.current) return;
        const distance = 5;
        cubeCamera.position.copy(direction.clone().multiplyScalar(distance));
        cubeCamera.lookAt(0, 0, 0);
      },
      rotateClockwise: () => {
        rotateCameraClockwise();
      },
      rotateCounterClockwise: () => {
        rotateCameraCounterClockwise();
      },
    }));

    const rotateCameraClockwise = () => {
      const currentPos = cubeCamera.position.clone().normalize();
      const currentUp = cubeCamera.up.clone();

      // Rotate up vector 90 degrees clockwise around view direction
      const axis = currentPos;
      const angle = -Math.PI / 2; // Clockwise

      const newUp = currentUp.clone().applyAxisAngle(axis, angle);
      cubeCamera.up.copy(newUp);
      cubeCamera.lookAt(0, 0, 0);
      cubeCamera.updateProjectionMatrix();

      if (onUpVectorChange) {
        onUpVectorChange(newUp);
      }
    };

    const rotateCameraCounterClockwise = () => {
      const currentPos = cubeCamera.position.clone().normalize();
      const currentUp = cubeCamera.up.clone();

      // Rotate up vector 90 degrees counter-clockwise around view direction
      const axis = currentPos;
      const angle = Math.PI / 2; // Counter-clockwise

      const newUp = currentUp.clone().applyAxisAngle(axis, angle);
      cubeCamera.up.copy(newUp);
      cubeCamera.lookAt(0, 0, 0);
      cubeCamera.updateProjectionMatrix();

      if (onUpVectorChange) {
        onUpVectorChange(newUp);
      }
    };

    const rotateCameraUp = () => {
      const currentPos = cubeCamera.position.clone().normalize();
      const distance = 5;

      // Top (0,1,0) → Front (0,0,1) → Bottom (0,-1,0) → Back (0,0,-1) → Top
      const faces = [
        new THREE.Vector3(0, 1, 0), // Top
        new THREE.Vector3(0, 0, 1), // Front
        new THREE.Vector3(0, -1, 0), // Bottom
        new THREE.Vector3(0, 0, -1), // Back
      ];

      // Find closest face
      let closestIndex = 0;
      let maxDot = -Infinity;

      faces.forEach((face, index) => {
        const dot = currentPos.dot(face);
        if (dot > maxDot) {
          maxDot = dot;
          closestIndex = index;
        }
      });

      // Move to next face in cycle
      const nextIndex = (closestIndex + 1) % faces.length;
      const nextFace = faces[nextIndex];

      cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));

      // Handle up vector for top/bottom views
      const up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(nextFace.y) > 0.99) {
        up.set(0, 0, nextFace.y > 0 ? 1 : -1);
      }
      cubeCamera.up.copy(up);
      cubeCamera.lookAt(0, 0, 0);
      cubeCamera.updateProjectionMatrix();

      // Notify parent of rotation
      if (onOrientationChange) {
        const newDirection = cubeCamera.position.clone().normalize();
        onOrientationChange(newDirection);
      }
    };

    const rotateCameraDown = () => {
      const currentPos = cubeCamera.position.clone().normalize();
      const distance = 5;

      // Top (0,1,0) → Back (0,0,-1) → Bottom (0,-1,0) → Front (0,0,1) → Top
      const faces = [
        new THREE.Vector3(0, 1, 0), // Top
        new THREE.Vector3(0, 0, -1), // Back
        new THREE.Vector3(0, -1, 0), // Bottom
        new THREE.Vector3(0, 0, 1), // Front
      ];

      // Find closest face
      let closestIndex = 0;
      let maxDot = -Infinity;

      faces.forEach((face, index) => {
        const dot = currentPos.dot(face);
        if (dot > maxDot) {
          maxDot = dot;
          closestIndex = index;
        }
      });

      // Move to next face in cycle
      const nextIndex = (closestIndex + 1) % faces.length;
      const nextFace = faces[nextIndex];

      cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));

      // Handle up vector for top/bottom views
      const up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(nextFace.y) > 0.99) {
        up.set(0, 0, nextFace.y > 0 ? 1 : -1);
      }
      cubeCamera.up.copy(up);
      cubeCamera.lookAt(0, 0, 0);
      cubeCamera.updateProjectionMatrix();

      // Notify parent of rotation
      if (onOrientationChange) {
        const newDirection = cubeCamera.position.clone().normalize();
        onOrientationChange(newDirection);
      }
    };

    const rotateCameraLeft = () => {
      const currentPos = cubeCamera.position.clone().normalize();
      const distance = 5;

      // Front (0,0,1) → Left (-1,0,0) → Back (0,0,-1) → Right (1,0,0) → Front
      const faces = [
        new THREE.Vector3(0, 0, 1), // Front
        new THREE.Vector3(-1, 0, 0), // Left
        new THREE.Vector3(0, 0, -1), // Back
        new THREE.Vector3(1, 0, 0), // Right
      ];

      // Find closest face
      let closestIndex = 0;
      let maxDot = -Infinity;

      faces.forEach((face, index) => {
        const dot = currentPos.dot(face);
        if (dot > maxDot) {
          maxDot = dot;
          closestIndex = index;
        }
      });

      // Move to next face in cycle
      const nextIndex = (closestIndex + 1) % faces.length;
      const nextFace = faces[nextIndex];

      cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));
      cubeCamera.up.set(0, 1, 0);
      cubeCamera.lookAt(0, 0, 0);
      cubeCamera.updateProjectionMatrix();

      // Notify parent of rotation
      if (onOrientationChange) {
        const newDirection = cubeCamera.position.clone().normalize();
        onOrientationChange(newDirection);
      }
    };

    const rotateCameraRight = () => {
      const currentPos = cubeCamera.position.clone().normalize();
      const distance = 5;

      // Front (0,0,1) → Right (1,0,0) → Back (0,0,-1) → Left (-1,0,0) → Front
      const faces = [
        new THREE.Vector3(0, 0, 1), // Front
        new THREE.Vector3(1, 0, 0), // Right
        new THREE.Vector3(0, 0, -1), // Back
        new THREE.Vector3(-1, 0, 0), // Left
      ];

      // Find closest face
      let closestIndex = 0;
      let maxDot = -Infinity;

      faces.forEach((face, index) => {
        const dot = currentPos.dot(face);
        if (dot > maxDot) {
          maxDot = dot;
          closestIndex = index;
        }
      });

      // Move to next face in cycle
      const nextIndex = (closestIndex + 1) % faces.length;
      const nextFace = faces[nextIndex];

      cubeCamera.position.copy(nextFace.clone().multiplyScalar(distance));
      cubeCamera.up.set(0, 1, 0);
      cubeCamera.lookAt(0, 0, 0);
      cubeCamera.updateProjectionMatrix();

      // Notify parent of rotation
      if (onOrientationChange) {
        const newDirection = cubeCamera.position.clone().normalize();
        onOrientationChange(newDirection);
      }
    };

    const handleDisplayStyleChange = (value: "solid" | "wireframe" | "translucent") => {
      setDisplayStyle(value);
      onDisplayModeChange?.(value);
    };

    return (
      // ✅ FIX #3: Added absolute positioning and z-20 to ensure toolbar dropdowns appear above
      <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2">
        <div className="relative inline-block">
          {/* Cube Container */}
          <div
            ref={cubeContainerRef}
            className="relative rounded-lg overflow-visible"
            style={{
              width: "110px",
              height: "110px",
              filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))",
            }}
          />

          {/* Hover tooltip */}
          {hoveredRegion && (
            <div
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md text-xs font-medium text-white whitespace-nowrap pointer-events-none z-50"
              style={{
                background: "rgba(0, 0, 0, 0.9)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              {hoveredRegion.description}
              <div className="text-[10px] text-white/60 mt-0.5">
                {hoveredRegion.type === "face" && "Orthogonal view"}
                {hoveredRegion.type === "edge" && "Two-axis view"}
                {hoveredRegion.type === "corner" && "Tri-axial view"}
              </div>
            </div>
          )}

          {/* Directional Arrow Buttons - Clean minimal style */}
          <button
            onClick={rotateCameraUp}
            className="absolute -top-0.5 left-1/2 -translate-x-1/2 hover:scale-110 transition-transform cursor-pointer"
            title="Rotate View Up"
          >
            <ChevronUp className="h-3 w-3 text-gray-800 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" strokeWidth={2} />
          </button>

          <button
            onClick={rotateCameraDown}
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 hover:scale-110 transition-transform cursor-pointer"
            title="Rotate View Down"
          >
            <ChevronDown className="h-3 w-3 text-gray-800 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" strokeWidth={2} />
          </button>

          <button
            onClick={rotateCameraLeft}
            className="absolute top-1/2 -left-0.5 -translate-y-1/2 hover:scale-110 transition-transform cursor-pointer"
            title="Rotate View Left"
          >
            <ChevronLeft className="h-3 w-3 text-gray-800 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" strokeWidth={2} />
          </button>

          <button
            onClick={rotateCameraRight}
            className="absolute top-1/2 -right-0.5 -translate-y-1/2 hover:scale-110 transition-transform cursor-pointer"
            title="Rotate View Right"
          >
            <ChevronRight className="h-3 w-3 text-gray-800 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" strokeWidth={2} />
          </button>

          {/* Curved Rotation Arrows */}
          <button
            onClick={rotateCameraClockwise}
            className="absolute -top-0.5 -right-0.5 hover:scale-110 transition-transform cursor-pointer"
            title="Rotate Clockwise"
          >
            <RotateCw className="h-3 w-3 text-gray-800 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" strokeWidth={2} />
          </button>

          <button
            onClick={rotateCameraCounterClockwise}
            className="absolute -top-0.5 -left-0.5 hover:scale-110 transition-transform cursor-pointer"
            title="Rotate Counter-Clockwise"
          >
            <RotateCcw className="h-3 w-3 text-gray-800 drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]" strokeWidth={2} />
          </button>
        </div>

        {/* Display Style Dropdown */}
        <Select value={displayStyle} onValueChange={handleDisplayStyleChange}>
          <SelectTrigger className="w-[200px] h-8 text-xs bg-black/80 border-white/20 text-white hover:bg-black/90">
            <SelectValue placeholder="Display Style" />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-white/20 z-50">
            <SelectItem value="solid" className="text-white text-xs hover:bg-white/10 cursor-pointer">
              Display Solid Model
            </SelectItem>
            <SelectItem value="wireframe" className="text-white text-xs hover:bg-white/10 cursor-pointer">
              Display Wire Frames
            </SelectItem>
            <SelectItem value="translucent" className="text-white text-xs hover:bg-white/10 cursor-pointer">
              Display Solid Model (translucent)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  },
);

OrientationCubePreview.displayName = "OrientationCubePreview";
