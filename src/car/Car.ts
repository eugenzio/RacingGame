import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsEngine } from '../physics';

export class Car {
  mesh: THREE.Group;
  rigidBody!: RAPIER.RigidBody;
  collider!: RAPIER.Collider;
  colliderHandle: number = -1;
  isRemote: boolean;
  playerName: string = 'Player';

  // Name label (for multiplayer)
  nameLabel: THREE.Sprite | null = null;

  // Interpolation state
  prevPos = new THREE.Vector3();
  prevRot = new THREE.Quaternion();
  currPos = new THREE.Vector3();
  currRot = new THREE.Quaternion();

  // Remote car target state (for network interpolation)
  targetPos = new THREE.Vector3();
  targetRot = new THREE.Quaternion();

  constructor(scene: THREE.Scene, physics: PhysicsEngine, position: { x: number, y: number, z: number }, isRemote = false, name = 'Player', color = '#dc0000') {
    this.isRemote = isRemote;
    this.playerName = name;
    this.mesh = this.createCarMesh(color);
    this.mesh.position.set(position.x, position.y, position.z);
    scene.add(this.mesh);

    if (isRemote) {
      this.targetPos.set(position.x, position.y, position.z);

      // Remote cars use kinematic body for collision detection
      const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(position.x, position.y + 0.5, position.z);

      this.rigidBody = physics.world.createRigidBody(bodyDesc);

      // Collider for collision with other cars
      const colliderDesc = RAPIER.ColliderDesc.cuboid(0.8, 0.4, 2.0)
        .setRestitution(0.5) // Bounce off
        .setFriction(0.3);

      this.collider = physics.world.createCollider(colliderDesc, this.rigidBody);
      this.colliderHandle = this.collider.handle;

      // Create name label for remote cars
      this.createNameLabel(name);
      return;
    }

    // Physics for local car
    // Car dimensions approx: 4m long, 1.8m wide, 1m high
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(position.x, position.y + 0.5, position.z)
      .setLinearDamping(0.5) // Air resistance base
      .setAngularDamping(2.0); // Stabilize rotation

    this.rigidBody = physics.world.createRigidBody(bodyDesc);

    // Collider - slightly smaller than visual to prevent snagging
    const colliderDesc = RAPIER.ColliderDesc.cuboid(0.8, 0.4, 2.0)
        .setFriction(0.0) // We handle friction manually in controller for better arcade drift control
        .setRestitution(0.5) // Bounce off other cars
        .setMass(800) // 800kg F1 car
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);

    this.collider = physics.world.createCollider(colliderDesc, this.rigidBody);
    this.colliderHandle = this.collider.handle;

