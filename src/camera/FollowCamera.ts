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

  constructor(camera: THREE.PerspectiveCamera, target: THREE.Object3D) {
    this.camera = camera;
    this.target = target;
    this.previousPosition.copy(target.position);
    this.smoothedOrientation.copy(target.quaternion);
    this.smoothedPosition.copy(target.position);
  }

  update(dt: number) {
    if (!this.target) return;

    // 1. Update Ghost Target (Low Pass Filter)
    // High factor (25.0) = very tight tracking, minimal lag, but filters high freq jitter
    this.smoothedOrientation.slerp(this.target.quaternion, dt * 25.0);
    this.smoothedPosition.lerp(this.target.position, dt * 25.0);

    // 2. Smoothed Speed Calculation
    const instantSpeed = this.smoothedPosition.distanceTo(this.previousPosition) / dt;
    this.previousPosition.copy(this.smoothedPosition);
    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, instantSpeed, dt * 10.0);

    // 3. Dynamic FOV (Minimal)
    const targetFOV = 60 + Math.min(this.currentSpeed * 0.1, 5); 
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, dt * 5.0);
    this.camera.updateProjectionMatrix();

    // 4. Calculate Ideal Camera Position (Rigidly attached to Ghost)
    const idealOffset = new THREE.Vector3(0, this.height, this.distance);
    idealOffset.applyQuaternion(this.smoothedOrientation);
    idealOffset.add(this.smoothedPosition);

    // 5. Apply Position (SNAP - No Lerp)
    // This prevents the "rubber banding" or "getting far" effect. 
    // The camera is rigidly locked to the smoothed ghost.
    this.camera.position.copy(idealOffset);

    // 6. Look At (Smoothed)
    const trueForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.smoothedOrientation);
    const anticipation = trueForward.multiplyScalar(Math.min(this.currentSpeed * 0.1, 5));

    const finalLookTarget = this.smoothedPosition.clone().add(this.lookAtOffset).add(anticipation);
    this.camera.lookAt(finalLookTarget);
  }
}
