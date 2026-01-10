import * as THREE from 'three';

export class GameScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  sun: THREE.DirectionalLight | null = null;
  sunOffset: THREE.Vector3 = new THREE.Vector3(50, 100, 50);

  constructor() {
    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 200, 1000);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(this.renderer.domElement);

    // Hide canvas until race starts
    this.renderer.domElement.style.display = 'none';

    // 4. Lights
    this.setupLights();

    // 5. Resize Handler
    window.addEventListener('resize', () => this.onWindowResize(), false);
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.position.copy(this.sunOffset);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.width = 2048;
    this.sun.shadow.mapSize.height = 2048;
    this.sun.shadow.camera.near = 0.5;
    this.sun.shadow.camera.far = 200;
    this.sun.shadow.bias = -0.0005; // Fix acne
    
    // Optimize shadow frustum for the track area
    const d = 50;
    this.sun.shadow.camera.left = -d;
    this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d;
    this.sun.shadow.camera.bottom = -d;

    this.scene.add(this.sun);
  }
  
  updateSunPosition(target: THREE.Vector3) {
      if (this.sun) {
          this.sun.position.copy(target).add(this.sunOffset);
          this.sun.target.position.copy(target);
          this.sun.target.updateMatrixWorld();
      }
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  showCanvas() {
    this.renderer.domElement.style.display = 'block';
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
