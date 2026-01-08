import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsEngine } from '../../physics';

export class TrackBuilder {
  bodies: RAPIER.RigidBody[] = [];
  meshes: THREE.Mesh[] = [];

  constructor(private scene: THREE.Scene, private physics: PhysicsEngine) {}

  buildTrack(curve: THREE.CatmullRomCurve3, width: number, isCircuit: boolean = true) {
    const divisions = 400;
    
    // 1. Visual Road (Ribbon)
    const curvePoints = curve.getSpacedPoints(divisions);
    const frames = curve.computeFrenetFrames(divisions, isCircuit);
    
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < curvePoints.length; i++) {
        const p = curvePoints[i];
        const tangent = frames.tangents[i];
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const left = p.clone().add(side.clone().multiplyScalar(-width / 2));
        const right = p.clone().add(side.clone().multiplyScalar(width / 2));

        vertices.push(left.x, 0.05, left.z);
        vertices.push(right.x, 0.05, right.z);

        const v = i / divisions;
        uvs.push(0, v);
        uvs.push(1, v);
    }

    for (let i = 0; i < divisions; i++) {
        const p1 = i * 2;
        const p2 = p1 + 1;
        const p3 = p1 + 2;
        const p4 = p1 + 3;
        indices.push(p1, p3, p2);
        indices.push(p2, p3, p4);
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333, 
        roughness: 0.5,
        side: THREE.DoubleSide
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);
    this.meshes.push(roadMesh);

    // 2. Walls (Physics + Visuals)
    this.createWalls(curvePoints, frames, width);
  }

  private createWalls(points: THREE.Vector3[], frames: any, trackWidth: number) {
    const wallHeight = 1.0;
    const wallThickness = 1.0;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const tangent = frames.tangents[i];
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const segmentLength = p1.distanceTo(p2);
        const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const angle = Math.atan2(tangent.x, tangent.z);

        // Curbs effect
        const mat = i % 4 < 2 ? wallMat : whiteMat;

        // Left Wall
        this.createWallSegment(
            midPoint.clone().add(side.clone().multiplyScalar(-trackWidth / 2 - wallThickness/2)), 
            angle, segmentLength, wallThickness, wallHeight, mat
        );

        // Right Wall
        this.createWallSegment(
            midPoint.clone().add(side.clone().multiplyScalar(trackWidth / 2 + wallThickness/2)), 
            angle, segmentLength, wallThickness, wallHeight, mat
        );
    }
  }

  private createWallSegment(pos: THREE.Vector3, rotY: number, len: number, thick: number, height: number, mat: THREE.Material) {
      // Visual
      const geo = new THREE.BoxGeometry(thick, height, len + 0.2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.position.y = height / 2;
      mesh.rotation.y = rotY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.meshes.push(mesh);

      // Physics
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(pos.x, height / 2, pos.z)
        .setRotation({ x: 0, y: Math.sin(rotY/2), z: 0, w: Math.cos(rotY/2) });
      const body = this.physics.world.createRigidBody(bodyDesc);
      const colliderDesc = RAPIER.ColliderDesc.cuboid(thick / 2, height / 2, len / 2); // No overlap for physics to avoid internal collisions
      this.physics.world.createCollider(colliderDesc, body);
      this.bodies.push(body);
  }

  createGround(color: number) {
      const geometry = new THREE.PlaneGeometry(2000, 2000);
      const material = new THREE.MeshStandardMaterial({ color: color, roughness: 1.0 });
      const ground = new THREE.Mesh(geometry, material);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      this.scene.add(ground);
      this.meshes.push(ground);

      const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
      const groundBody = this.physics.world.createRigidBody(groundBodyDesc);
      const groundColliderDesc = RAPIER.ColliderDesc.cuboid(1000, 0.1, 1000);
      this.physics.world.createCollider(groundColliderDesc, groundBody);
      this.bodies.push(groundBody);
  }

  dispose() {
      // Remove visual meshes
      this.meshes.forEach(m => {
          this.scene.remove(m);
          if (m.geometry) m.geometry.dispose();
          // Don't dispose material if shared, but we create new ones here so ok
      });
      this.meshes = [];

      // Remove physics bodies
      this.bodies.forEach(b => {
          this.physics.world.removeRigidBody(b);
      });
      this.bodies = [];
  }
}
