export class SoundManager {
  ctx: AudioContext;
  masterGain: GainNode;

  // Engine (Filtered Noise / Subtractive Synthesis)
  engineSource: AudioBufferSourceNode | null = null;
  engineFilter: BiquadFilterNode | null = null;
  engineGain: GainNode | null = null;
  engineBuffer: AudioBuffer | null = null;
  distortion: WaveShaperNode | null = null;

  // Brake
  brakeSource: AudioBufferSourceNode | null = null;
  brakeGain: GainNode | null = null;
  brakeBuffer: AudioBuffer | null = null;

  constructor() {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.6; // Louder master
    this.masterGain.connect(this.ctx.destination);
    
    this.brakeBuffer = this.createWhiteNoiseBuffer();
    this.engineBuffer = this.createBrownNoiseBuffer();
  }

  createWhiteNoiseBuffer(): AudioBuffer {
    const bufferSize = this.ctx.sampleRate * 2.0; 
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  createBrownNoiseBuffer(): AudioBuffer {
    const bufferSize = this.ctx.sampleRate * 2.0;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise integration
        data[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = data[i];
        // Compensate gain
        data[i] *= 3.5; 
    }
    return buffer;
  }

  makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  async init() {
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  startEngine() {
    if (this.engineSource) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.2;

    // Bandpass Filter: This creates the "Pitch" from the noise
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'bandpass';
    this.engineFilter.frequency.value = 60; // Idle
    this.engineFilter.Q.value = 5; // Resonant peak

    // Distortion
    this.distortion = this.ctx.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(50);
    this.distortion.oversample = '4x';

    // Brown Noise Source
    this.engineSource = this.ctx.createBufferSource();
    this.engineSource.buffer = this.engineBuffer;
    this.engineSource.loop = true;

    // Chain: Noise -> Distortion -> Filter -> Gain -> Master
    // Distortion first makes the noise richer
    this.engineSource.connect(this.distortion);
    this.distortion.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineSource.start();
  }

  updateEngine(rpm: number) { 
    if (!this.engineSource || !this.engineFilter || !this.engineGain) return;

    // Gas Engine Frequency Response
    // Idle: 60Hz (Deep rumble)
    // Redline: 350Hz (Roar)
    // We don't go higher to avoid the "mosquito" whine
    const targetFreq = 60 + (rpm * 290);

    // Q Factor (Resonance)
    // Tighter Q at low RPM (thump), looser at high RPM (breath)
    const targetQ = 5 + (rpm * 3);

    this.engineFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.1);
    this.engineFilter.Q.setTargetAtTime(targetQ, this.ctx.currentTime, 0.1);
    
    // Volume
    this.engineGain.gain.setTargetAtTime(0.3 + (rpm * 0.4), this.ctx.currentTime, 0.1);
  }

  startBrake() {
    if (this.brakeSource) return;

    this.brakeSource = this.ctx.createBufferSource();
    this.brakeSource.buffer = this.brakeBuffer;
    this.brakeSource.loop = true;

    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.value = 0.0;

    // Bandpass filter to isolate the "hiss" of carbon brakes
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 1.0;

    this.brakeSource.connect(filter);
    filter.connect(this.brakeGain);
    this.brakeGain.connect(this.masterGain);

    this.brakeSource.start();
    this.brakeGain.gain.setTargetAtTime(0.3, this.ctx.currentTime, 0.1);
  }

  stopBrake() {
    if (!this.brakeSource || !this.brakeGain) return;
    
    this.brakeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    
    const src = this.brakeSource;
    const gain = this.brakeGain;
    this.brakeSource = null;
    this.brakeGain = null;
    
    setTimeout(() => {
        try {
            src.stop();
            src.disconnect();
            gain.disconnect();
        } catch (e) {}
    }, 200);
  }

  playCountdownBeep() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.value = 600; // Standard beep
    
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  playCrash(intensity: number) { // 0.0 to 1.0
    const duration = 0.5 + intensity;
    
    // Create Noise Buffer
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Filter for impact thud
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800; // Thud

    const gain = this.ctx.createGain();
    gain.gain.value = Math.min(intensity, 1.0);
    
    // Exponential decay
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start();
  }
}
