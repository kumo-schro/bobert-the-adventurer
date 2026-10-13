import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { cloudMaterial } from './Clouds.js';
import { SKY, DAY } from '../config.js';

// Colors at noon and at midnight; dusk and dawn get a warm glow on top.
const DAYTIME = {
  top: SKY.top,
  middle: SKY.middle,
  horizon: SKY.horizon,
  sun: SKY.sun,
  sunLight: '#fff0d6',
  hemiSky: '#efe2ff',
  hemiGround: '#8a64d8', // violet bounce light: shadows are purple, never grey
};
const NIGHTTIME = {
  top: '#060b2b',
  middle: '#14205a',
  horizon: '#2e3570',
  sun: '#e8eeff', // the moon
  sunLight: '#9fb4ff',
  hemiSky: '#5a6fb0',
  hemiGround: '#2b3550',
};
const DUSK = '#ff9a6b';

const _a = new THREE.Color();
const _b = new THREE.Color();
const mix = (from, to, t, target) => target.copy(_a.set(from)).lerp(_b.set(to), t);

/**
 * Day and night: one whole cycle every DAY.length seconds (two minutes). Only the lighting
 * changes: sun and sky colors, stars, fog. Lives at game.dayNight.
 *   daylight  1 at noon, 0 at night
 *   nightness 1 - daylight
 *   isNight   true when it's dark enough for villagers to go to bed
 */
export class DayNight extends Entity {
  constructor() {
    super();
    this.time = DAY.startAt; // 0..1 through the day (0 = sunrise)
    this.daylight = 1;
  }

  onAdd(game) {
    game.dayNight = this;
  }

  get nightness() {
    return 1 - this.daylight;
  }

  get isNight() {
    return this.daylight < 0.4;
  }

  update(dt, game) {
    this.time = (this.time + dt / DAY.length) % 1;
    const f = Math.sin(this.time * Math.PI * 2) + 0.35; // a bit more day than night
    this.daylight = THREE.MathUtils.smoothstep(f, -0.25, 0.35);
    const n = this.nightness;
    const dusk = Math.max(0, 1 - Math.abs(this.daylight - 0.5) * 2.5); // peaks halfway between day and night

    const { sky, lighting } = game;
    if (sky) {
      const u = sky.uniforms;
      mix(DAYTIME.top, NIGHTTIME.top, n, u.topColor.value);
      mix(DAYTIME.middle, NIGHTTIME.middle, n, u.middleColor.value).lerp(_a.set(DUSK), dusk * 0.25);
      mix(DAYTIME.horizon, NIGHTTIME.horizon, n, u.horizonColor.value).lerp(_a.set(DUSK), dusk * 0.6);
      mix(DAYTIME.sun, NIGHTTIME.sun, n, u.sunColor.value);
      sky.stars.material.opacity = THREE.MathUtils.smoothstep(n, 0.5, 0.9);
      game.scene.fog?.color.copy(u.horizonColor.value);
    }
    if (lighting) {
      lighting.sun.intensity = 2.5 * this.daylight + 0.45 * n;
      mix(DAYTIME.sunLight, NIGHTTIME.sunLight, n, lighting.sun.color).lerp(_a.set(DUSK), dusk * 0.4);
      lighting.hemi.intensity = 1.7 * this.daylight + 0.75 * n;
      mix(DAYTIME.hemiSky, NIGHTTIME.hemiSky, n, lighting.hemi.color);
      mix(DAYTIME.hemiGround, NIGHTTIME.hemiGround, n, lighting.hemi.groundColor);
    }
    cloudMaterial.emissiveIntensity = 0.05 + 0.3 * this.daylight;

    if (this.isNight !== this.wasNight) {
      if (this.wasNight !== undefined) {
        game.questLog?.toast(
          this.isNight
            ? 'Night falls... the townsfolk go home, and monsters get stronger!'
            : 'Good morning! The sun is up and the village wakes up.',
        );
      }
      this.wasNight = this.isNight;
    }
  }
}
