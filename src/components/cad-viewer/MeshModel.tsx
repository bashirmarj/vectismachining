import React, { useRef, useMemo, useEffect, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface MeshModelProps {
  meshData: {
    vertices: number[];
    indices: number[];
    normals: number[];
    vertex_colors?: string[];
    feature_edges?: number[][][];
  };
  displayStyle?: "solid" | "wireframe" | "translucent";
  showEdges?: boolean;
  showHiddenEdges?: boolean;
  edgeColor?: string;
  hiddenEdgeColor?: string;
  clippingPlane?: THREE.Plane | null;
  opacity?: number;
  highlightedFeatures?: Set<string>;
}

export function MeshModel({
  meshData,
  displayStyle = "solid",
  showEdges = true,
  showHiddenEdges = false,
  edgeColor = "#000000",
  hiddenEdgeColor = "#666666",
  clippingPlane = null,
  opacity = 1.0,
  highlightedFeatures = new Set(),
}: MeshModelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const staticEdgesRef = useRef<THREE.Group>(null);
  const dynamicEdgesRef = useRef<THREE.Group>(null);

  // Create geometry from mesh data
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    // Set vertices
    const vertices = new Float32Array(meshData.vertices);
    geo.setAttribute("position", new THREE.BufferAttribute(vertices, 3));

    // Set indices
    const indices = new Uint32Array(meshData.indices);
    geo.setIndex(new THREE.BufferAttribute(indices, 1));

    // ============================================
    // 🔥 CRITICAL FIX #1: Use BREP normals directly
    // ============================================
    // REMOVED: geo.computeVertexNormals() - was overwriting accurate BREP normals
    // The Python backend already computed accurate normals from BREP surface
    if (meshData.normals && meshData.normals.length > 0) {
      console.log("✅ Using backend-provided BREP normals (accurate for curved surfaces)");
      const normals = new Float32Array(meshData.normals);
      geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));

      // Only normalize to ensure unit length
      geo.normalizeNormals();
    } else {
      console.warn("⚠️ No backend normals - falling back to computed normals");
      geo.computeVertexNormals();
    }
    // ============================================

    // Set vertex colors if available
    if (meshData.vertex_colors && meshData.vertex_colors.length > 0) {
      const colors: number[] = [];
      meshData.vertex_colors.forEach((colorStr) => {
        const color = new THREE.Color(colorStr);
        colors.push(color.r, color.g, color.b);
      });
      geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    }

    geo.computeBoundingSphere();
    return geo;
  }, [meshData]);

  // ============================================
  // 🔥 CRITICAL FIX #2: Render static feature edges from backend
  // ============================================
  const staticFeatureEdges = useMemo(() => {
    if (!meshData.feature_edges || meshData.feature_edges.length === 0) {
      console.log("⚠️ No feature_edges in mesh data");
      return null;
    }

    console.log(`✅ Rendering ${meshData.feature_edges.length} static feature edges from backend`);

    const edgeSegments: number[] = [];

    // Convert edge polylines to line segments
    meshData.feature_edges.forEach((polyline) => {
      for (let i = 0; i < polyline.length - 1; i++) {
        const p1 = polyline[i];
        const p2 = polyline[i + 1];
        edgeSegments.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
      }
    });

    if (edgeSegments.length === 0) {
      return null;
    }

    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(edgeSegments, 3));

    const edgeMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      linewidth: 2, // Slightly thicker for better visibility
      transparent: false,
      depthTest: true,
      depthWrite: true,
    });

    return new THREE.LineSegments(edgeGeo, edgeMat);
  }, [meshData.feature_edges, edgeColor]);
  // ============================================

  // Material configuration
  const materialProps = useMemo(() => {
    const base = {
      color: "#CCCCCC",
      side: THREE.DoubleSide,
      clippingPlanes: clippingPlane ? [clippingPlane] : [],
      clipIntersection: false,
      metalness: 0.15,
      roughness: 0.6,
      envMapIntensity: 1.2,
    };

    if (displayStyle === "wireframe") {
      return {
        ...base,
        wireframe: true,
        transparent: false,
        opacity: 1,
      };
    } else if (displayStyle === "translucent") {
      return {
        ...base,
        transparent: true,
        opacity: opacity,
        depthWrite: false,
      };
    } else {
      return {
        ...base,
        transparent: opacity < 1,
        opacity: opacity,
        vertexColors: meshData.vertex_colors ? true : false,
      };
    }
  }, [displayStyle, clippingPlane, opacity, meshData.vertex_colors]);

  // Update static edges when they change
  useEffect(() => {
    if (staticEdgesRef.current) {
      // Clear existing edges
      while (staticEdgesRef.current.children.length > 0) {
        const child = staticEdgesRef.current.children[0];
        staticEdgesRef.current.remove(child);
        if (child instanceof THREE.LineSegments) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }

      // Add new edges
      if (staticFeatureEdges) {
        staticEdgesRef.current.add(staticFeatureEdges);
      }
    }
  }, [staticFeatureEdges]);

  return (
    <group>
      {/* Main mesh with accurate BREP normals */}
      <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial {...materialProps} flatShading={false} />
      </mesh>

      {/* Static feature edges from backend (always visible) */}
      {displayStyle === "solid" && showEdges && <group ref={staticEdgesRef} />}
    </group>
  );
}
