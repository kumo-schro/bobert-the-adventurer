import { Entity } from './Entity.js';
import { SOUND } from '../config.js';

const STORAGE_KEY = 'bobert-music';
const LOOKAHEAD = 0.6; // seconds of notes scheduled ahead of time

// Note numbers (MIDI) -> frequency.
const freq = (n) => 440 * 2 ** ((n - 69) / 12);

// Each mood: tempo, a chord progression (root notes, one chord per bar), the scale the melody
// picks from, and how busy the arpeggio and melody are.
const MOODS = {
  day: { bpm: 96, chords: [[48, 'maj'], [43, 'maj'], [45, 'min'], [41, 'maj']], scale: [72, 74, 76, 79, 81, 84], arp: 0.8, melody: 0.35, wave: 'triangle' },
  night: { bpm: 72, chords: [[45, 'min'], [41, 'maj'], [48, 'maj'], [43, 'maj']], scale: [69, 72, 74, 76, 79], arp: 0.45, melody: 0.2, wave: 'sine' },
  dream: { bpm: 80, chords: [[48, 'maj7'], [50, 'maj7'], [48, 'maj7'], [46, 'maj7']], scale: [76, 78, 79, 83, 86, 88], arp: 0.7, melody: 0.3, wave: 'sine' },
  sea: { bpm: 84, chords: [[50, 'min'], [46, 'maj'], [48, 'maj'], [45, 'min']], scale: [74, 77, 79, 81, 84], arp: 0.55, melody: 0.25, wave: 'sine' },
  boss: { bpm: 132, chords: [[45, 'min'], [41, 'maj'], [43, 'maj'], [40, 'maj']], scale: [69, 72, 74, 76, 79, 81], arp: 1, melody: 0.45, wave: 'square', drums: true },
};
const SHAPES = { maj: [0, 4, 7, 12], min: [0, 3, 7, 12], maj7: [0, 4, 7, 11] };

/**
 * Background music, made on the fly like the sound effects (no music files): a bass line, a
 * twinkly arpeggio and a little melody over four chords. The mood follows where you are: sunny
 * by day, slower at night, floaty in the dream, rolling at sea, and quick and tense in a boss
 * fight. Moods cross-fade at the next bar. Music on/off is in the pause menu (remembered in the
 * browser), and O (all sound) mutes it too. Lives at game.music.
 */
export class Music extends Entity {
  constructor() {
    super();
    try {
      this.enabled = localStorage.getItem(STORAGE_KEY) !== 'off';
    } catch {
      this.enabled = true;
    }
    this.step = 0; // eighth notes since the music started
    this.nextTime = 0;
    this.mood = 'day';
    this.seed = 1;
  }

  onAdd(game) {
    this.game = game;
    game.music = this;
  }

  toggle() {
    this.enabled = !this.enabled;
    try {
      localStorage.setItem(STORAGE_KEY, this.enabled ? 'on' : 'off');
    } catch {
      // storage blocked: just for this visit
    }
  }

  /** Where are we, and what's happening? */
  pickMood(game) {
    if (game.bossBar?.boss) return 'boss';
    const p = game.player.object3d.position;
    if (p.y > 50) return 'dream';
    if (game.player.swimming || game.player.boat) return 'sea';
    return game.dayNight?.isNight ? 'night' : 'day';
  }

  random() {
    // A tiny repeatable random, so the tune has a shape instead of being pure noise.
    this.seed = (this.seed * 16807) % 2147483647;
    return (this.seed - 1) / 2147483646;
  }

  update(_dt, game) {
    const sound = game.sound;
    const ctx = sound?.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (!this.bus) {
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;
      this.bus.connect(sound.master);
    }
    // Off when muted, and a little softer while you read or pause.
    const on = this.enabled && !sound.muted;
    const quiet = game.dialog?.isOpen || game.pauseMenu?.isOpen;
    const level = on ? (quiet ? 0.6 : 1) * SOUND.music : 0;
    this.bus.gain.setTargetAtTime(level, ctx.currentTime, 0.4);
    if (!on) {
      this.nextTime = 0;
      return;
    }

    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.1;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      // Change mood on a bar line (every 8 eighth notes), so it never cuts off mid-phrase.
      if (this.step % 8 === 0) {
        const mood = this.pickMood(game);
        if (mood !== this.mood) {
          this.mood = mood;
          this.step = 0;
          this.seed = 7 + mood.length;
        }
      }
      this.playStep(ctx, MOODS[this.mood], this.nextTime);
      this.nextTime += 30 / MOODS[this.mood].bpm; // an eighth note
      this.step++;
    }
  }

  playStep(ctx, mood, t) {
    const bar = Math.floor(this.step / 8) % mood.chords.length;
    const beat = this.step % 8;
    const [root, shape] = mood.chords[bar];
    const chord = SHAPES[shape].map((i) => root + i);
    const eighth = 30 / mood.bpm;
    // Bass: the root on the first beat, the fifth halfway through the bar.
    if (beat === 0) this.note(ctx, t, root - 12, eighth * 3.5, 0.16, 'triangle');
    if (beat === 4) this.note(ctx, t, root - 5, eighth * 3, 0.11, 'triangle');
    // Arpeggio: up and down the chord, an octave up, with gaps.
    if (this.random() < mood.arp) {
      const order = [0, 1, 2, 3, 2, 1, 2, 1];
      this.note(ctx, t, chord[order[beat]] + 12, eighth * 0.9, mood.wave === 'square' ? 0.025 : 0.05, mood.wave);
    }
    // Melody: now and then, a note from the scale that fits the chord.
    if ((beat === 0 || beat === 3 || beat === 6) && this.random() < mood.melody) {
      const note = mood.scale[Math.floor(this.random() * mood.scale.length)];
      this.note(ctx, t, note, eighth * (beat === 6 ? 2 : 1.6), 0.045, 'sine');
    }
    // Boss fights get a heartbeat drum.
    if (mood.drums && beat % 2 === 0) this.drum(ctx, t, beat % 4 === 0 ? 0.25 : 0.12);
  }

  note(ctx, t, n, length, volume, type) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq(n);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(this.bus);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  drum(ctx, t, volume) {
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(gain).connect(this.bus);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}
