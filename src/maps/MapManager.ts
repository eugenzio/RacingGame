import * as THREE from 'three';
import { IGameMap, MapBuildResult } from './MapTypes';
import { PhysicsEngine } from '../physics';
import { StandardMap } from './standard';

export interface MapInfo {
  id: string;
  name: string;
  description: string;
}

export class MapManager {
  private currentMap: IGameMap | null = null;
  private currentMapData: MapBuildResult | null = null;
  private maps: { [key: string]: IGameMap } = {};

  constructor(private scene: THREE.Scene, private physics: PhysicsEngine) {
    this.registerMap(new StandardMap());
  }

  registerMap(map: IGameMap) {
    this.maps[map.id] = map;
  }

  getAvailableMaps(): MapInfo[] {
    return Object.values(this.maps).map(m => ({ id: m.id, name: m.name, description: m.description }));
  }

  async loadMap(id: string): Promise<MapBuildResult> {
    if (this.currentMap) {
        this.currentMap.dispose(this.scene, this.physics);
    }

    const map = this.maps[id];
    if (!map) throw new Error(`Map ${id} not found`);

    this.currentMap = map;
    this.applyTheme(map.theme);

    this.currentMapData = await map.build(this.scene, this.physics);
    return this.currentMapData;
  }

  getCurrentMapData(): MapBuildResult | null {
    return this.currentMapData;
  }

  private applyTheme(theme: any) {
    // Sky
    this.scene.background = new THREE.Color(theme.skyColorTop);
    // Fog
    this.scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);

    // Remove old lights
    this.scene.children.filter(c => c instanceof THREE.Light).forEach(l => this.scene.remove(l));

    const ambient = new THREE.AmbientLight(theme.skyColorTop, theme.ambientLightIntensity);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(theme.sunColor, theme.sunIntensity);
    sun.position.copy(theme.sunPosition);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 500;
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    this.scene.add(sun);
  }
}
