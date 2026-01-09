import RAPIER from '@dimforge/rapier3d-compat';

// Using Rapier because Ammo.js was giving me headaches with WASM builds.
// This one is super stable and deterministic!
export class PhysicsEngine {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;

  constructor(gravity = { x: 0, y: -9.81, z: 0 }) {
    // Explicit Vector3 because TS was complaining about the object literal
    const g = new RAPIER.Vector3(gravity.x, gravity.y, gravity.z);
    this.world = new RAPIER.World(g);
    this.eventQueue = new RAPIER.EventQueue();
  }

  // Need to wait for WASM to load before doing anything
  static async init() {
    await RAPIER.init();
  }

  step(fixedTimeStep: number) {
    this.world.timestep = fixedTimeStep;
    this.world.step(this.eventQueue);
  }
}