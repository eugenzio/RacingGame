import RAPIER from '@dimforge/rapier3d-compat';

export type CollisionCallback = (handle1: number, handle2: number, started: boolean) => void;

// Using Rapier because Ammo.js was giving me headaches with WASM builds.
// This one is super stable and deterministic!
export class PhysicsEngine {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;
  private collisionCallbacks: CollisionCallback[] = [];

  constructor(gravity = { x: 0, y: -9.81, z: 0 }) {
    // Explicit Vector3 because TS was complaining about the object literal
    const g = new RAPIER.Vector3(gravity.x, gravity.y, gravity.z);
    this.world = new RAPIER.World(g);
    this.eventQueue = new RAPIER.EventQueue(true); // true = enable contact force events
  }

  // Need to wait for WASM to load before doing anything
  static async init() {
    await RAPIER.init();
  }

  onCollision(callback: CollisionCallback) {
    this.collisionCallbacks.push(callback);
  }

  step(fixedTimeStep: number) {
    this.world.timestep = fixedTimeStep;
    this.world.step(this.eventQueue);

    // Drain collision events
    this.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
      for (const cb of this.collisionCallbacks) {
        cb(handle1, handle2, started);
      }
    });
  }
}