// Procedural audio: ambience per station plus UI sounds. Starts only after a user gesture.
import { settings, onSettings } from './settings.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.layers = {};
    this.current = null;
    onSettings((k) => { if (k === 'volume' || k === 'ambience') this.applyVolume(); });
  }

  /** Must be called from a click/tap/trigger handler. */
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      const ctx = this.ctx = new AudioContext();
      this.master = ctx.createGain(); this.master.connect(ctx.destination);
      this.amb = ctx.createGain(); this.amb.connect(this.master);
      this.applyVolume();
      // shared noise buffer
      const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048; d[i] = (b0 + b1 + b2) * 0.6; }
      this.noise = buf;
      if (this.pending) { const p = this.pending; this.pending = null; this.ambience(p); }
    } catch { this.ctx = null; }
  }

  applyVolume() {
    if (!this.ctx) return;
    this.master.gain.setTargetAtTime(settings.volume, this.ctx.currentTime, 0.1);
    this.amb.gain.setTargetAtTime(settings.ambience ? 1 : 0, this.ctx.currentTime, 0.3);
  }

  noiseSource(filterType, freq, q, gain) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f).connect(g).connect(this.amb);
    src.start(0, Math.random() * 2);
    return { src, f, g, target: gain };
  }

  tone(type, freq, gain) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = 0;
    o.connect(g).connect(this.amb); o.start();
    return { src: o, g, target: gain };
  }

  /** Cross-fade to a station's ambience: 'ramp' | 'hangar' | 'cabin' | 'flight' | 'title' | null */
  ambience(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.current === name) return;
    const now = this.ctx.currentTime;
    if (this.current && this.layers[this.current]) {
      const old = this.layers[this.current];
      old.forEach(l => { l.g.gain.setTargetAtTime(0, now, 0.6); setTimeout(() => { try { l.src.stop(); } catch { /* stopped */ } }, 3000); });
      delete this.layers[this.current];
    }
    this.current = name;
    if (!name) return;
    const L = [];
    if (name === 'ramp') {
      L.push(this.noiseSource('lowpass', 420, 0.7, 0.32));         // APUs & distant engines
      L.push(this.noiseSource('bandpass', 2600, 6, 0.035));        // turbine whine (filtered)
      L.push(this.tone('sine', 112, 0.012));                       // GPU hum
    } else if (name === 'hangar') {
      L.push(this.noiseSource('lowpass', 260, 0.5, 0.18));         // room tone
      L.push(this.tone('sine', 120, 0.008));                       // lighting hum
    } else if (name === 'cabin') {
      L.push(this.noiseSource('lowpass', 520, 0.6, 0.26));         // air conditioning packs
      L.push(this.noiseSource('highpass', 3000, 0.5, 0.02));       // vent hiss
    } else if (name === 'flight') {
      L.push(this.noiseSource('lowpass', 900, 0.6, 0.12));         // wind
    } else if (name === 'title') {
      L.push(this.noiseSource('lowpass', 320, 0.6, 0.14));
      L.push(this.tone('sine', 55, 0.02));
      L.push(this.tone('sine', 82.4, 0.012));
    }
    L.forEach(l => l.g.gain.setTargetAtTime(l.target, now, 1.2));
    this.layers[name] = L;
  }

  /** Short UI blip */
  click(kind = 'tap') {
    if (!this.ctx) return;
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = kind === 'good' ? 880 : kind === 'bad' ? 220 : 520;
    g.gain.value = 0.0001;
    o.connect(g).connect(this.master);
    const t = ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(kind === 'tap' ? 0.05 : 0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'tap' ? 0.08 : 0.25));
    if (kind === 'good') o.frequency.exponentialRampToValueAtTime(1320, t + 0.15);
    o.start(t); o.stop(t + 0.3);
  }
}

export const audio = new AudioEngine();
