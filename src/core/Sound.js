import { Entity } from './Entity.js';
import { SOUND } from '../config.js';

const STORAGE_KEY = 'bobert-sound';

/**
 * Little sound effects, made on the fly with Web Audio (no sound files): game.sound.play('wood').
 *
 *   swish   a sword swing through the air
 *   thwack  the sword hitting a monster
 *   squish  hitting something soft and slimy (slimes, frogs, fly traps)
 *   stone   hitting stone (gargoyles, boulders, walls)
 *   wood    hitting wood (trees, chests, training posts, the Vine)
 *   thump   the extra weight of a finisher or a spin
 *   block   a hit bouncing off your shield
 *   jump, land, splash, swim     moving around (swim is one stroke of the front crawl)
 *   coin, pickup, chest, eat, hurt, bow, dash, boing, dodge, magic, quest   everything else
 *
 * Browsers only allow sound after the player has pressed a key or clicked, so the audio starts
 * then. M turns sound on and off (remembered in the browser). Lives at game.sound.
 */
export class Sound extends Entity {
  constructor() {
    super();
    this.ctx = null;
    try {
      this.muted = localStorage.getItem(STORAGE_KEY) === 'off';
    } catch {
      this.muted = false;
    }
    const unlock = () => {
      this.start();
      if (this.ctx?.state === 'running') {
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('pointerdown', unlock);
      }
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  }

  onAdd(game) {
    game.sound = this;
  }

  start() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = SOUND.volume;
      this.master.connect(this.ctx.destination);
      // A short burst of white noise, reused by every sound that needs a "shhh" or a crack.
      const length = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  update(_dt, game) {
    if (!game.input.hit('mute')) return;
    this.muted = !this.muted;
    try {
      localStorage.setItem(STORAGE_KEY, this.muted ? 'off' : 'on');
    } catch {
      // storage blocked: just for this visit
    }
    game.questLog?.toast(this.muted ? '🔇 Sound off (M to turn it back on)' : '🔊 Sound on');
  }

  /** Play a sound by name. volume 0..1 on top of SOUND.volume. */
  play(name, { volume = 1 } = {}) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    const recipe = RECIPES[name];
    if (!recipe) return;
    const pitch = 0.9 + Math.random() * 0.2; // a little different every time
    recipe(this, this.ctx.currentTime, volume, pitch);
  }

  // ---- Building blocks ----

  /** A burst of filtered noise. */
  noise(t, { duration, volume, type = 'bandpass', frequency, endFrequency = frequency, q = 1 }) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(frequency, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration);
    const gain = this.envelope(t, duration, volume);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
    src.stop(t + duration + 0.02);
  }

  /** A short tone that slides from one pitch to another. */
  tone(t, { duration, volume, type = 'sine', frequency, endFrequency = frequency }) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), t + duration);
    const gain = this.envelope(t, duration, volume);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  /** Quick attack, then fade out over `duration`. */
  envelope(t, duration, volume) {
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    return gain;
  }
}

