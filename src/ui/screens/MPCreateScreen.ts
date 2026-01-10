import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';
import { MultiplayerManager } from '../../net/MultiplayerManager';

export class MPCreateScreen extends BaseScreen {
  constructor(manager: any) {
    super(manager);

    const title = document.createElement('h2');
    title.textContent = 'Create Room';

    // Name input
    const form = document.createElement('div');
    form.className = 'input-group';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Your Name';
    const nameInput = this.createInput('');
    nameInput.placeholder = 'Enter your name';
    nameInput.maxLength = 15;

    form.append(nameLabel, nameInput);

    const statusMsg = document.createElement('div');
    statusMsg.className = 'message';

    const createBtn = this.createButton('Create Room', async () => {
      const username = nameInput.value.trim() || 'Player';

      createBtn.disabled = true;
      statusMsg.textContent = 'Creating room...';

      try {
        const code = await MultiplayerManager.getInstance().createRoom(username);
        // Proceed to lobby as host
        this.uiManager.transition(UIState.LOBBY, { roomCode: code, isHost: true });
      } catch (error) {
        statusMsg.textContent = 'Failed to create room. Is the server running?';
        createBtn.disabled = false;
      }
    });

    const backBtn = this.createButton('Back', () => {
      this.uiManager.transition(UIState.MULTIPLAYER);
    }, true);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(createBtn, backBtn);

    this.element.append(title, form, statusMsg, btnGroup);
  }
}
