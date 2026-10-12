import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { SEED, SEA, FOG } from '../config.js';

const DEEP = new THREE.Color('#14608f');
const DREAMY = new THREE.Color('#3a2470');
const SEAWEED = ['#2f8f3a', '#3aa84a', '#1f7a35'];
const CORAL = ['#ff6b8a', '#ff9a3d', '#b46bff', '#ffd23f'];

/**
 * Everything below the waves: a sandy seabed with seaweed, coral and rocks, and the underwater
 * look. When the camera dips under the surface the world turns blue and hazy, and the sky and
 * far-off mountains disappear. It also gives the dream dimension its purple, starry sky.
 * Add it AFTER the camera rig so it sees where the camera ended up.
 */
export class Underwater extends Entity {
  constructor() {
    super();
    this.under = false;
    this.buildSeabed();
  }

  buildSeabed() {
    const rng = createRng(SEED + 131);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), new THREE.MeshLambertMaterial({ color: '#c9b77a' }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = SEA.floor;
    floor.receiveShadow = true;
    this.object3d.add(floor);

    const plants = new VoxelBuilder();
    for (let i = 0; i < 900; i++) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(105, SEA.radius + 30);
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      const roll = rng.next();
      if (roll < 0.6) {
        const h = rng.range(2, 6);
        plants.box(x, SEA.floor + h / 2, z, 0.3, h, 0.3, vary(rng.pick(SEAWEED), rng, 0.06)); // seaweed
        plants.box(x + 0.25, SEA.floor + h * 0.6, z, 0.3, 0.2, 0.2, vary(rng.pick(SEAWEED), rng, 0.06));
      } else if (roll < 0.85) {
        const c = rng.pick(CORAL);
        plants.box(x, SEA.floor + 0.6, z, 0.4, 1.2, 0.4, c); // coral
        plants.box(x + 0.35, SEA.floor + 1.0, z, 0.3, 0.8, 0.3, c);
        plants.box(x - 0.3, SEA.floor + 0.8, z + 0.2, 0.3, 0.6, 0.3, c);
      } else {
        plants.box(x, SEA.floor + 0.5, z, rng.range(1, 2.5), rng.range(0.8, 2), rng.range(1, 2.5), vary('#7d8088', rng, 0.06)); // rock
      }
    }
    this.object3d.add(plants.build({ castShadow: false }));
  }

  onAdd(game) {
    this.game = game;
    game.underwater = this;
  }

  update(_dt, game) {
    const water = game.entities.find((e) => e.constructor.name === 'Water');
    const surface = water ? water.mesh.position.y : SEA.level;
    const cam = game.camera.position;
    // 'under' the sea, up in the 'dream' dimension, or 'normal'.
    const mode = game.dream?.contains(cam.x, cam.y, cam.z) ? 'dream' : cam.y < surface ? 'under' : 'normal';
    const fog = game.scene.fog;
    if (mode !== this.mode) {
      this.mode = mode;
      const special = mode !== 'normal';
      document.body.classList.toggle('underwater', mode === 'under');
      // Hide the faraway things you couldn't see from down there (or up there) anyway.
      for (const name of ['Sky', 'Mountains', 'Clouds']) {
        const e = game.entities.find((x) => x.constructor.name === name);
        if (e) e.object3d.visible = !special;
      }
      if (water) {
        water.mesh.material.side = mode === 'under' ? THREE.BackSide : THREE.FrontSide; // see the surface from below
        water.object3d.visible = mode !== 'dream';
      }
      if (fog) {
        fog.near = mode === 'under' ? 1 : mode === 'dream' ? 30 : FOG.near;
        fog.far = mode === 'under' ? 55 : mode === 'dream' ? 260 : FOG.far;
      }
      game.scene.background = special ? (mode === 'under' ? DEEP : DREAMY).clone() : null;
    }
    this.under = mode === 'under';
    if (special(mode) && fog) {
      // Underwater gets darker at night, like the sky. The dream is always the same.
      const night = mode === 'under' ? (game.dayNight?.nightness ?? 0) : 0;
      fog.color.copy(mode === 'under' ? DEEP : DREAMY).multiplyScalar(1 - night * 0.6);
      game.scene.background.copy(fog.color);
    }
  }
}

const special = (mode) => mode !== 'normal';
