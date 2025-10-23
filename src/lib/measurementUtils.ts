import * as THREE from 'three';

interface MeshData {
  vertices: number[];
  indices: number[];
  normals: number[];
  vertex_colors?: string[];
  triangle_count: number;
  feature_edges?: number[][][];
}

export interface SnapResult {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  surfaceType: 'vertex' | 'edge' | 'face';
  confidence: number;
}

/**
 * Calculate distance between two points with high precision
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance in world units (mm)
 */
export function calculateDistance(p1: THREE.Vector3, p2: THREE.Vector3): number {
  return p1.distanceTo(p2);
}

/**
 * Calculate angle between three points (p1-p2-p3) in degrees
 * @param p1 First point
 * @param p2 Vertex point (angle measured here)
 * @param p3 Third point
 * @returns Angle in degrees
 */
export function calculateAngle(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3
): number {
  const v1 = new THREE.Vector3().subVectors(p1, p2);
  const v2 = new THREE.Vector3().subVectors(p3, p2);
  
  const angle = v1.angleTo(v2);
  return THREE.MathUtils.radToDeg(angle);
}

/**
 * Calculate radius of a circle from 3 points
 * @param p1 First point on circle
 * @param p2 Second point on circle
 * @param p3 Third point on circle
 * @returns Radius in world units (mm)
 */
export function calculateRadius(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  p3: THREE.Vector3
): number {
  // Calculate side lengths of triangle
  const a = p1.distanceTo(p2);
  const b = p2.distanceTo(p3);
  const c = p3.distanceTo(p1);
  
  // Heron's formula for area
  const s = (a + b + c) / 2;
  const area = Math.sqrt(s * (s - a) * (s - b) * (s - c));
  
  // Radius from area and sides: R = abc / (4 * area)
  const radius = (a * b * c) / (4 * area);
  
  return radius;
}

/**
 * Format measurement value with appropriate precision
 * @param value Measurement value
 * @param unit Unit type ('mm' or 'deg')
 * @returns Formatted string
 */
export function formatMeasurement(value: number, unit: string): string {
  if (unit === 'deg') {
    return `${value.toFixed(2)}°`;
  }
  
  // For mm measurements - adaptive precision
  if (value < 1) {
    return `${value.toFixed(3)} ${unit}`; // Sub-millimeter: 3 decimals
  } else if (value < 10) {
    return `${value.toFixed(2)} ${unit}`; // Small: 2 decimals
  } else if (value < 100) {
    return `${value.toFixed(1)} ${unit}`; // Medium: 1 decimal
  } else {
    return `${value.toFixed(0)} ${unit}`; // Large: whole numbers
  }
}

/**
 * Snap point to nearest vertex with configurable threshold
 * @param point Point to snap
 * @param meshData Mesh data containing vertices
 * @param snapDistance Maximum snap distance
 * @returns Snap result or null if no vertex within threshold
 */
export function snapToVertex(
  point: THREE.Vector3,
  meshData: MeshData,
  snapDistance: number = 2
): SnapResult | null {
  let closestVertex: THREE.Vector3 | null = null;
  let closestNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  let minDistance = snapDistance;
  
  // Check all vertices
  for (let i = 0; i < meshData.vertices.length; i += 3) {
    const vertex = new THREE.Vector3(
      meshData.vertices[i],
      meshData.vertices[i + 1],
      meshData.vertices[i + 2]
    );
    
    const distance = point.distanceTo(vertex);
    if (distance < minDistance) {
      minDistance = distance;
      closestVertex = vertex;
      
      // Get normal for this vertex
      if (meshData.normals && i < meshData.normals.length) {
        closestNormal = new THREE.Vector3(
          meshData.normals[i],
          meshData.normals[i + 1],
          meshData.normals[i + 2]
        );
      }
    }
  }
  
  if (closestVertex) {
    return {
      position: closestVertex,
      normal: closestNormal,
      surfaceType: 'vertex',
      confidence: 1 - (minDistance / snapDistance)
    };
  }
  
  return null;
}

/**
 * Find the midpoint between two points
 * @param p1 First point
 * @param p2 Second point
 * @returns Midpoint
 */
export function getMidpoint(p1: THREE.Vector3, p2: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
}

/**
 * Generate label for measurement
 * @param type Measurement type
 * @param value Measurement value
 * @param unit Unit string
 * @returns Formatted label string
 */
export function generateMeasurementLabel(
  type: string,
  value: number,
  unit: string
): string {
  const formattedValue = formatMeasurement(value, unit);
  
  switch (type) {
    case 'distance':
      return `Distance: ${formattedValue}`;
    case 'angle':
      return `Angle: ${formattedValue}`;
    case 'radius':
      return `Radius: ${formattedValue}`;
    case 'diameter':
      return `Diameter: ${formattedValue}`;
    default:
      return formattedValue;
  }
}

/**
 * Format coordinate with precision
 * @param coord Coordinate value
 * @returns Formatted coordinate string
 */
export function formatCoordinate(coord: number): string {
  return coord.toFixed(2);
}

/**
 * Generate unique ID for measurement
 * @returns Unique ID string
 */
export function generateMeasurementId(): string {
  return `measurement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}