    // Init state
    this.saveState();
  }

  private createNameLabel(name: string): void {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = 256;
    canvas.height = 64;

    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = '#ffffff';
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(name, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    this.nameLabel = new THREE.Sprite(spriteMaterial);
    this.nameLabel.scale.set(4, 1, 1);
    this.nameLabel.position.set(0, 2.5, 0);
    this.mesh.add(this.nameLabel);
  }

  saveState() {
    if (this.isRemote) return;
    const t = this.rigidBody.translation();
    const r = this.rigidBody.rotation();
    this.prevPos.set(t.x, t.y, t.z);
    this.prevRot.set(r.x, r.y, r.z, r.w);
  }

  update(alpha = 1) {
    if (this.isRemote) {
      // Remote cars: smoothly interpolate toward target state
      this.mesh.position.lerp(this.targetPos, 0.15);
      this.mesh.quaternion.slerp(this.targetRot, 0.15);

      // Update kinematic body position for collision
      this.rigidBody.setNextKinematicTranslation({
        x: this.mesh.position.x,
        y: this.mesh.position.y + 0.5,
        z: this.mesh.position.z
      });
      this.rigidBody.setNextKinematicRotation({
        x: this.mesh.quaternion.x,
        y: this.mesh.quaternion.y,
        z: this.mesh.quaternion.z,
        w: this.mesh.quaternion.w
      });
      return;
    }

    // Get current physics state
    const t = this.rigidBody.translation();
    const r = this.rigidBody.rotation();
    this.currPos.set(t.x, t.y, t.z);
    this.currRot.set(r.x, r.y, r.z, r.w);

    // Interpolate: Visual = lerp(Prev, Curr, alpha)
    this.mesh.position.lerpVectors(this.prevPos, this.currPos, alpha);
    this.mesh.quaternion.slerpQuaternions(this.prevRot, this.currRot, alpha);
  }

  updateRemoteState(pos: { x: number, y: number, z: number }, rot: { x: number, y: number, z: number, w: number }) {
    this.targetPos.set(pos.x, pos.y, pos.z);
    this.targetRot.set(rot.x, rot.y, rot.z, rot.w);
  }

  private createCarMesh(color: string): THREE.Group {
    const carGroup = new THREE.Group();

    // --- Materials ---
    const bodyMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.2,
        metalness: 0.6,
        envMapIntensity: 1.0
    });
    const carbonMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, 
        roughness: 0.8,
        metalness: 0.1
    });
    const tireMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1a, 
        roughness: 0.9 
    });
    const rimMat = new THREE.MeshStandardMaterial({ 
        color: 0xcccccc, 
        roughness: 0.2,
        metalness: 0.9 
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x000000,
        roughness: 0.0,
        metalness: 1.0
    });

    // --- 1. Chassis (Monocoque + Nose) ---
    // Central Body
    const chassisGeo = new THREE.BoxGeometry(0.6, 0.4, 2.5);
    const chassis = new THREE.Mesh(chassisGeo, bodyMat);
    chassis.position.set(0, 0.2, -0.5);
    chassis.castShadow = true;
    carGroup.add(chassis);

    // Nose Cone (Tapered)
    const noseGeo = new THREE.CylinderGeometry(0.15, 0.3, 1.5, 12);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.rotation.x = -Math.PI / 2;
    nose.position.set(0, 0.1, -2.2); // Stick out front
    nose.castShadow = true;
    carGroup.add(nose);

    // Engine Cover (Behind cockpit)
    const engineCoverGeo = new THREE.BoxGeometry(0.6, 0.5, 1.5);
    // Taper it slightly? (Hard with Box, stick to primitive combo)
    const engineCover = new THREE.Mesh(engineCoverGeo, bodyMat);
    engineCover.position.set(0, 0.4, 0.8);
    engineCover.castShadow = true;
    carGroup.add(engineCover);

    // Air Intake (Top)
    const intakeGeo = new THREE.BoxGeometry(0.3, 0.3, 0.4);
    const intake = new THREE.Mesh(intakeGeo, bodyMat);
    intake.position.set(0, 0.7, 0.2);
    carGroup.add(intake);

    // Sidepods (Left & Right)
    const sidepodGeo = new THREE.BoxGeometry(0.5, 0.4, 1.8);
    const sidepodL = new THREE.Mesh(sidepodGeo, bodyMat);
    sidepodL.position.set(0.6, 0.15, 0.5);
    sidepodL.castShadow = true;
    carGroup.add(sidepodL);

    const sidepodR = new THREE.Mesh(sidepodGeo, bodyMat);
    sidepodR.position.set(-0.6, 0.15, 0.5);
    sidepodR.castShadow = true;
    carGroup.add(sidepodR);


    // --- 2. Cockpit ---
    const cockpitGeo = new THREE.BoxGeometry(0.5, 0.3, 0.8);
    const cockpit = new THREE.Mesh(cockpitGeo, glassMat);
    cockpit.position.set(0, 0.35, -0.4);
    carGroup.add(cockpit);

    // Halo (Simple Torus segment or Hoop)
    // Using a tube for Halo
    const haloCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0.2),
        new THREE.Vector3(0.2, 0, -0.3),
        new THREE.Vector3(0, -0.1, -0.6),
        new THREE.Vector3(-0.2, 0, -0.3),
        new THREE.Vector3(0, 0, 0.2), // Loop back
    ], true);
    // Actually just a hoop
    const haloTube = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
            new THREE.Vector3(0.25, 0.55, -0.2), // Rear Left
            new THREE.Vector3(0.25, 0.55, -0.7), // Front Left
            new THREE.Vector3(0, 0.45, -0.9),    // Center Pillar top
            new THREE.Vector3(-0.25, 0.55, -0.7),// Front Right
            new THREE.Vector3(-0.25, 0.55, -0.2) // Rear Right
        ]), 
        20, 0.04, 8, false
    );
    const halo = new THREE.Mesh(haloTube, carbonMat);
    carGroup.add(halo);

    // Center Pillar for Halo
    const haloPillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4);
    const haloPillar = new THREE.Mesh(haloPillarGeo, carbonMat);
    haloPillar.position.set(0, 0.3, -0.9);
    carGroup.add(haloPillar);


    // --- 3. Wings ---
    // Front Wing Main Plane
    const fwMainGeo = new THREE.BoxGeometry(1.8, 0.05, 0.4);
    const fwMain = new THREE.Mesh(fwMainGeo, carbonMat);
    fwMain.position.set(0, -0.1, -2.9);
    fwMain.castShadow = true;
    carGroup.add(fwMain);

    // Front Wing Flaps (Red)
    const fwFlapGeo = new THREE.BoxGeometry(1.6, 0.02, 0.2);
    const fwFlap = new THREE.Mesh(fwFlapGeo, bodyMat);
    fwFlap.position.set(0, -0.05, -2.85);
    fwFlap.rotation.x = -0.2;
    carGroup.add(fwFlap);

    // Rear Wing Lower
    const rwLowerGeo = new THREE.BoxGeometry(1.0, 0.05, 0.3);
    const rwLower = new THREE.Mesh(rwLowerGeo, carbonMat);
    rwLower.position.set(0, 0.5, 1.8);
    carGroup.add(rwLower);

    // Rear Wing Upper (DRS)
    const rwUpperGeo = new THREE.BoxGeometry(1.0, 0.08, 0.4);
    const rwUpper = new THREE.Mesh(rwUpperGeo, bodyMat); // Painted
    rwUpper.position.set(0, 0.9, 1.8);
    rwUpper.castShadow = true;
    carGroup.add(rwUpper);

    // Rear Wing Endplates
    const rwPlateGeo = new THREE.BoxGeometry(0.05, 0.6, 0.6);
    const rwPlateL = new THREE.Mesh(rwPlateGeo, bodyMat);
    rwPlateL.position.set(0.52, 0.7, 1.8);
    carGroup.add(rwPlateL);
    
    const rwPlateR = new THREE.Mesh(rwPlateGeo, bodyMat);
    rwPlateR.position.set(-0.52, 0.7, 1.8);
    carGroup.add(rwPlateR);


    // --- 4. Wheels & Suspension ---
    const wheelRadius = 0.35;
    const wheelWidth = 0.35;
    const wheelGeo = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 32);
    wheelGeo.rotateZ(Math.PI / 2);

    const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, wheelWidth + 0.01, 16);
    rimGeo.rotateZ(Math.PI / 2);

    const wheels = [
      { x: 0.85, z: -1.6 }, // FL
      { x: -0.85, z: -1.6 }, // FR
      { x: 0.85, z: 1.4 },  // RL
      { x: -0.85, z: 1.4 },  // RR
    ];

    wheels.forEach(w => {
        const wheelGroup = new THREE.Group();
        wheelGroup.position.set(w.x, 0.0, w.z);

        // Tire
        const tire = new THREE.Mesh(wheelGeo, tireMat);
        tire.castShadow = true;
        wheelGroup.add(tire);

        // Rim
        const rim = new THREE.Mesh(rimGeo, rimMat);
        wheelGroup.add(rim);

        // Suspension Arms (Simple rods to chassis)
        // Draw a line from wheel center to body center approx
        const armGeo = new THREE.BoxGeometry(Math.abs(w.x) - 0.3, 0.05, 0.1);
        const arm = new THREE.Mesh(armGeo, carbonMat);
        // Position arm halfway
        const armX = (w.x > 0 ? -1 : 1) * (Math.abs(w.x) / 2 - 0.15);
        arm.position.set(armX, 0.1, 0); 
        wheelGroup.add(arm);

        carGroup.add(wheelGroup);
    });

    return carGroup;
  }
}
