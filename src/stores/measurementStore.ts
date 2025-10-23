import { create } from 'zustand';
import * as THREE from 'three';

export type MeasurementType = 'distance' | 'angle' | 'radius' | 'diameter';

export interface MeasurementPoint {
  id: string;
  position: THREE.Vector3;
  normal?: THREE.Vector3;
  surfaceType?: 'vertex' | 'edge' | 'face';
}

export interface Measurement {
  id: string;
  type: MeasurementType;
  points: MeasurementPoint[];
  value: number;
  unit: 'mm' | 'deg';
  label: string;
  color: string;
  visible: boolean;
  createdAt: Date;
}

interface MeasurementStore {
  measurements: Measurement[];
  activeTool: MeasurementType | null;
  tempPoints: MeasurementPoint[];
  snapEnabled: boolean;
  snapDistance: number;
  
  // Actions
  setActiveTool: (tool: MeasurementType | null) => void;
  addTempPoint: (point: MeasurementPoint) => void;
  clearTempPoints: () => void;
  addMeasurement: (measurement: Measurement) => void;
  removeMeasurement: (id: string) => void;
  toggleMeasurementVisibility: (id: string) => void;
  clearAllMeasurements: () => void;
  updateMeasurement: (id: string, updates: Partial<Measurement>) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setSnapDistance: (distance: number) => void;
}

export const useMeasurementStore = create<MeasurementStore>((set) => ({
  measurements: [],
  activeTool: null,
  tempPoints: [],
  snapEnabled: true,
  snapDistance: 2, // Default snap distance in world units
  
  setActiveTool: (tool) => set({ activeTool: tool, tempPoints: [] }),
  
  addTempPoint: (point) => set((state) => ({
    tempPoints: [...state.tempPoints, point]
  })),
  
  clearTempPoints: () => set({ tempPoints: [] }),
  
  addMeasurement: (measurement) => set((state) => ({
    measurements: [...state.measurements, measurement],
    tempPoints: []
  })),
  
  removeMeasurement: (id) => set((state) => ({
    measurements: state.measurements.filter(m => m.id !== id)
  })),
  
  toggleMeasurementVisibility: (id) => set((state) => ({
    measurements: state.measurements.map(m =>
      m.id === id ? { ...m, visible: !m.visible } : m
    )
  })),
  
  clearAllMeasurements: () => set({ measurements: [], tempPoints: [] }),
  
  updateMeasurement: (id, updates) => set((state) => ({
    measurements: state.measurements.map(m =>
      m.id === id ? { ...m, ...updates } : m
    )
  })),
  
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  
  setSnapDistance: (distance) => set({ snapDistance: distance })
}));