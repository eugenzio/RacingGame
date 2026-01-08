import RAPIER from '@dimforge/rapier3d-compat';

export class PhysicsEngine {
  world: RAPIER.World;
  eventQueue: RAPIER.EventQueue;

  constructor(gravity = { x: 0, y: -9.81, z: 0 }) {
    const g = new RAPIER.Vector3(gravity.x, gravity.y, gravity.z);
    this.world = new RAPIER.World(g);
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
