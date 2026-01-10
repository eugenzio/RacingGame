import { BaseScreen } from './BaseScreen';
import { UIState } from '../UIState';
import { MapInfo } from '../../maps/MapManager';

export class MapSelectScreen extends BaseScreen {
  private selectedMap: string = 'standard';
  private modeData: any;
  private mapList: HTMLElement;
  private maps: MapInfo[] = [];

  protected onShow(data: any) {
    this.modeData = data;
    if (data?.maps) {
      this.maps = data.maps;
      this.renderMaps();
    }
  }

  constructor(manager: any) {
    super(manager);

    const title = document.createElement('h1');
    title.textContent = 'SELECT TRACK';
    title.style.marginBottom = '10px';

    const subtitle = document.createElement('h2');
    subtitle.textContent = 'Choose your racing circuit';

    this.mapList = document.createElement('div');
    this.mapList.className = 'map-list';
    this.mapList.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
      width: 100%;
      padding: 20px;
    `;

    const startBtn = this.createButton('START RACE', () => {
      this.uiManager.transition(UIState.IN_GAME, {
        map: this.selectedMap,
        ...this.modeData
      });
    });

    const backBtn = this.createButton('Back', () => {
      if (this.modeData && this.modeData.mode === 'MULTI') {
        this.uiManager.transition(UIState.MULTIPLAYER);
      } else {
        this.uiManager.transition(UIState.SINGLEPLAYER);
      }
    }, true);

    const btnGroup = document.createElement('div');
    btnGroup.className = 'button-group';
    btnGroup.append(startBtn, backBtn);

    this.element.append(title, subtitle, this.mapList, btnGroup);
  }

  private renderMaps() {
    this.mapList.innerHTML = '';

    this.maps.forEach(m => {
      const item = document.createElement('div');
      item.className = 'map-item';
      item.style.cssText = `
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 15px 20px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;
      `;

      const name = document.createElement('div');
      name.textContent = m.name;
      name.style.cssText = `
        font-size: 18px;
        font-weight: 700;
        color: white;
        margin-bottom: 4px;
      `;

      const desc = document.createElement('div');
      desc.textContent = m.description;
      desc.style.cssText = `
        font-size: 12px;
        color: #aaa;
      `;

      item.append(name, desc);

      item.onmouseenter = () => {
        if (!item.classList.contains('selected')) {
          item.style.background = 'rgba(255, 255, 255, 0.2)';
        }
      };

      item.onmouseleave = () => {
        if (!item.classList.contains('selected')) {
          item.style.background = 'rgba(255, 255, 255, 0.1)';
        }
      };

      item.onclick = () => {
        this.selectedMap = m.id;
        Array.from(this.mapList.children).forEach(c => {
          (c as HTMLElement).classList.remove('selected');
          (c as HTMLElement).style.borderColor = 'transparent';
          (c as HTMLElement).style.background = 'rgba(255, 255, 255, 0.1)';
        });
        item.classList.add('selected');
        item.style.borderColor = '#e10600';
        item.style.background = 'rgba(225, 6, 0, 0.2)';
      };

      if (m.id === this.selectedMap) {
        item.classList.add('selected');
        item.style.borderColor = '#e10600';
        item.style.background = 'rgba(225, 6, 0, 0.2)';
      }

      this.mapList.appendChild(item);
    });
  }
}
