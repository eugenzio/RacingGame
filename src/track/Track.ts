import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsEngine } from '../physics';

export class Track {
  constructor(scene: THREE.Scene, physics: PhysicsEngine) {
    this.createGround(scene, physics);
    this.createCircuit(scene, physics);
    this.createDetails(scene);
  }

  private createDetails(scene: THREE.Scene) {
    // 1. Start/Finish Line
    const sfGeo = new THREE.PlaneGeometry(14, 2);
    const sfMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        roughness: 0.1, 
        side: THREE.DoubleSide 
    });
    const sfLine = new THREE.Mesh(sfGeo, sfMat);
    sfLine.rotation.x = -Math.PI / 2;
    sfLine.position.set(0, 0.06, 50); // Slightly above road
    scene.add(sfLine);

    // 2. Grandstands (Main Straight)
    const standGeo = new THREE.BoxGeometry(10, 5, 80);
    const standMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee });
    const standMesh = new THREE.Mesh(standGeo, standMat);
    standMesh.position.set(25, 2.5, -50);
    standMesh.castShadow = true;
    standMesh.receiveShadow = true;
    scene.add(standMesh);
    
    // Roof for grandstand
    const roofGeo = new THREE.BoxGeometry(12, 0.5, 80);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(25, 6, -50);
    scene.add(roof);


    // 3. Trees
    const treeGeo = new THREE.ConeGeometry(2, 6, 8);
    const trunkGeo = new THREE.CylinderGeometry(0.5, 0.5, 2, 8);
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x006400 }); // Dark Green
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 }); // Saddle Brown

    for (let i = 0; i < 100; i++) {
        const treeGroup = new THREE.Group();
        
        // Random Position in a large area
        const x2 = (Math.random() - 0.5) * 600;
        const z2 = (Math.random() - 0.5) * 600;
        
        // Exclusion Zone (Track Bounds)
        // Track extends roughly X: -200 to 0, Z: -160 to 120
        // We add a buffer
        if (x2 > -220 && x2 < 20 && z2 > -180 && z2 < 140) continue; 

        treeGroup.position.set(x2, 0, z2);

        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        const leaves = new THREE.Mesh(treeGeo, treeMat);
        leaves.position.y = 4; // 1 + 3
        leaves.castShadow = true;
        treeGroup.add(leaves);

        scene.add(treeGroup);
    }
  }

  private createGround(scene: THREE.Scene, physics: PhysicsEngine) {
    // Visuals - Grass
    const geometry = new THREE.PlaneGeometry(1000, 1000);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x228b22, // Forest Green
      roughness: 1.0,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(geometry, material);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Physics
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
    const groundBody = physics.world.createRigidBody(groundBodyDesc);
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(500, 0.1, 500); // Half extents
    physics.world.createCollider(groundColliderDesc, groundBody);
  }

  private createCircuit(scene: THREE.Scene, physics: PhysicsEngine) {
    // 1. Define Waypoints for a More Realistic Circuit
    // Clockwise loop with varying radius turns and a chicane
    const points = [
        new THREE.Vector3(0, 0, 50),      // Start Finish
        new THREE.Vector3(0, 0, -100),    // End Main Straight
        new THREE.Vector3(-20, 0, -150),  // Turn 1 (Gentle Left)
        new THREE.Vector3(-60, 0, -160),  // Turn 2 (Sharp Left)
        new THREE.Vector3(-100, 0, -120), // Turn 3 Exit
        new THREE.Vector3(-120, 0, -50),  // Short Straight
        new THREE.Vector3(-120, 0, 50),   // Turn 4 Entry
        new THREE.Vector3(-160, 0, 80),   // Hairpin Entry
        new THREE.Vector3(-180, 0, 100),  // Hairpin Apex
        new THREE.Vector3(-160, 0, 120),  // Hairpin Exit
        new THREE.Vector3(-50, 0, 120),   // Back Straight
        new THREE.Vector3(-20, 0, 100),   // Final Chicane Entry
        new THREE.Vector3(-20, 0, 80),    // Chicane Left
        new THREE.Vector3(0, 0, 60),      // Chicane Right / Exit
        new THREE.Vector3(0, 0, 50)       // Loop Close
    ];

    const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.5);
    
    // 2. Generate Road Mesh (Ribbon to avoid start/end caps)
    const trackWidth = 15; // Narrower (Realism)
    const divisions = 500; // Smoother
    
    const curvePoints = curve.getSpacedPoints(divisions);
    const frames = curve.computeFrenetFrames(divisions, true);
    
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < curvePoints.length; i++) {
        const p = curvePoints[i];
        const tangent = frames.tangents[i];
        
        // Calculate sideways vector
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

        // Left and Right vertices for this slice
        const left = p.clone().add(side.clone().multiplyScalar(-trackWidth / 2));
        const right = p.clone().add(side.clone().multiplyScalar(trackWidth / 2));

        // Slightly lift road to avoid z-fighting with ground
        vertices.push(left.x, 0.05, left.z);
        vertices.push(right.x, 0.05, right.z);

        // Simple UVs (along strip)
        const v = i / divisions;
        uvs.push(0, v);
        uvs.push(1, v);
    }

    // Generate Triangles
    for (let i = 0; i < divisions; i++) {
        const p1 = i * 2;
        const p2 = p1 + 1;
        const p3 = p1 + 2;
        const p4 = p1 + 3;

        // Two triangles per segment
        // 1-2-3
        indices.push(p1, p3, p2);
        // 2-3-4
        indices.push(p2, p3, p4);
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    roadGeo.setIndex(indices);
    roadGeo.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({ 
        color: 0x222222, 
        roughness: 0.5,
        side: THREE.DoubleSide // Ensure it's visible from all angles just in case
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    scene.add(roadMesh);

    // 3. Generate Walls (Visual + Physics)
    const wallHeight = 0.8;
    const wallThickness = 1.0;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xcc0000 }); 
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });

    for (let i = 0; i < curvePoints.length - 1; i++) {
        const p1 = curvePoints[i];
        const p2 = curvePoints[i+1];
        const tangent = frames.tangents[i];
        const normal = frames.normals[i]; 
        
        const up = new THREE.Vector3(0, 1, 0);
        const side = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const segmentLength = p1.distanceTo(p2);
        const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

        // Angle for rotation
        const angle = Math.atan2(tangent.x, tangent.z);

        // Alternating colors for curbs effect
        const mat = i % 4 < 2 ? wallMat : whiteMat;

        // Left Wall
        this.createWallSegment(
            scene, physics, 
            midPoint.clone().add(side.clone().multiplyScalar(-trackWidth / 2 - wallThickness/2)), 
            angle, 
            segmentLength, wallThickness, wallHeight, mat
        );

        // Right Wall
        this.createWallSegment(
            scene, physics, 
            midPoint.clone().add(side.clone().multiplyScalar(trackWidth / 2 + wallThickness/2)), 
            angle, 
            segmentLength, wallThickness, wallHeight, mat
        );
    }
  }

  private createWallSegment(
      scene: THREE.Scene, 
      physics: PhysicsEngine, 
      position: THREE.Vector3, 
      rotationY: number, 
      length: number, 
      thickness: number, 
      height: number,
      material: THREE.Material
  ) {
      // Visual
      const geometry = new THREE.BoxGeometry(thickness, height, length + 0.2); // slight overlap visual
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      mesh.position.y = height / 2;
      mesh.rotation.y = rotationY;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);

      // Physics
      const bodyDesc = RAPIER.RigidBodyDesc.fixed()
        .setTranslation(position.x, height / 2, position.z)
        .setRotation({ x: 0, y: Math.sin(rotationY/2), z: 0, w: Math.cos(rotationY/2) }); 
      
      const body = physics.world.createRigidBody(bodyDesc);
      // Overlap physics collider significantly to prevent ghost collisions at seams
      const colliderDesc = RAPIER.ColliderDesc.cuboid(thickness / 2, height / 2, (length / 2) * 1.05);
      physics.world.createCollider(colliderDesc, body);
  }
}
