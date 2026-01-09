import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';

export class MapSelectScreen extends BaseScreen {
  private selectedMap: string = 'standard';
  private modeData: any;

  protected onShow(data: any) {
      this.modeData = data;
  }

  constructor(manager: any) {
    super(manager);
    
    const title = document.createElement('h2');
    title.textContent = 'Select Track';

    const mapList = document.createElement('div');
    mapList.className = 'map-list';

    const maps = [
        { id: 'standard', name: 'Grand Prix' },
        { id: 'tokyo', name: 'Tokyo Expressway' },
        { id: 'ny', name: 'New York Central' }
    ];

    maps.forEach(m => {
        const card = document.createElement('div');
        card.className = 'map-card';
        card.textContent = m.name;
        card.onclick = () => {
            this.selectedMap = m.id;
            Array.from(mapList.children).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        };
        if (m.id === 'standard') card.classList.add('selected');
        mapList.appendChild(card);
    });

    const startBtn = this.createButton('START RACE', () => {
        // Here we trigger the actual game start logic
        this.uiManager.transition(UIState.IN_GAME, { 
            map: this.selectedMap,
            ...this.modeData 
        });
    });

    const backBtn = this.createButton('Back', () => {
        // Simple logic: if multi, go back to MP menu, else SP
        if (this.modeData && this.modeData.mode === 'MULTI') {
            this.uiManager.transition(UIState.MULTIPLAYER);
        } else {
            this.uiManager.transition(UIState.SINGLEPLAYER);
        }
    }, true);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(startBtn, backBtn);

    this.element.append(title, mapList, btnGroup);
  }
}
