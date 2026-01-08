import { PhysicsEngine } from './physics';
import { GameScene } from './scene';
import { Track } from './track/Track';
import { Car } from './car/Car';
import { CarController } from './car/CarController';
import { FollowCamera } from './camera/FollowCamera';
import { InputManager } from './input/InputManager';
import { HUD } from './ui/hud';
import { SoundManager } from './audio/SoundManager';
import * as THREE from 'three';

class Game {
  physics: PhysicsEngine;
  scene: GameScene;
  track: Track;
  car: Car;
  controller: CarController;
  camera: FollowCamera;
  input: InputManager;
  hud: HUD;
  sound: SoundManager;

  // Time
  lastTime = 0;
  physicsAccumulator = 0;
  fixedTimeStep = 1 / 60;
  
  // FPS
  frameCount = 0;
  lastFpsTime = 0;

  // Lap Timer
  lapStartTime = 0;
  lastLapTime = 0;
  bestLapTime = Infinity;
  currentLapTime = 0;
  lapStarted = false;
  isRacing = false;
  isStarting = false;
  
  // Checkpoint system to prevent cheating (simple check: must reach half track)
  halfwayPointReached = false;

  constructor() {
    this.scene = new GameScene();
    this.input = new InputManager();
    this.hud = new HUD();
    this.sound = new SoundManager();
    
    // Placeholder until init is called
    this.physics = null!;
    this.track = null!;
    this.car = null!;
    this.controller = null!;
    this.camera = null!;
  }

  async init() {
    await PhysicsEngine.init();
    this.physics = new PhysicsEngine();

    // Create World Objects
    this.track = new Track(this.scene.scene, this.physics);
    this.car = new Car(this.scene.scene, this.physics, { x: 0, y: 0.1, z: 55 });
    this.controller = new CarController(this.car, this.input);
    this.camera = new FollowCamera(this.scene.camera, this.car.mesh);

    // Bind UI
    const startBtn = document.getElementById('start-button');
    if (startBtn) {
      startBtn.onclick = () => this.startRace();
    }

    // Initial render
    this.scene.render();

    // Start Loop
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  async startRace() {
    if (this.isStarting || this.isRacing) return;
    this.isStarting = true;

    // Audio Init
    await this.sound.init();
    this.sound.startEngine();

    const lobby = document.getElementById('lobby-screen');
    const lightsContainer = document.getElementById('start-lights');
    const lights = document.querySelectorAll('.light'); // Select all light divs

    if (lobby) lobby.style.display = 'none';

    if (lightsContainer && lights.length === 5) {
      lightsContainer.style.display = 'flex';
      
      // Reset lights to black
      lights.forEach((l) => (l as HTMLElement).style.background = '#222');

      // Sequence: 5 Red Lights
      for (let i = 0; i < 5; i++) {
        await new Promise(r => setTimeout(r, 1000));
        (lights[i] as HTMLElement).style.background = '#ff0000';
        (lights[i] as HTMLElement).style.boxShadow = '0 0 30px #ff0000';
        this.sound.playCountdownBeep();
      }
      
      // Hold for random time (Start anticipation)
      const holdTime = 1000 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, holdTime));
      
      // LIGHTS OUT AND AWAY WE GO!
      lights.forEach((l) => {
          (l as HTMLElement).style.background = '#222';
          (l as HTMLElement).style.boxShadow = 'none';
      });
      
      // Maybe a GO beep?
      // this.sound.playGoBeep(); 

      setTimeout(() => {
        lightsContainer.style.display = 'none';
      }, 200); // Small delay to register visual "OFF", then gone
    } else {
        // Fallback if UI missing
        await new Promise(r => setTimeout(r, 1000));
    }

