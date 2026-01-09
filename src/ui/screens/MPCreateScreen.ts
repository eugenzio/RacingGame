import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';
import { MultiplayerStub } from '../../net/multiplayerStub';

export class MPCreateScreen extends BaseScreen {
  constructor(manager: any) {
    super(manager);
    
    const title = document.createElement('h2');
    title.textContent = 'Create Room';

    const form = document.createElement('div');
    form.className = 'input-group';

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Room Name';
    const nameInput = this.createInput(`room-${Math.floor(Math.random() * 9000) + 1000}`);
    
    const regionLabel = document.createElement('label');
    regionLabel.textContent = 'Region';
    const regionSelect = document.createElement('select');
    ['US-East', 'US-West', 'Asia', 'Europe'].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        regionSelect.appendChild(opt);
    });

    const createBtn = this.createButton('Create', async () => {
      if (!nameInput.value) return;
      
      const code = await MultiplayerStub.createRoom({
          name: nameInput.value,
          region: regionSelect.value,
          maxPlayers: 8
      });
      
      this.uiManager.showMessage(`Room Created: ${code}`);
      // Proceed to map select as host
      this.uiManager.transition(UIState.MAP_SELECT, { mode: 'MULTI', isHost: true, roomCode: code });
    });

    const backBtn = this.createButton('Back', () => {
      this.uiManager.transition(UIState.MULTIPLAYER);
    }, true);

    form.append(nameLabel, nameInput, regionLabel, regionSelect);
    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(createBtn, backBtn);

    this.element.append(title, form, btnGroup);
  }
}
