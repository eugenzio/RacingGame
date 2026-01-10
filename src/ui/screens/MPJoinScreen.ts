import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';
import { MultiplayerManager } from '../../net/MultiplayerManager';

export class MPJoinScreen extends BaseScreen {
  constructor(manager: any) {
    super(manager);

    const title = document.createElement('h2');
    title.textContent = 'Join Room';

    const form = document.createElement('div');
    form.className = 'input-group';

    // Name input
    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Your Name';
    const nameInput = this.createInput('');
    nameInput.placeholder = 'Enter your name';
    nameInput.maxLength = 15;

    // Room code input
    const codeLabel = document.createElement('label');
    codeLabel.textContent = 'Room Code';
    const codeInput = this.createInput('');
    codeInput.placeholder = 'Enter 5-letter code';
    codeInput.maxLength = 5;
    codeInput.style.textTransform = 'uppercase';

    const statusMsg = document.createElement('div');
    statusMsg.className = 'message';

    const joinBtn = this.createButton('Join', async () => {
      const code = codeInput.value.toUpperCase().trim();
      const username = nameInput.value.trim() || 'Player';

      if (!code || code.length !== 5) {
        statusMsg.textContent = 'Please enter a 5-letter room code.';
        return;
      }

      joinBtn.disabled = true;
      statusMsg.textContent = 'Joining...';

      try {
        await MultiplayerManager.getInstance().joinRoom(code, username);
        // Proceed to lobby
        this.uiManager.transition(UIState.LOBBY, { roomCode: code, isHost: false });
      } catch (error: any) {
        statusMsg.textContent = error.message || 'Failed to join room.';
        joinBtn.disabled = false;
      }
    });

    const backBtn = this.createButton('Back', () => {
      this.uiManager.transition(UIState.MULTIPLAYER);
    }, true);

    form.append(nameLabel, nameInput, codeLabel, codeInput);
    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(joinBtn, backBtn);

    this.element.append(title, form, statusMsg, btnGroup);
  }
}