    this.isRacing = true;
    this.isStarting = false;
    this.lapStartTime = performance.now();
    this.lapStarted = true;
  }

  loop(time: number) {
    requestAnimationFrame((t) => this.loop(t));

    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    const safeDt = Math.min(dt, 0.1);

    if (this.isRacing) {
      // Physics Step
      this.physicsAccumulator += safeDt;
      while (this.physicsAccumulator >= this.fixedTimeStep) {
        this.car.saveState(); // Save previous physics state for interpolation
        this.physics.step(this.fixedTimeStep);
        this.controller.update(this.fixedTimeStep);
        this.physicsAccumulator -= this.fixedTimeStep;

        // Drain Collision Events
        this.physics.eventQueue.drainCollisionEvents((handle1, handle2, started) => {
            if (!started) return;
            const carHandle = this.car.collider.handle;
            if (handle1 === carHandle || handle2 === carHandle) {
                // Crash detected!
                // Intensity based on speed roughly
                const speed = Math.abs(this.controller.getSpeedKmH());
                if (speed > 10) {
                    const intensity = Math.min(speed / 100, 1.0);
                    this.sound.playCrash(intensity);
                }
            }
        });
      }

      // Calculate interpolation factor (0.0 to 1.0)
      // This represents how far we are between the last physics step and the next one
      const alpha = this.physicsAccumulator / this.fixedTimeStep;

      // Update Visuals (Interpolated)
      this.car.update(alpha);
      const speedKmH = this.controller.getSpeedKmH();
      this.hud.updateSpeed(speedKmH);

      // --- Audio Updates ---
      const speedRatio = Math.abs(speedKmH) / this.controller.maxSpeed;
      this.sound.updateEngine(speedRatio);

      // Brake Sound
      // If pressing back while moving forward, or hard turning?
      // Simple: if pressing 'S' (backward) and speed > 5
      if (this.input.backward && speedKmH > 5) {
          this.sound.startBrake();
      } else {
          this.sound.stopBrake();
      }


      // Lap Timer
      if (this.lapStarted) {
          this.currentLapTime = time - this.lapStartTime;
          this.hud.updateLapTimes(this.currentLapTime, this.lastLapTime, this.bestLapTime);
      }
      this.checkLapLine();
    }

    // Always update camera for a smooth lobby view or chase
    this.camera.update(safeDt);

    // FPS Counter
    this.frameCount++;
    if (time - this.lastFpsTime >= 1000) {
        this.hud.updateFPS(this.frameCount);
        this.frameCount = 0;
        this.lastFpsTime = time;
    }

    // Restart if R is pressed
    if (this.input.reset) {
        this.resetCar();
    }

    this.scene.render();
  }

  // Helper to store previous position for line crossing
  lastCarZ = 55;

  checkLapLine() {
      const currentZ = this.car.rigidBody.translation().z;
      
      // Line is at Z = 50.
      // Driving Direction: Towards Negative Z.
      // Crossing: Z goes from > 50 to <= 50.
      
      if (this.lastCarZ > 50 && currentZ <= 50) {
          // Check X bounds (Track is roughly centered at 0, width 15)
          const currentX = this.car.rigidBody.translation().x;
          if (Math.abs(currentX) < 20) {
              this.onCrossFinishLine();
          }
      }
      
      this.lastCarZ = currentZ;
  }

  onCrossFinishLine() {
      // First crossing (Start of Lap 1)
      if (!this.halfwayPointReached) {
          // We just started the game and crossed the line immediately.
          // Reset timer for Lap 1.
          this.lapStartTime = performance.now();
          this.halfwayPointReached = true; // Enable next lap validation
          // Actually, halfway needs to be reset for the NEW lap.
          // So:
          // 1. Game Start: Halfway=false.
          // 2. Drive 5m -> Cross Line. This handler fires.
          // 3. We Reset Timer. We set Halfway=false (reset for lap 1).
          // 4. Drive lap... Halfway becomes true at -150.
          // 5. Cross Line again. Handler fires. Halfway is true. Valid Lap!
          
          this.halfwayPointReached = false;
          return;
      }

      // Valid Lap Complete
      if (this.halfwayPointReached) {
          const now = performance.now();
          const lapTime = now - this.lapStartTime;
          
          this.lastLapTime = lapTime;
          if (lapTime < this.bestLapTime) {
              this.bestLapTime = lapTime;
          }

          // Start New Lap
          this.lapStartTime = now;
          this.halfwayPointReached = false;
      }
  }

  resetCar() {
    const body = this.car.rigidBody;
    body.setTranslation({ x: 0, y: 1, z: 55 }, true);
    body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    
    // Reset Lap
    this.lapStartTime = performance.now();
    this.currentLapTime = 0;
    this.halfwayPointReached = false;
    this.lastCarZ = 55;
  }
}

// Start Game
const game = new Game();
window.addEventListener('load', () => {
    game.init();
});
