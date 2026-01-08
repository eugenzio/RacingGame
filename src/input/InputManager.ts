export class InputManager {
  forward = false;
  backward = false;
  left = false;
  right = false;
  reset = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  private onKeyDown(event: KeyboardEvent) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.forward = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.backward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.right = true;
        break;
      case 'KeyR':
        this.reset = true;
        break;
    }
  }

  private onKeyUp(event: KeyboardEvent) {
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.forward = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.backward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.left = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.right = false;
        break;
      case 'KeyR':
        this.reset = false;
        break;
    }
  }
}
