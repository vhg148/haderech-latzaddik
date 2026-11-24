// Procedural Web Audio API sound & Breslov Niggun synth engine (zero external audio files)

// D Freygish / Klezmer uplifting scale frequencies (Hz)
const NIGGUN_SCALE = [
  293.66, // D4
  311.13, // Eb4
  369.99, // F#4
  392.00, // G4
  440.00, // A4
  466.16, // Bb4
  523.25, // C5
  587.33, // D5
  622.25, // Eb5
  739.99, // F#5
  783.99, // G5
  880.00, // A5
];

// Upbeat joyful niggun melody steps (indices into NIGGUN_SCALE, -1 = rest)
const BG_MELODY = [
  0, 2, 3, 4, 4, 3, 2, 3,
  4, 6, 7, 6, 4, 3, 2, -1,
  7, 7, 6, 4, 6, 4, 3, 2,
  3, 4, 3, 2, 0, 2, 0, -1,
];

const BG_BASS = [
  146.83, 146.83, 196.0, 220.0,
  146.83, 174.61, 196.0, 146.83,
];

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.melodyStep = 0;
    this.musicRunning = false;
    this.tempoFactor = 1.0;
    this.joyActive = false;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.muted) {
      this.stopMusic();
    } else if (this.musicRunning) {
      this._scheduleNextNote();
    }
    return this.muted;
  }

  startMusic() {
    this.musicRunning = true;
    if (this.muted) return;
    this.ensureContext();
    if (this.musicTimer) clearTimeout(this.musicTimer);
    this._scheduleNextNote();
  }

  stopMusic() {
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  pauseMusic() {
    this.musicRunning = false;
    this.stopMusic();
  }

  setIntensity(tempoFactor, joyActive) {
    this.tempoFactor = tempoFactor;
    this.joyActive = joyActive;
  }

  _scheduleNextNote() {
    if (!this.musicRunning || this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const step = this.melodyStep % BG_MELODY.length;
    const noteIdx = BG_MELODY[step];
    const now = ctx.currentTime;

    // Soft rhythmic bass pulse every 2 steps
    if (step % 2 === 0) {
      const bassFreq = BG_BASS[Math.floor(step / 4) % BG_BASS.length];
      this._playTone(bassFreq * (this.joyActive ? 1.12 : 1), 'triangle', 0.14, 0.045, now);
    }

    // Light melodic klezmer pluck
    if (noteIdx >= 0) {
      const freq = NIGGUN_SCALE[noteIdx] * (this.joyActive ? 1.122 : 1);
      this._playTone(freq, this.joyActive ? 'sawtooth' : 'triangle', 0.12, this.joyActive ? 0.032 : 0.038, now, 1200);
    }

    this.melodyStep++;
    const baseMs = this.joyActive ? 165 : 215;
    const stepMs = Math.max(125, baseMs / this.tempoFactor);
    this.musicTimer = setTimeout(() => this._scheduleNextNote(), stepMs);
  }

  _playTone(freq, type, duration, volume, startTime, filterFreq = null) {
    if (this.muted || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    if (filterFreq) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(filterFreq, startTime);
      osc.connect(filter);
      filter.connect(gain);
    } else {
      osc.connect(gain);
    }
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  playGoodPoint(combo = 1, isSuper = false) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const idx = Math.min(NIGGUN_SCALE.length - 1, (combo - 1) % NIGGUN_SCALE.length);
    const freq = NIGGUN_SCALE[idx] * (isSuper ? 1.5 : 1.0);
    this._playTone(freq, 'sine', isSuper ? 0.28 : 0.16, 0.12, now);
    this._playTone(freq * 1.5, 'triangle', isSuper ? 0.24 : 0.11, 0.06, now + 0.02);
    if (isSuper) {
      this._playTone(freq * 2, 'sine', 0.3, 0.08, now + 0.06);
    }
  }

  playLaneSwitch() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.07);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  playJump(isSuper = false) {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isSuper ? 260 : 210, now);
    osc.frequency.exponentialRampToValueAtTime(isSuper ? 780 : 540, now + (isSuper ? 0.22 : 0.14));
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isSuper ? 0.25 : 0.16));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playSlide() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.14);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  playPowerup() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((f, i) => {
      this._playTone(f, 'triangle', 0.22, 0.1, now + i * 0.055);
    });
  }

  playJoyFever() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [293.66, 369.99, 440, 587.33, 739.99, 880].forEach((f, i) => {
      this._playTone(f, 'sawtooth', 0.34, 0.075, now + i * 0.05, 2200);
    });
  }

  playSmashMeniah() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this._playTone(130, 'sawtooth', 0.18, 0.14, now, 600);
    this._playTone(587.33, 'triangle', 0.24, 0.1, now + 0.04);
    this._playTone(880, 'sine', 0.28, 0.09, now + 0.08);
  }

  playStumble() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    this._playTone(165, 'sawtooth', 0.25, 0.13, now, 420);
    this._playTone(110, 'sawtooth', 0.32, 0.14, now + 0.07, 320);
  }

  playGameOver() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392, 349.23, 311.13, 261.63].forEach((f, i) => {
      this._playTone(f, 'triangle', 0.28, 0.11, now + i * 0.11);
    });
  }

  playVictory() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [392, 493.88, 587.33, 783.99, 987.77, 1174.66].forEach((f, i) => {
      this._playTone(f, 'triangle', 0.38, 0.11, now + i * 0.085);
    });
  }
}

export const sound = new SoundEngine();
