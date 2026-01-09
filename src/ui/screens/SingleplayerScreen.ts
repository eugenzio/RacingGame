import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';

export class SingleplayerScreen extends BaseScreen {
  constructor(manager: any) {
    super(manager);
    
    const title = document.createElement('h2');
    title.textContent = 'Singleplayer';

    const timeAttackBtn = this.createButton('Time Attack', () => {
      this.uiManager.transition(UIState.MAP_SELECT, { mode: 'TIME_ATTACK' });
    });

    const backBtn = this.createButton('Back', () => {
      this.uiManager.transition(UIState.LANDING);
    }, true);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(timeAttackBtn, backBtn);

    this.element.append(title, btnGroup);
  }
}
