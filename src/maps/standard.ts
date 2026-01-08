import * as THREE from 'three';
import { IGameMap, MapBuildResult, ThemePreset } from './MapTypes';
import { PhysicsEngine } from '../physics';
import { TrackBuilder } from './track/TrackBuilder';

const THEME_STANDARD: ThemePreset = {
  name: 'Grand Prix Circuit',
  skyColorTop: 0x87CEEB, // Daylight Blue
  skyColorBottom: 0xffffff,
  fogColor: 0x87CEEB,
  fogNear: 100,
  fogFar: 800,
  ambientLightIntensity: 0.6,
  sunColor: 0xffffff,
  sunIntensity: 1.0,
  sunPosition: new THREE.Vector3(100, 200, 100),
  groundColor: 0x228b22 // Grass Green
};

export class StandardMap implements IGameMap {
  id = 'standard';
  name = 'Grand Prix Circuit';
  description = 'Professional F1 Grade Track';
  theme: ThemePreset = THEME_STANDARD;
  
  private trackBuilder: TrackBuilder | null = null;
  private disposables: any[] = [];

  async build(scene: THREE.Scene, physics: PhysicsEngine): Promise<MapBuildResult> {
    this.trackBuilder = new TrackBuilder(scene, physics);
    
    // 1. Ground
    this.trackBuilder.createGround(this.theme.groundColor);

    // 2. Track Layout (Suzuka-ish Figure 8 style but flattened for simplicity or just a complex loop)
    // Let's do a nice technical loop
    // REMOVED duplicate last point to prevent spline knot/kink at the start/finish line
    const points = [
        new THREE.Vector3(0, 0, 50),      // Start/Finish
        new THREE.Vector3(0, 0, -100),    // Main Straight
        new THREE.Vector3(-20, 0, -150),  // Turn 1
        new THREE.Vector3(-80, 0, -150),  // Turn 2
        new THREE.Vector3(-120, 0, -100), // Turn 3
        new THREE.Vector3(-120, 0, 0),    // Back Straight
        new THREE.Vector3(-150, 0, 50),   // Turn 4
        new THREE.Vector3(-100, 0, 100),  // Turn 5
        new THREE.Vector3(-50, 0, 100),   // Turn 6
    ];
    
    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    this.trackBuilder.buildTrack(curve, 18); // 18 width standard

    // 3. Environment Details (Grandstands, Trees)
    this.createEnvironment(scene);

    return {
        spawnPosition: new THREE.Vector3(0, 0.5, 60),
        spawnRotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0)
    };
  }

  createEnvironment(scene: THREE.Scene) {
      // Start/Finish Line
      const sfGeo = new THREE.PlaneGeometry(18, 4); // Spans track width
      // Checkered pattern would be nice, but simple white strip is fine for now
      const sfMat = new THREE.MeshStandardMaterial({ 
          color: 0xffffff, 
          roughness: 0.1,
          side: THREE.DoubleSide
      });
      const sfLine = new THREE.Mesh(sfGeo, sfMat);
      sfLine.rotation.x = -Math.PI / 2;
      sfLine.position.set(0, 0.06, 50); // Z=50 is start point
      sfLine.receiveShadow = true;
      scene.add(sfLine);
      this.disposables.push(sfLine);

      // Grandstand on main straight
      /*
      const standGeo = new THREE.BoxGeometry(10, 8, 100);
      const standMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
      const stand = new THREE.Mesh(standGeo, standMat);
      stand.position.set(25, 4, -25);
      stand.castShadow = true;
      scene.add(stand);
      this.disposables.push(stand);
      */

      // Trees
      /*
      const treeGeo = new THREE.ConeGeometry(3, 8, 8);
      const trunkGeo = new THREE.CylinderGeometry(0.8, 0.8, 3, 8);
      const treeMat = new THREE.MeshStandardMaterial({ color: 0x006400 });
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

      // Instanced Trees
      const treeCount = 100;
      const treeMesh = new THREE.InstancedMesh(treeGeo, treeMat, treeCount);
      const trunkMesh = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
      
      const dummy = new THREE.Object3D();
      let idx = 0;

      for (let i = 0; i < treeCount; i++) {
          const x = (Math.random() - 0.5) * 600;
          const z = (Math.random() - 0.5) * 600;
          
          // Avoid track center roughly
          if (x > -180 && x < 20 && z > -180 && z < 120) continue;

          dummy.position.set(x, 1.5, z);
          dummy.updateMatrix();
          trunkMesh.setMatrixAt(idx, dummy.matrix);

          dummy.position.set(x, 5.5, z);
          dummy.updateMatrix();
          treeMesh.setMatrixAt(idx, dummy.matrix);
          
          idx++;
      }
      
      treeMesh.count = idx;
      trunkMesh.count = idx;
      treeMesh.castShadow = true;
      trunkMesh.castShadow = true;
      
      scene.add(treeMesh);
      scene.add(trunkMesh);
      this.disposables.push(treeMesh, trunkMesh);
      */
  }

  dispose(scene: THREE.Scene, physics: PhysicsEngine) {
      if (this.trackBuilder) this.trackBuilder.dispose();
      this.disposables.forEach(d => {
          scene.remove(d);
          if (d.geometry) d.geometry.dispose();
      });
      this.disposables = [];
  }
}
