import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsEngine {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;

  constructor(gravity = { x: 0, y: -9.81, z: 0 }) {
    this.world = new RAPIER.World(gravity);
    this.eventQueue = new RAPIER.EventQueue();
  }

  static async init() {
    await RAPIER.init();
  }

  step(fixedTimeStep: number) {
    this.world.timestep = fixedTimeStep;
    this.world.step(this.eventQueue);
  }
}
