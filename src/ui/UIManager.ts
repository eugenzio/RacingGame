import { UIState, UIManagerInterface } from './UIState';
import { BaseScreen } from './screens/BaseScreen';
import { LandingScreen } from './screens/LandingScreen';
import { SingleplayerScreen } from './screens/SingleplayerScreen';
import { MultiplayerScreen } from './screens/MultiplayerScreen';
import { MPCreateScreen } from './screens/MPCreateScreen';
import { MPJoinScreen } from './screens/MPJoinScreen';
import { MapSelectScreen } from './screens/MapSelectScreen';

export class UIManager implements UIManagerInterface {
  private container: HTMLElement;
  private screens: Map<UIState, BaseScreen> = new Map();
  private currentState: UIState | null = null;
  private gameStartCallback: (config: any) => void;

  constructor(rootSelector: string, onGameStart: (config: any) => void) {
    const root = document.querySelector(rootSelector);
    if (!root) throw new Error(`UI Root ${rootSelector} not found`);
    this.container = root as HTMLElement;
    this.gameStartCallback = onGameStart;

    this.initScreens();
    this.transition(UIState.LANDING);
  }

  private initScreens() {
    this.screens.set(UIState.LANDING, new LandingScreen(this));
    this.screens.set(UIState.SINGLEPLAYER, new SingleplayerScreen(this));
    this.screens.set(UIState.MULTIPLAYER, new MultiplayerScreen(this));
    this.screens.set(UIState.MP_CREATE, new MPCreateScreen(this));
    this.screens.set(UIState.MP_JOIN, new MPJoinScreen(this));
    this.screens.set(UIState.MAP_SELECT, new MapSelectScreen(this));

    this.screens.forEach(screen => {
        this.container.appendChild(screen.element);
    });
  }

  transition(to: UIState, data?: any): void {
    if (to === UIState.IN_GAME) {
        // Hand off to Main Game
        this.container.style.display = 'none'; // Hide all UI
        if (this.gameStartCallback) this.gameStartCallback(data);
        return;
    }

    this.container.style.display = 'flex'; // Ensure visible

    if (this.currentState) {
        const current = this.screens.get(this.currentState);
        current?.hide();
    }

    const next = this.screens.get(to);
    if (next) {
        next.show(data);
        this.currentState = to;
    }
  }

  showMessage(msg: string): void {
      // Simple toast logic could go here, for now console
      console.log('UI Message:', msg);
      // Or alert?
      alert(msg);
  }
}
