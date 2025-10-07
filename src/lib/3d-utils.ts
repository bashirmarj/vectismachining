import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

export type SupportedFileType = 'stl' | 'obj' | 'step' | 'stp' | 'unsupported';

export const getFileType = (filename: string): SupportedFileType => {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'stl') return 'stl';
  if (ext === 'obj') return 'obj';
  if (ext === 'step' || ext === 'stp') return 'step';
  return 'unsupported';
};

export const canPreview = (filename: string): boolean => {
  const type = getFileType(filename);
  return type === 'stl' || type === 'obj';
};

export const loadSTL = (url: string): Promise<THREE.BufferGeometry> => {
  return new Promise((resolve, reject) => {
    const loader = new STLLoader();
    loader.load(
      url,
      (geometry) => resolve(geometry),
      undefined,
      (error) => reject(error)
    );
  });
};

export const loadOBJ = (url: string): Promise<THREE.Group> => {
  return new Promise((resolve, reject) => {
    const loader = new OBJLoader();
    loader.load(
      url,
      (object) => resolve(object),
      undefined,
      (error) => reject(error)
    );
  });
};

export const createObjectURL = (file: File): string => {
  return URL.createObjectURL(file);
};

export const revokeObjectURL = (url: string): void => {
  URL.revokeObjectURL(url);
};
