import { PhysicsEngine } from './physics';
import { GameScene } from './scene';
import { Car } from './car/Car';
import { CarController } from './car/CarController';
import { FollowCamera } from './camera/FollowCamera';
import { InputManager } from './input/InputManager';
import { HUD } from './ui/hud';
import { SoundManager } from './audio/SoundManager';
import { MapManager } from './maps/MapManager';
import * as THREE from 'three';

class Game {
  physics: PhysicsEngine;
  scene: GameScene;
  mapManager: MapManager;
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
  
  // Race Logic
  totalLaps = 3;
  currentLap = 1;
  raceStartTime = 0;
  raceFinished = false;
  
  halfwayPointReached = false;
  lastCarZ = 0;
  wasCHeld = false;

  constructor() {
    this.scene = new GameScene();
    this.input = new InputManager();
    this.hud = new HUD();
    this.sound = new SoundManager();
    
    this.physics = null!;
    this.car = null!;
    this.controller = null!;
    this.camera = null!;
    this.mapManager = null!;
  }

  async init() {
    console.log("Initializing Game...");
    try {
        console.log("Initializing Physics...");
        await PhysicsEngine.init();
        console.log("Physics WASM loaded.");
        
        this.physics = new PhysicsEngine();
        console.log("Physics World created.");

        this.mapManager = new MapManager(this.scene.scene, this.physics);
        console.log("Loading Map...");
        const mapData = await this.mapManager.loadMap('standard');
        console.log("Map Loaded.");

        this.car = new Car(this.scene.scene, this.physics, mapData.spawnPosition);
        if (mapData.spawnRotation) {
            this.car.rigidBody.setRotation(mapData.spawnRotation, true);
        }
        console.log("Car created.");
        
        this.controller = new CarController(this.car, this.input);
        this.camera = new FollowCamera(this.scene.camera, this.car.mesh);

        this.setupUI();
        console.log("UI Setup complete. Starting loop.");
        requestAnimationFrame(this.loop);
    } catch (e) {
        console.error("Game Init Failed:", e);
        alert("Game failed to initialize. See console for details.\n" + e);
    }
  }

