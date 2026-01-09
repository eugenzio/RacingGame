import { PhysicsEngine } from './physics';
import { GameScene } from './scene';
import { Car } from './car/Car';
import { CarController } from './car/CarController';
import { FollowCamera } from './camera/FollowCamera';
import { InputManager } from './input/InputManager';
import { HUD } from './ui/hud';
import { SoundManager } from './audio/SoundManager';
import { MapManager } from './maps/MapManager';
import { UIManager } from './ui/UIManager';
import * as THREE from 'three';
import { io, Socket } from 'socket.io-client';

// The heartbeat of the game.
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
  uiManager: UIManager;

  // Multiplayer
  socket: Socket | null = null;
  remoteCars: Map<string, Car> = new Map();
  lastEmitTime: number = 0;
  
  // Game State
  isRacing = false;
  raceFinished = false;
  
  // Lap Logic
  totalLaps = 3;
  currentLap = 1;
  lapStartTime = 0;
  lastLapTime = 0;
  bestLapTime = Infinity;
  currentLapTime = 0;
  lapStarted = false;
  halfwayPointReached = false;
  lastCarZ = 0;
  wasCHeld = false;
  
  // Physics Timing (Fixed Timestep)
  // Accumulator logic for time stepping – standard GafferOnGames approach.
  // Crucial for deterministic physics even if frame rate drops.
  lastTime = 0;
  physicsAccumulator = 0;
  fixedTimeStep = 1 / 60;
  
  // FPS
  frameCount = 0;
  lastFpsTime = 0;
  raceStartTime = 0;

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
    this.uiManager = null!;
  }

  async init() {
    console.log("Initializing Game...");
    
    // 1. Initialize Physics & Map (Background loading)
    try {
        console.log("Initializing Physics...");
        await PhysicsEngine.init();
        console.log("Physics WASM loaded.");
        
        this.physics = new PhysicsEngine();
        console.log("Physics World created.");

        this.mapManager = new MapManager(this.scene.scene, this.physics);
        console.log("Loading Map...");
        // Default map for the background visuals while in menu
        const mapData = await this.mapManager.loadMap('standard');
        console.log("Map Loaded.");

        // Create Local Car (Visuals + Physics)
        this.car = new Car(this.scene.scene, this.physics, mapData.spawnPosition, false);
        if (mapData.spawnRotation) {
            this.car.rigidBody.setRotation(mapData.spawnRotation, true);
        }
        console.log("Car created.");
        
        this.controller = new CarController(this.car, this.input);
        this.camera = new FollowCamera(this.scene.camera, this.car.mesh);

        // 2. Connect to Server (Optional until multiplayer selected, but doing it early for now)
        // this.initSocket();

        // 3. Setup UI Listeners
        this.uiManager = new UIManager('#ui-root', (config) => {
            this.handleGameStart(config);
        });
        console.log("UI Setup complete. Starting loop.");

        // 4. Start Render Loop
        requestAnimationFrame(this.loop);
        
    } catch (e) {
        console.error("Game Init Failed:", e);
        alert("Game failed to initialize. See console for details.\n" + e);
    }
  }

  handleGameStart(config: any) {
      console.log('Starting Game with config:', config);
      
      // If multiplayer, we hook up the socket events now
      if (config.mode === 'MULTI') {
          this.initSocket();
          // join room logic would go here ideally
          if (config.roomCode) {
              this.socket?.emit('joinRoom', config.roomCode);
          } else if (config.isHost) {
              // already created via stub, just connect socket logic
          }
      }

      // Map switching could happen here:
      // if (config.map !== 'standard') this.mapManager.loadMap(config.map)...

      this.startSequence();
  }

  initSocket() {
    if (this.socket) return;
    this.socket = io('http://localhost:3000');

    this.socket.on('connect', () => {
        console.log('Connected to server:', this.socket?.id);
    });

    this.socket.on('playerMoved', (data) => {
        if (this.remoteCars.has(data.id)) {
            const car = this.remoteCars.get(data.id);
            // Interpolate remote cars smoothly
            car?.updateRemoteState(
                { x: data.x, y: data.y, z: data.z },
                { x: data.qx, y: data.qy, z: data.qz, w: data.qw }
            );
        }
    });

    this.socket.on('newPlayer', (info) => {
        this.addRemoteCar(info.id, info);
    });

    this.socket.on('playerDisconnected', (id) => {
        this.removeRemoteCar(id);
    });
  }

  startSequence() {
      // Init Sound
      this.sound.init();
      this.sound.startEngine();

      const lightsContainer = document.getElementById('start-lights');
      if (lightsContainer) {
          lightsContainer.style.display = 'flex';
          const lights = lightsContainer.querySelectorAll('.light');
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
                  }, Math.random() * 1000 + 500);
              }
          }, 1000);
      } else {
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

  addRemoteCar(id: string, info: any) {
      const newCar = new Car(this.scene.scene, this.physics, {x: info.x, y: info.y, z: info.z}, true);
      this.remoteCars.set(id, newCar);
  }

  removeRemoteCar(id: string) {
    if (this.remoteCars.has(id)) {
      const carToRemove = this.remoteCars.get(id);
      if (carToRemove) {
        this.scene.scene.remove(carToRemove.mesh);
      }
      this.remoteCars.delete(id);
    }
  }

  loop = (time: number) => {
    requestAnimationFrame(this.loop);
    
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;
    const safeDt = Math.min(dt, 0.1); // Prevent huge jumps if tab is inactive

    // Fixed timestep for physics (essential for stability!)
    this.physicsAccumulator += safeDt;
    while (this.physicsAccumulator >= this.fixedTimeStep) {
        // Save state for interpolation BEFORE stepping
        if (this.car) this.car.saveState();
        this.physics.step(this.fixedTimeStep);
        this.physicsAccumulator -= this.fixedTimeStep;
    }
    
    if (this.car) {
        // Interpolate visual mesh between previous physics state and current one
        // eliminating the jitter.
        this.car.update(this.physicsAccumulator / this.fixedTimeStep);
        this.scene.updateSunPosition(this.car.mesh.position);
        
        // Background rotation if not racing (Menu Mode)
        if (!this.isRacing && !this.raceFinished) {
             this.sound.updateEngine(0); // Idle
        } else {
            if (!this.raceFinished) {
                this.controller.update(safeDt);
            } else {
                this.controller.updateCoasting(safeDt);
            }
            
            const speed = this.controller.getSpeedKmH();
            this.hud.updateSpeed(speed);
            const rpm = Math.min(Math.abs(speed) / 320, 1.0);
            this.sound.updateEngine(rpm);
        }

        // Throttle network updates to ~30hz to save bandwidth
        if (this.socket && this.isRacing && (Date.now() - this.lastEmitTime > 30)) {
             const t = this.car.rigidBody.translation();
             const r = this.car.rigidBody.rotation();
             this.socket.emit('playerMovement', {
                 x: t.x, y: t.y, z: t.z,
                 qx: r.x, qy: r.y, qz: r.z, qw: r.w
             });
             this.lastEmitTime = Date.now();
        }
    }

    this.remoteCars.forEach(car => car.update());
    
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
      const totalTimeMs = now - this.raceStartTime;
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