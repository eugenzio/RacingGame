import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';

export class MultiplayerScreen extends BaseScreen {
  constructor(manager: any) {
    super(manager);
    
    const title = document.createElement('h2');
    title.textContent = 'Multiplayer Lobby';

    const createBtn = this.createButton('Create Room', () => {
      this.uiManager.transition(UIState.MP_CREATE);
    });

    const joinBtn = this.createButton('Join Room', () => {
      this.uiManager.transition(UIState.MP_JOIN);
    });

    const backBtn = this.createButton('Back', () => {
      this.uiManager.transition(UIState.LANDING);
    }, true);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(createBtn, joinBtn, backBtn);

    this.element.append(title, btnGroup);
  }
}
