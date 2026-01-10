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
import { MultiplayerManager, CAR_COLORS } from './net/MultiplayerManager';
import { Leaderboard, RacerInfo } from './ui/Leaderboard';
import * as THREE from 'three';

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
  leaderboard: Leaderboard;

  // Multiplayer state
  isMultiplayer = false;
  localColorIndex = 0;

  // Multiplayer
  socket: any = null;
  remoteCars: Map<string, Car> = new Map();
  lastEmitTime: number = 0;
  
  // Game State
  isRacing = false;
  raceFinished = false;

  // Multiplayer finish state
  mpCountdownActive = false;
  mpCountdownValue = 10;
  mpCountdownInterval: number | null = null;
  mpRetired = false;
  mpLocalFinished = false;
  
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
    this.leaderboard = new Leaderboard();

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

        // Setup collision handling for car-to-car bouncing
        this.setupCollisionHandling();

        // 2. Connect to Server (Optional until multiplayer selected, but doing it early for now)
        // this.initSocket();

        // 3. Setup UI Listeners
        this.uiManager = new UIManager('#ui-root', (config) => {
            this.handleGameStart(config);
        });
        this.uiManager.setMapManager(this.mapManager);
        console.log("UI Setup complete. Starting loop.");

        // 4. Start Render Loop
        requestAnimationFrame(this.loop);
        
    } catch (e) {
        console.error("Game Init Failed:", e);
        alert("Game failed to initialize. See console for details.\n" + e);
    }
  }

  async handleGameStart(config: any) {
      console.log('Starting Game with config:', config);

      // Load selected map (if different from current)
      const selectedMap = config.map || 'standard';
      console.log('Loading map:', selectedMap);
      const mapData = await this.mapManager.loadMap(selectedMap);

      // If multiplayer, hook up socket events using shared MultiplayerManager
      if (config.mode === 'MULTI') {
          this.isMultiplayer = true;
          this.initMultiplayerSocket();

          // Get local player's info from server (includes spawn position)
          const mp = MultiplayerManager.getInstance();
          const localPlayer = mp.players.get(mp.getSocket()?.id || '');
          this.localColorIndex = mp.getLocalColorIndex();
          const localColor = CAR_COLORS[this.localColorIndex];

          // Recreate local car at server-assigned spawn position
          if (this.car) {
              this.scene.scene.remove(this.car.mesh);
              this.physics.world.removeRigidBody(this.car.rigidBody);
          }

          // Use server-assigned position or fallback
          const spawnPos = localPlayer
              ? { x: localPlayer.x, y: localPlayer.y, z: localPlayer.z }
              : { x: 0, y: 0.5, z: 50 };

          this.car = new Car(this.scene.scene, this.physics, spawnPos, false, mp.username, localColor);
          this.controller = new CarController(this.car, this.input);
          this.camera = new FollowCamera(this.scene.camera, this.car.mesh);

          // Re-setup collision handling
          this.setupCollisionHandling();

          // Show leaderboard
          this.leaderboard.show();
      } else {
          this.isMultiplayer = false;
          this.leaderboard.hide();

          // Singleplayer: recreate car at map spawn position
          if (this.car) {
              this.scene.scene.remove(this.car.mesh);
              this.physics.world.removeRigidBody(this.car.rigidBody);
          }

          this.car = new Car(this.scene.scene, this.physics, mapData.spawnPosition, false);
          if (mapData.spawnRotation) {
              this.car.rigidBody.setRotation(mapData.spawnRotation, true);
          }
          this.controller = new CarController(this.car, this.input);
          this.camera = new FollowCamera(this.scene.camera, this.car.mesh);

          // Re-setup collision handling
          this.setupCollisionHandling();
      }

      this.startSequence();
  }

  initMultiplayerSocket() {
    // Get socket from shared MultiplayerManager (already connected during room create/join)
    const mp = MultiplayerManager.getInstance();
    this.socket = mp.getSocket();

    if (!this.socket) {
      console.error('No socket connection available');
      return;
    }

    // Add existing players from the room
    mp.getPlayers().forEach(player => {
      if (player.id !== this.socket?.id) {
        this.addRemoteCar(player.id, player);
      }
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

    // Multiplayer race finish events
    this.socket.on('raceWinner', (data: { winnerId: string; winnerName: string; winnerTime: number }) => {
        console.log(`${data.winnerName} won the race!`);

        // If we're the winner, we already finished - don't show countdown
        if (data.winnerId === this.socket?.id) return;

        // Start 10-second countdown for remaining players
        this.startMpCountdown();
    });

    this.socket.on('playerFinishedRace', (data: { id: string; name: string; position: number; time: number }) => {
        console.log(`${data.name} finished in P${data.position}`);
    });

    this.socket.on('raceResults', (results: Array<{ id: string; name: string; position: number; time: number | null; status: string }>) => {
        console.log('Race results:', results);
        this.showMpResults(results);
    });
  }

  startMpCountdown() {
    if (this.mpLocalFinished) return; // Already finished, no countdown needed

    this.mpCountdownActive = true;
    this.mpCountdownValue = 10;

    const countdownEl = document.getElementById('mp-countdown');
    const numberEl = document.getElementById('mp-countdown-number');

    if (countdownEl) countdownEl.style.display = 'block';
    if (numberEl) numberEl.textContent = '10';

    // Play initial beep
    this.sound.playCountdownBeep();

    this.mpCountdownInterval = window.setInterval(() => {
        this.mpCountdownValue--;

        if (numberEl) numberEl.textContent = this.mpCountdownValue.toString();

        // Play beep each second
        this.sound.playCountdownBeep();

        if (this.mpCountdownValue <= 0) {
            this.endMpCountdown();
        }
    }, 1000);
  }

  endMpCountdown() {
    if (this.mpCountdownInterval) {
        clearInterval(this.mpCountdownInterval);
        this.mpCountdownInterval = null;
    }

    this.mpCountdownActive = false;

    const countdownEl = document.getElementById('mp-countdown');
    if (countdownEl) countdownEl.style.display = 'none';

    // If player hasn't finished, mark as retired
    if (!this.mpLocalFinished) {
        this.mpRetired = true;
        this.raceFinished = true;

        const retireOverlay = document.getElementById('retire-overlay');
        if (retireOverlay) retireOverlay.style.display = 'block';

        // Hide retire overlay after 2 seconds (results will show)
        setTimeout(() => {
            if (retireOverlay) retireOverlay.style.display = 'none';
        }, 2000);
    }
  }

  showMpResults(results: Array<{ id: string; name: string; position: number; time: number | null; status: string }>) {
    // Stop countdown if still running
    if (this.mpCountdownInterval) {
        clearInterval(this.mpCountdownInterval);
        this.mpCountdownInterval = null;
    }

    const countdownEl = document.getElementById('mp-countdown');
    const retireOverlay = document.getElementById('retire-overlay');
    if (countdownEl) countdownEl.style.display = 'none';
    if (retireOverlay) retireOverlay.style.display = 'none';

    this.raceFinished = true;
    this.leaderboard.hide();

    // Build results HTML
    const resultsScreen = document.getElementById('mp-results-screen');
    const resultsList = document.getElementById('mp-results-list');

    if (resultsList) {
        resultsList.innerHTML = '';

        results.forEach(result => {
            const isLocal = result.id === this.socket?.id;
            const div = document.createElement('div');
            div.className = `mp-result-item p${result.position}`;
            if (result.status === 'retired') div.classList.add('retired');
            if (isLocal) div.classList.add('is-you');

            const posEl = document.createElement('span');
            posEl.className = 'mp-result-position';
            posEl.textContent = `P${result.position}`;

            const nameEl = document.createElement('span');
            nameEl.className = 'mp-result-name';
            nameEl.textContent = result.name + (isLocal ? ' (You)' : '');

            const timeEl = document.createElement('span');
            timeEl.className = 'mp-result-time';
            if (result.status === 'retired') {
                timeEl.classList.add('retired');
                timeEl.textContent = 'RETIRED';
            } else {
                timeEl.textContent = this.formatTime(result.time || 0);
            }

            div.append(posEl, nameEl, timeEl);
            resultsList.appendChild(div);
        });
    }

    // Hide HUD, show results
    const dashboard = document.getElementById('dashboard-container');
    const lapTimer = document.getElementById('lap-timer-container');
    if (dashboard) dashboard.style.display = 'none';
    if (lapTimer) lapTimer.style.display = 'none';

    if (resultsScreen) resultsScreen.style.display = 'flex';

    // Setup restart button
    const restartBtn = document.getElementById('mp-restart-button');
    if (restartBtn) {
        restartBtn.onclick = () => {
            window.location.reload();
        };
    }
  }

  formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }

  startSequence() {
      // Show the game canvas and HUD
      this.scene.showCanvas();
      document.body.classList.add('racing');

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
      const playerName = info.name || 'Player';
      const mp = MultiplayerManager.getInstance();
      const playerColor = mp.getPlayerColor(id);
      const newCar = new Car(this.scene.scene, this.physics, {x: info.x, y: info.y, z: info.z}, true, playerName, playerColor);
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

  setupCollisionHandling() {
    this.physics.onCollision((handle1, handle2, started) => {
      if (!started) return; // Only handle collision start

      const localHandle = this.car.colliderHandle;

      // Check if local car is involved
      if (handle1 !== localHandle && handle2 !== localHandle) return;

      // Find which remote car we collided with
      const otherHandle = handle1 === localHandle ? handle2 : handle1;
      let remoteCar: Car | null = null;

      for (const car of this.remoteCars.values()) {
        if (car.colliderHandle === otherHandle) {
          remoteCar = car;
          break;
        }
      }

      if (!remoteCar) return; // Collided with something else (wall, etc.)

      // Calculate bounce direction: from remote car to local car
      const localPos = this.car.rigidBody.translation();
      const remotePos = remoteCar.rigidBody.translation();

      const bounceDir = new THREE.Vector3(
        localPos.x - remotePos.x,
        0, // Keep horizontal
        localPos.z - remotePos.z
      );

      if (bounceDir.length() < 0.01) {
        // Cars are at same position, push in random direction
        bounceDir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      }

      bounceDir.normalize();

      // Apply bounce impulse to local car (reduced for realistic feel)
      const bounceStrength = 4000;
      const impulse = {
        x: bounceDir.x * bounceStrength,
        y: 0,
        z: bounceDir.z * bounceStrength
      };

      this.car.rigidBody.applyImpulse(impulse, true);
    });
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

      // Update leaderboard in multiplayer mode
      if (this.isMultiplayer) {
          this.updateLeaderboard();
          this.leaderboard.updateLapInfo(this.currentLap, this.totalLaps, this.currentLapTime);
      }
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

  updateLeaderboard() {
    const mp = MultiplayerManager.getInstance();
    const racers: RacerInfo[] = [];

    // Add local player
    const localPos = this.car.rigidBody.translation();
    racers.push({
      id: this.socket?.id || 'local',
      name: mp.username,
      color: CAR_COLORS[this.localColorIndex],
      lap: this.currentLap,
      progress: this.calculateRaceProgress(localPos.z),
      isLocal: true
    });

    // Add remote players
    this.remoteCars.forEach((car, id) => {
      const pos = car.rigidBody.translation();
      const player = mp.players.get(id);

      racers.push({
        id: id,
        name: player?.name || 'Player',
        color: mp.getPlayerColor(id),
        lap: 1,
        progress: this.calculateRaceProgress(pos.z),
        isLocal: false
      });
    });

    this.leaderboard.update(racers);
  }

  calculateRaceProgress(z: number): number {
    // Simple progress: lower Z = more progress (racing toward -Z direction)
    // Start is around Z=100, turn is at Z=-100
    // Normalize to 0-1 range where lower Z = higher progress
    // Range: Z=100 (start, 0%) to Z=-100 (turn, 100%)
    const progress = (100 - z) / 200;
    return Math.max(0, Math.min(1, progress));
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

      // Multiplayer: send finish event to server
      if (this.isMultiplayer && this.socket) {
          this.mpLocalFinished = true;

          // Stop countdown if it was running (we finished in time!)
          if (this.mpCountdownInterval) {
              clearInterval(this.mpCountdownInterval);
              this.mpCountdownInterval = null;
          }

          const countdownEl = document.getElementById('mp-countdown');
          if (countdownEl) countdownEl.style.display = 'none';

          this.socket.emit('playerFinished', { totalTime: totalTimeMs });

          // Don't show single player results - wait for server to send raceResults
          return;
      }

      // Single player results
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