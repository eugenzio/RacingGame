export class HUD {
    speedElement: HTMLElement | null;
    gearElement: HTMLElement | null;
    rpmBarElement: HTMLElement | null;
    fpsElement: HTMLElement | null;
    currentTimeElement: HTMLElement | null;
    lastLapElement: HTMLElement | null;
    bestLapElement: HTMLElement | null;
    lapCounterElement: HTMLElement | null;
  
    constructor() {
      this.speedElement = document.getElementById('speed-val');
      this.gearElement = document.getElementById('gear-val');
      this.rpmBarElement = document.getElementById('rpm-bar');
      this.fpsElement = document.getElementById('fps');
      this.currentTimeElement = document.getElementById('current-time');
      this.lastLapElement = document.getElementById('last-lap');
      this.bestLapElement = document.getElementById('best-lap');
      this.lapCounterElement = document.getElementById('lap-counter');
    }

    updateLapTimes(current: number, last: number, best: number) {
        if (this.currentTimeElement) this.currentTimeElement.textContent = this.formatTime(current);
        if (this.lastLapElement && last > 0) this.lastLapElement.textContent = `Last: ${this.formatTime(last)}`;
        if (this.bestLapElement && best < Infinity) this.bestLapElement.textContent = `Best: ${this.formatTime(best)}`;
    }

    updateLapCounter(current: number, total: number) {
        if (this.lapCounterElement) {
            this.lapCounterElement.textContent = `LAP ${current} / ${total}`;
        }
    }

    private formatTime(ms: number): string {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const millis = Math.floor(ms % 1000);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
    }
  
    updateSpeed(speedKmH: number) {
      const speed = Math.abs(speedKmH);
      if (this.speedElement) {
        this.speedElement.textContent = `${speed}`;
      }
      this.updateGearAndRPM(speed);
    }

    private updateGearAndRPM(speed: number) {
        // Simple fake gear logic
        // Gear ranges: 0-20 (1), 20-50 (2), 50-90 (3), 90-140 (4), 140+ (5)
        let gear = 1;
        let rpm = 0; // 0.0 to 1.0

        if (speed < 20) {
            gear = 1;
            rpm = speed / 20;
        } else if (speed < 60) {
            gear = 2;
            rpm = (speed - 20) / 40;
        } else if (speed < 100) {
            gear = 3;
            rpm = (speed - 60) / 40;
        } else if (speed < 160) {
            gear = 4;
            rpm = (speed - 100) / 60;
        } else {
            gear = 5;
            rpm = Math.min((speed - 160) / 100, 1.0);
        }

        // Add some noise or "idle" rpm
        if (speed < 1) rpm = 0.1;

        if (this.gearElement) this.gearElement.textContent = `${gear}`;
        
        if (this.rpmBarElement) {
            const percent = Math.min(rpm * 100, 100);
            this.rpmBarElement.style.width = `${percent}%`;
            
            // Color shift at redline? handled by CSS gradient mostly but we could enhance later
        }
    }

    updateFPS(fps: number) {
        if (this.fpsElement) {
            this.fpsElement.textContent = `FPS: ${Math.round(fps)}`;
        }
    }
  }