  setupUI() {
    const startBtn = document.getElementById('start-button');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const lapInput = document.getElementById('lap-input') as HTMLInputElement;
            if (lapInput) {
                const laps = lapInput.valueAsNumber;
                if (!isNaN(laps) && laps > 0) {
                    this.totalLaps = laps;
                    this.hud.updateLapCounter(this.currentLap, this.totalLaps);
                }
            }
            
            const lobby = document.getElementById('lobby-screen');
            if (lobby) lobby.style.display = 'none';
            
            // Init Sound
            this.sound.init();
            this.sound.startEngine();

            startBtn.blur();
            this.startSequence();
        });
    }

    const restartBtn = document.getElementById('restart-button');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            window.location.reload();
        });
    }
  }

  startSequence() {
      const lightsContainer = document.getElementById('start-lights');
      if (lightsContainer) {
          lightsContainer.style.display = 'flex';
          const lights = lightsContainer.querySelectorAll('.light');
          
          // Reset lights
          lights.forEach((l: any) => l.style.background = '#222');

          let step = 0;
          const interval = setInterval(() => {
              if (step < 5) {
                  // Turn on red light
                  (lights[step] as HTMLElement).style.background = '#ff0000';
                  this.sound.playCountdownBeep();
                  step++;
              } else {
                  // GO!
                  clearInterval(interval);
                  setTimeout(() => {
                      lights.forEach((l: any) => l.style.background = '#222');
                      lightsContainer.style.display = 'none';
                      this.startGame();
                  }, Math.random() * 1000 + 500); // Random delay 0.5 - 1.5s
              }
          }, 1000);
      } else {
          // Fallback if no lights UI
          this.startGame();
      }
  }

  startGame() {
      this.isRacing = true;
      this.raceStartTime = performance.now();
      this.lapStartTime = this.raceStartTime;
      this.lapStarted = true;
      this.currentLap = 1;
      this.hud.updateLapCounter(this.currentLap, this.totalLaps);
  }

  loop = (time: number) => {
    requestAnimationFrame(this.loop);
    
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const safeDt = Math.min(dt, 0.1);

    this.physicsAccumulator += safeDt;
    while (this.physicsAccumulator >= this.fixedTimeStep) {
        if (this.car) this.car.saveState();
        this.physics.step(this.fixedTimeStep);
        this.physicsAccumulator -= this.fixedTimeStep;
    }
    
    if (this.car) {
        this.car.update(this.physicsAccumulator / this.fixedTimeStep);
        // Shadows follow car
        this.scene.updateSunPosition(this.car.mesh.position);
        
        if (this.isRacing) {
            if (!this.raceFinished) {
                this.controller.update(safeDt);
            } else {
                this.controller.updateCoasting(safeDt);
            }
            
            const speed = this.controller.getSpeedKmH();
            this.hud.updateSpeed(speed);
            
            // Engine Sound
            // Normalize RPM approx based on speed (0-300kmh -> 0-1)
            const rpm = Math.min(Math.abs(speed) / 320, 1.0);
            this.sound.updateEngine(rpm);
        } else {
             // Idle sound
             this.sound.updateEngine(0);
        }
    }
    
    if (this.isRacing) {
      if (this.lapStarted) {
          this.currentLapTime = time - this.lapStartTime;
          this.hud.updateLapTimes(this.currentLapTime, this.lastLapTime, this.bestLapTime);
      }
      this.checkLapLine();
    }

    if (this.input.changeView && !this.wasCHeld && this.camera) {
        this.camera.toggleMode();
    }
    this.wasCHeld = this.input.changeView;

    if (this.camera) this.camera.update(safeDt);

    this.frameCount++;
    if (time - this.lastFpsTime >= 1000) {
        this.hud.updateFPS(this.frameCount);
        this.frameCount = 0;
        this.lastFpsTime = time;
    }

    if (this.input.reset) {
        const body = this.car.rigidBody;
        body.setLinvel({x:0,y:0,z:0}, true);
        body.setAngvel({x:0,y:0,z:0}, true);
        body.setRotation({x:0,y:0,z:0,w:1}, true);
    }

    this.scene.render();
  }

  checkLapLine() {
      const currentZ = this.car.rigidBody.translation().z;
      
      // Checkpoint: Must reach -100 (far side of track)
      if (currentZ < -100) this.halfwayPointReached = true;

      // Finish Line at Z=50
      // Driving direction: 60 -> 50 -> -100.
      // So we cross when decreasing past 50.
      if (this.lastCarZ > 50 && currentZ <= 50 && this.halfwayPointReached) {
          this.onCrossFinishLine();
      }
      
      this.lastCarZ = currentZ;
  }

  onCrossFinishLine() {
      if (!this.halfwayPointReached) return;

      const now = performance.now();
      const lapTime = now - this.lapStartTime;
      
      this.lastLapTime = lapTime;
      if (lapTime < this.bestLapTime) {
          this.bestLapTime = lapTime;
      }

      if (this.currentLap >= this.totalLaps) {
          this.finishRace(now);
      } else {
          this.currentLap++;
          this.hud.updateLapCounter(this.currentLap, this.totalLaps);
          this.lapStartTime = now;
          this.halfwayPointReached = false;
      }
  }

  finishRace(now: number) {
      this.raceFinished = true;
      // Note: isRacing remains true so physics continues (car coasts)
      
      const totalTimeMs = now - this.raceStartTime;
      
      // Camera Zoom Out
      this.camera.startVictorySequence();

      const minutes = Math.floor(totalTimeMs / 60000);
      const seconds = Math.floor((totalTimeMs % 60000) / 1000);
      const millis = Math.floor(totalTimeMs % 1000);
      const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;

      setTimeout(() => {
          const results = document.getElementById('results-screen');
          const timeDisplay = document.getElementById('final-time-display');
          
          if (results) results.style.display = 'flex';
          if (timeDisplay) timeDisplay.textContent = timeStr;
          
          const dashboard = document.getElementById('dashboard-container');
          const lapTimer = document.getElementById('lap-timer-container');
          if (dashboard) dashboard.style.display = 'none';
          if (lapTimer) lapTimer.style.display = 'none';
          
          // Stop physics/sound after delay if desired? 
          // For now, let it run in background looks cool
      }, 2000);
  }

  resetCar(pos?: THREE.Vector3, rot?: THREE.Quaternion) {
    const body = this.car.rigidBody;
    if (pos) body.setTranslation(pos, true);
    if (rot) body.setRotation(rot, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    
    this.lapStartTime = performance.now();
    this.currentLapTime = 0;
    this.halfwayPointReached = false;
    this.lastCarZ = pos ? pos.z : 0;
  }
}

const game = new Game();
window.addEventListener('load', () => {
    game.init();
});
