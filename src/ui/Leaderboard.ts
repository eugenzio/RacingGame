export interface RacerInfo {
  id: string;
  name: string;
  color: string;
  lap: number;
  progress: number; // 0-1 within current lap
  isLocal: boolean;
}

export class Leaderboard {
  private container: HTMLElement | null;
  private list: HTMLElement | null;
  private lapCounter: HTMLElement | null;
  private currentTime: HTMLElement | null;
  private lastPositions: Map<string, number> = new Map();
  private isVisible = false;

  constructor() {
    this.container = document.getElementById('leaderboard-container');
    this.list = document.getElementById('leaderboard-list');
    this.lapCounter = document.getElementById('lb-lap-counter');
    this.currentTime = document.getElementById('lb-current-time');
  }

  show() {
    if (this.container && !this.isVisible) {
      this.container.classList.add('visible');
      this.isVisible = true;
    }
  }

  hide() {
    if (this.container && this.isVisible) {
      this.container.classList.remove('visible');
      this.isVisible = false;
    }
  }

  update(racers: RacerInfo[]) {
    if (!this.list) return;

    // Sort racers by lap (descending) then by progress (descending)
    const sorted = [...racers].sort((a, b) => {
      if (a.lap !== b.lap) return b.lap - a.lap;
      return b.progress - a.progress;
    });

    // Clear current list
    this.list.innerHTML = '';

    // Track position changes
    const newPositions: Map<string, number> = new Map();

    sorted.forEach((racer, index) => {
      const position = index + 1;
      newPositions.set(racer.id, position);

      const li = document.createElement('li');
      li.className = 'leaderboard-item';
      li.dataset.id = racer.id;

      // Check if position changed
      const oldPosition = this.lastPositions.get(racer.id);
      if (oldPosition !== undefined && oldPosition !== position) {
        li.classList.add('position-change');
        // Remove animation class after it completes
        setTimeout(() => li.classList.remove('position-change'), 500);
      }

      // Position number
      const posEl = document.createElement('span');
      posEl.className = 'leaderboard-position';
      if (position === 1) posEl.classList.add('p1');
      else if (position === 2) posEl.classList.add('p2');
      else if (position === 3) posEl.classList.add('p3');
      posEl.textContent = `${position}`;

      // Color indicator
      const colorEl = document.createElement('span');
      colorEl.className = 'leaderboard-color';
      colorEl.style.backgroundColor = racer.color;

      // Name
      const nameEl = document.createElement('span');
      nameEl.className = 'leaderboard-name';
      if (racer.isLocal) nameEl.classList.add('is-you');
      nameEl.textContent = racer.name + (racer.isLocal ? ' (You)' : '');

      // Gap info (for positions 2+)
      const gapEl = document.createElement('span');
      gapEl.className = 'leaderboard-gap';
      if (index > 0) {
        const leader = sorted[0];
        const lapDiff = leader.lap - racer.lap;
        if (lapDiff > 0) {
          gapEl.textContent = `+${lapDiff} lap${lapDiff > 1 ? 's' : ''}`;
        }
      }

      li.append(posEl, colorEl, nameEl, gapEl);
      this.list!.appendChild(li);
    });

    this.lastPositions = newPositions;
  }

  updateLapInfo(currentLap: number, totalLaps: number, timeMs: number) {
    if (this.lapCounter) {
      this.lapCounter.textContent = `LAP ${currentLap} / ${totalLaps}`;
    }
    if (this.currentTime) {
      this.currentTime.textContent = this.formatTime(timeMs);
    }
  }

  private formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const millis = Math.floor(ms % 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
}
