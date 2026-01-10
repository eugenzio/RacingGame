import * as THREE from 'three';
import { PhysicsEngine } from '../physics';

export interface ThemePreset {
  name: string;
  skyColorTop: number;
  skyColorBottom: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  ambientLightIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: THREE.Vector3;
  groundColor: number;
}

export interface MapBuildResult {
  spawnPosition: THREE.Vector3;
  spawnRotation: THREE.Quaternion;
  // We return objects that might need specific tracking, though usually scene graph handles visual disposal
  // and physics engine handles body disposal.
}

export interface IGameMap {
  id: string;
  name: string;
  description: string;
  theme: ThemePreset;
  build(scene: THREE.Scene, physics: PhysicsEngine): Promise<MapBuildResult>;
  dispose(scene: THREE.Scene, physics: PhysicsEngine): void;
}
