import * as THREE from 'three';

export class FollowCamera {
  camera: THREE.PerspectiveCamera;
  target: THREE.Object3D;
  
  // Settings
  distance = 4.0;
  height = 1.8;
  lerpSpeed = 20.0; // Very tight follow to prevent lag
  lookAtOffset = new THREE.Vector3(0, 0.5, 0); 
  
  previousPosition = new THREE.Vector3();
  currentSpeed = 0; 
  
  // Ghost Target
  smoothedOrientation = new THREE.Quaternion();
  smoothedPosition = new THREE.Vector3();

  // Camera Modes
  isFirstPerson = false;
  isVictory = false;
  
  // 3rd Person Config
  defaultDistance = 4.0;
  defaultHeight = 1.8;
  
  // 1st Person Config (Driver Eye)
  fpDistance = -0.15; 
  fpHeight = 0.65; 

  constructor(camera: THREE.PerspectiveCamera, target: THREE.Object3D) {
    this.camera = camera;
    this.target = target;
    this.previousPosition.copy(target.position);
    this.smoothedOrientation.copy(target.quaternion);
    this.smoothedPosition.copy(target.position);
  }

  toggleMode() {
    if (this.isVictory) return;
    this.isFirstPerson = !this.isFirstPerson;
    // Reset smoothing to prevent camera flying between positions
    this.smoothedPosition.copy(this.target.position);
    this.smoothedOrientation.copy(this.target.quaternion);
  }

  update(dt: number) {
    if (!this.target) return;

    if (this.isVictory) {
        // Exponential pull back
        const growthRate = 0.5; 
        this.defaultDistance += this.defaultDistance * dt * growthRate;
        this.defaultHeight += this.defaultHeight * dt * growthRate;
    }

    // 1. Update Ghost Target (Low Pass Filter)
    // High factor (25.0) = very tight tracking, minimal lag, but filters high freq jitter
    this.smoothedOrientation.slerp(this.target.quaternion, dt * 25.0);
    this.smoothedPosition.lerp(this.target.position, dt * 25.0);

    // 2. Smoothed Speed Calculation
    const instantSpeed = this.smoothedPosition.distanceTo(this.previousPosition) / dt;
    this.previousPosition.copy(this.smoothedPosition);
    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, instantSpeed, dt * 10.0);

    // 3. Dynamic FOV (Minimal)
    const baseFOV = this.isFirstPerson ? 75 : 60; // Wider FOV for cockpit
    const targetFOV = baseFOV + Math.min(this.currentSpeed * 0.1, 5); 
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 5.0);
    this.camera.updateProjectionMatrix();

    // 4. Calculate Ideal Camera Position (Rigidly attached to Ghost)
    const targetDist = this.isFirstPerson ? this.fpDistance : this.defaultDistance;
    const targetHeight = this.isFirstPerson ? this.fpHeight : this.defaultHeight;

    const idealOffset = new THREE.Vector3(0, targetHeight, targetDist);
    idealOffset.applyQuaternion(this.smoothedOrientation);
    idealOffset.add(this.smoothedPosition);

    // 5. Apply Position (SNAP - No Lerp)
    this.camera.position.copy(idealOffset);

    // 6. Look At (Smoothed)
    const trueForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.smoothedOrientation);
    const anticipation = trueForward.multiplyScalar(Math.min(this.currentSpeed * 0.1, 5));

    let lookPoint: THREE.Vector3;
    if (this.isFirstPerson) {
        // Look 100m ahead in direction of car
        const farPoint = new THREE.Vector3(0, 0, -100);
        farPoint.applyQuaternion(this.smoothedOrientation);
        lookPoint = this.smoothedPosition.clone().add(farPoint).add(anticipation);
    } else {
        lookPoint = this.smoothedPosition.clone().add(this.lookAtOffset).add(anticipation);
    }

    this.camera.lookAt(lookPoint);
  }

  startVictorySequence() {
      this.isFirstPerson = false;
      this.isVictory = true;
      // Start from current values (standard 3rd person if was in 1st)
      if (this.defaultDistance < 4.0) this.defaultDistance = 4.0;
      if (this.defaultHeight < 1.8) this.defaultHeight = 1.8;
      
      this.lerpSpeed = 1.0; // Very slow drift
      // Reset smoothing to avoid snap
      this.smoothedPosition.copy(this.target.position);
  }
}