const RECIPES = {
  swish(s, t, v, p) {
    s.noise(t, { duration: 0.16, volume: 0.12 * v, frequency: 900 * p, endFrequency: 3200 * p, q: 1.5 });
  },
  thwack(s, t, v, p) {
    s.noise(t, { duration: 0.09, volume: 0.5 * v, type: 'lowpass', frequency: 2400 * p, endFrequency: 500 });
    s.tone(t, { duration: 0.14, volume: 0.45 * v, frequency: 190 * p, endFrequency: 70 });
  },
  squish(s, t, v, p) {
    s.noise(t, { duration: 0.16, volume: 0.35 * v, type: 'lowpass', frequency: 900 * p, endFrequency: 200 });
    s.tone(t, { duration: 0.18, volume: 0.35 * v, type: 'triangle', frequency: 340 * p, endFrequency: 110 });
  },
  stone(s, t, v, p) {
    s.noise(t, { duration: 0.06, volume: 0.4 * v, type: 'highpass', frequency: 2600 * p });
    s.tone(t, { duration: 0.12, volume: 0.25 * v, type: 'triangle', frequency: 950 * p, endFrequency: 620 * p });
    s.tone(t, { duration: 0.08, volume: 0.25 * v, frequency: 140 * p, endFrequency: 60 });
  },
  wood(s, t, v, p) {
    s.noise(t, { duration: 0.07, volume: 0.45 * v, frequency: 900 * p, q: 3 });
    s.tone(t, { duration: 0.1, volume: 0.35 * v, type: 'square', frequency: 230 * p, endFrequency: 170 * p });
  },
  thump(s, t, v, p) {
    s.tone(t, { duration: 0.25, volume: 0.5 * v, frequency: 110 * p, endFrequency: 40 });
  },
  block(s, t, v, p) {
    s.tone(t, { duration: 0.18, volume: 0.25 * v, type: 'triangle', frequency: 1300 * p, endFrequency: 900 * p });
    s.noise(t, { duration: 0.05, volume: 0.3 * v, type: 'highpass', frequency: 3000 });
  },
  jump(s, t, v, p) {
    s.tone(t, { duration: 0.14, volume: 0.18 * v, type: 'triangle', frequency: 260 * p, endFrequency: 520 * p });
  },
  land(s, t, v, p) {
    s.noise(t, { duration: 0.08, volume: 0.25 * v, type: 'lowpass', frequency: 700 * p, endFrequency: 200 });
    s.tone(t, { duration: 0.08, volume: 0.15 * v, frequency: 90 * p, endFrequency: 50 });
  },
  splash(s, t, v, p) {
    s.noise(t, { duration: 0.45, volume: 0.4 * v, type: 'lowpass', frequency: 3000 * p, endFrequency: 300 });
    s.noise(t + 0.03, { duration: 0.25, volume: 0.2 * v, type: 'highpass', frequency: 4000 * p });
  },
  swim(s, t, v, p) {
    s.noise(t, { duration: 0.22, volume: 0.12 * v, frequency: 700 * p, endFrequency: 1400 * p, q: 0.8 });
  },
  coin(s, t, v, p) {
    s.tone(t, { duration: 0.08, volume: 0.15 * v, type: 'square', frequency: 988 * p });
    s.tone(t + 0.07, { duration: 0.22, volume: 0.15 * v, type: 'square', frequency: 1319 * p });
  },
  pickup(s, t, v, p) {
    [523, 659, 784, 1047].forEach((f, i) => s.tone(t + i * 0.06, { duration: 0.12, volume: 0.15 * v, type: 'triangle', frequency: f * p }));
  },
  chest(s, t, v, p) {
    s.tone(t, { duration: 0.2, volume: 0.15 * v, type: 'sawtooth', frequency: 120 * p, endFrequency: 180 * p });
    [784, 988, 1175].forEach((f, i) => s.tone(t + 0.15 + i * 0.07, { duration: 0.18, volume: 0.13 * v, type: 'triangle', frequency: f * p }));
  },
  eat(s, t, v, p) {
    for (let i = 0; i < 3; i++) s.noise(t + i * 0.09, { duration: 0.05, volume: 0.25 * v, frequency: 1800 * p, q: 2 });
  },
  hurt(s, t, v, p) {
    s.tone(t, { duration: 0.22, volume: 0.22 * v, type: 'square', frequency: 330 * p, endFrequency: 150 * p });
  },
  bow(s, t, v, p) {
    s.tone(t, { duration: 0.2, volume: 0.25 * v, type: 'triangle', frequency: 180 * p, endFrequency: 120 * p });
    s.noise(t, { duration: 0.12, volume: 0.15 * v, frequency: 2500 * p, endFrequency: 800, q: 1 });
  },
  dash(s, t, v, p) {
    s.noise(t, { duration: 0.25, volume: 0.25 * v, frequency: 600 * p, endFrequency: 3000 * p, q: 1 });
  },
  dodge(s, t, v, p) {
    s.noise(t, { duration: 0.18, volume: 0.2 * v, frequency: 2000 * p, endFrequency: 700 * p, q: 1.2 });
  },
  boing(s, t, v, p) {
    s.tone(t, { duration: 0.35, volume: 0.25 * v, frequency: 180 * p, endFrequency: 700 * p });
  },
  magic(s, t, v, p) {
    [880, 1109, 1319].forEach((f, i) => s.tone(t + i * 0.05, { duration: 0.25, volume: 0.1 * v, frequency: f * p }));
  },
  quest(s, t, v) {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => s.tone(t + i * 0.09, { duration: 0.2, volume: 0.14 * v, type: 'triangle', frequency: f }));
  },
};
