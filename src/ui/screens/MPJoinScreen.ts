import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';
import { MultiplayerStub } from '../../net/multiplayerStub';

export class MPJoinScreen extends BaseScreen {
  constructor(manager: any) {
    super(manager);
    
    const title = document.createElement('h2');
    title.textContent = 'Join Room';

    const form = document.createElement('div');
    form.className = 'input-group';

    const codeLabel = document.createElement('label');
    codeLabel.textContent = 'Room Code';
    const codeInput = this.createInput('ABCD');
    
    const statusMsg = document.createElement('div');
    statusMsg.className = 'message';

    const joinBtn = this.createButton('Join', async () => {
      if (!codeInput.value) return;
      statusMsg.textContent = 'Connecting...';
      
      const success = await MultiplayerStub.joinRoom(codeInput.value);
      if (success) {
          this.uiManager.showMessage(`Joined Room: ${codeInput.value}`);
          // Wait for host... or just go to lobby. 
          // For now, prompt implies going to Map Select (or placeholder)
          this.uiManager.transition(UIState.MAP_SELECT, { mode: 'MULTI', isHost: false, roomCode: codeInput.value });
      } else {
          statusMsg.textContent = 'Failed to join.';
      }
    });

    const backBtn = this.createButton('Back', () => {
      this.uiManager.transition(UIState.MULTIPLAYER);
    }, true);

    form.append(codeLabel, codeInput);
    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(joinBtn, backBtn);

    this.element.append(title, form, statusMsg, btnGroup);
  }
}
