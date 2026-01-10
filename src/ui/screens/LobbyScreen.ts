import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';
import { MultiplayerManager, PlayerInfo } from '../../net/MultiplayerManager';

export class LobbyScreen extends BaseScreen {
  private roomCodeDisplay: HTMLElement;
  private playerList: HTMLElement;
  private startBtn: HTMLButtonElement;
  private statusMsg: HTMLElement;
  private isHost: boolean = false;

  constructor(manager: any) {
    super(manager);

    const title = document.createElement('h2');
    title.textContent = 'Game Lobby';

    // Room code display
    const codeContainer = document.createElement('div');
    codeContainer.className = 'room-code-container';

    const codeLabel = document.createElement('span');
    codeLabel.textContent = 'Room Code: ';

    this.roomCodeDisplay = document.createElement('span');
    this.roomCodeDisplay.className = 'room-code';
    this.roomCodeDisplay.style.fontSize = '1.5em';
    this.roomCodeDisplay.style.fontWeight = 'bold';
    this.roomCodeDisplay.style.letterSpacing = '0.2em';

    codeContainer.append(codeLabel, this.roomCodeDisplay);

    // Player list
    const playersLabel = document.createElement('h3');
    playersLabel.textContent = 'Players';
    playersLabel.style.marginTop = '20px';

    this.playerList = document.createElement('ul');
    this.playerList.className = 'player-list';
    this.playerList.style.listStyle = 'none';
    this.playerList.style.padding = '0';
    this.playerList.style.minHeight = '100px';

    // Status message
    this.statusMsg = document.createElement('div');
    this.statusMsg.className = 'message';

    // Buttons
    this.startBtn = this.createButton('Start Race', () => {
      MultiplayerManager.getInstance().startRace();
    });
    this.startBtn.style.display = 'none';

    const leaveBtn = this.createButton('Leave', () => {
      MultiplayerManager.getInstance().disconnect();
      this.uiManager.transition(UIState.MULTIPLAYER);
    }, true);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(this.startBtn, leaveBtn);

    this.element.append(title, codeContainer, playersLabel, this.playerList, this.statusMsg, btnGroup);

    // Setup event listeners
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const mp = MultiplayerManager.getInstance();

    mp.onPlayerJoin((_player: PlayerInfo) => {
      this.updatePlayerList();
    });

    mp.onPlayerLeave((_playerId: string) => {
      this.updatePlayerList();
    });

    mp.onRaceStart(() => {
      // Transition to game
      this.uiManager.transition(UIState.IN_GAME, {
        mode: 'MULTI',
        isHost: this.isHost
      });
    });
  }

  protected onShow(data?: { roomCode: string; isHost: boolean }): void {
    if (!data) return;

    this.isHost = data.isHost;
    this.roomCodeDisplay.textContent = data.roomCode;

    // Show/hide start button based on host status
    if (this.isHost) {
      this.startBtn.style.display = 'block';
      this.statusMsg.textContent = 'Share the room code with friends. Press Start when ready.';
    } else {
      this.startBtn.style.display = 'none';
      this.statusMsg.textContent = 'Waiting for host to start the race...';
    }

    this.updatePlayerList();
  }

  private updatePlayerList(): void {
    const mp = MultiplayerManager.getInstance();
    const players = mp.getPlayers();

    this.playerList.innerHTML = '';

    if (players.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No players connected';
      li.style.color = '#888';
      this.playerList.appendChild(li);
      return;
    }

    players.forEach((player) => {
      const li = document.createElement('li');
      li.style.padding = '8px';
      li.style.marginBottom = '4px';
      li.style.background = 'rgba(255,255,255,0.1)';
      li.style.borderRadius = '4px';

      const playerName = player.name || 'Player';
      const hostBadge = player.isHost ? ' (Host)' : '';
      const youBadge = player.id === mp.getSocket()?.id ? ' - You' : '';

      li.textContent = `${playerName}${hostBadge}${youBadge}`;
      this.playerList.appendChild(li);
    });
  }
}
