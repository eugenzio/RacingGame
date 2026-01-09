import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';

export class LandingScreen extends BaseScreen {
  constructor(manager: any) {
    super(manager);
    
    const title = document.createElement('h1');
    title.textContent = 'F1 RACER';
    
    const subtitle = document.createElement('h2');
    subtitle.textContent = 'Simulator 2026';

    const spBtn = this.createButton('Singleplayer', () => {
      this.uiManager.transition(UIState.SINGLEPLAYER);
    });

    const mpBtn = this.createButton('Multiplayer', () => {
      this.uiManager.transition(UIState.MULTIPLAYER);
    });

    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(spBtn, mpBtn);

    this.element.append(title, subtitle, btnGroup);
  }
}
