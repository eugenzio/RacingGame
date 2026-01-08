import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Car } from './Car';
import { InputManager } from '../input/InputManager';

export class CarController {
  car: Car;
  input: InputManager;

  // Tuning
  maxSpeed = 80.0;
  acceleration = 40.0;
  reverseAcceleration = 20.0;
  turnSpeed = 20.0; // Medium setting
  gripFactor = 15.0; // Higher = less drifting
  downforce = 0.5;

  constructor(car: Car, input: InputManager) {
    this.car = car;
    this.input = input;
  }

  update(dt: number) {
    const body = this.car.rigidBody;
    const rot = body.rotation();
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    
    // Local basis vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);

    // Current Velocity
    const velRaw = body.linvel();
    const velocity = new THREE.Vector3(velRaw.x, velRaw.y, velRaw.z);
    const localVelocity = velocity.clone().applyQuaternion(quaternion.clone().invert());
    const speed = localVelocity.z; // Forward speed (negative is forward in our model, actually -Z is forward)

    // 1. Acceleration / Braking
    let driveForce = 0;
    if (this.input.forward) {
        driveForce = this.acceleration; // Go Forward (Positive scalar applied to Forward Vector)
    } else if (this.input.backward) {
        driveForce = -this.reverseAcceleration; // Go Backward
    }

    // Apply drive force
    // Don't accelerate if above max speed (simple cap)
    if (Math.abs(speed) < this.maxSpeed) {
        const force = forward.clone().multiplyScalar(driveForce * body.mass() * dt);
        body.applyImpulse(force, true);
    }

    // 2. Steering
    // Reduce steering effectiveness at high speeds slightly for stability, or increase it?
    // Usually less steering angle at high speed, but for arcade, constant is often fun.
    // We will just scale turn speed.
    let turn = 0;
    if (this.input.left) turn += 1;
    if (this.input.right) turn -= 1;

    // Apply torque
    // Allow turning even at low speeds for better arcade feel, but reduce it when stopped
    let turnScale = 1.0;
    if (Math.abs(speed) < 1.0) turnScale = 0.5; // Reduced steering when stopped/slow

    const turnImpulse = turn * this.turnSpeed * turnScale * body.mass() * dt;
    body.applyTorqueImpulse(new RAPIER.Vector3(0, turnImpulse, 0), true);

    // 3. Lateral Grip (Kill sideways velocity)
    const sideVel = localVelocity.x;
    const gripForce = -sideVel * this.gripFactor * body.mass() * dt;
    const lateralImpulse = right.clone().multiplyScalar(gripForce);
    body.applyImpulse(lateralImpulse, true);

    // 4. Downforce 
    // REMOVED: Applying extra downforce manually pushes the rigid body into the ground collider,
    // causing the physics engine to aggressively correct it, leading to "jitter" or "shaking".
    // Gravity is sufficient for this arcade physics model.

    // 5. Angular Damping / Upright Stability
    // Aggressively damp angular velocity on X and Z to prevent rolling/pitching shake
    const angVel = body.angvel();
    // Retain only 50% of angular velocity per frame on X/Z (strong damping)
    body.setAngvel(new RAPIER.Vector3(angVel.x * 0.5, angVel.y * 0.95, angVel.z * 0.5), true);
  }

  updateCoasting(dt: number) {
    const body = this.car.rigidBody;
    const rot = body.rotation();
    const quaternion = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w);
    
    // Local basis vectors
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion);

    // Current Velocity
    const velRaw = body.linvel();
    const velocity = new THREE.Vector3(velRaw.x, velRaw.y, velRaw.z);
    const localVelocity = velocity.clone().applyQuaternion(quaternion.clone().invert());

    // Lateral Grip (still applied to prevent spinning out wildly)
    const sideVel = localVelocity.x;
    const gripForce = -sideVel * this.gripFactor * body.mass() * dt;
    const lateralImpulse = right.clone().multiplyScalar(gripForce);
    body.applyImpulse(lateralImpulse, true);

    // Angular Damping
    const angVel = body.angvel();
    body.setAngvel(new RAPIER.Vector3(angVel.x * 0.5, angVel.y * 0.95, angVel.z * 0.5), true);
  }

  getSpeedKmH(): number {
    const vel = this.car.rigidBody.linvel();
    const speedMs = Math.sqrt(vel.x*vel.x + vel.y*vel.y + vel.z*vel.z);
    return Math.floor(speedMs * 3.6);
  }
}
