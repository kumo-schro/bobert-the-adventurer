import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { glowMaterial } from './Village.js';
import { SEED, PLACES } from '../config.js';

const GRASS = ['#b8f2d8', '#f7c6e8', '#d6c8ff', '#c8f0ff'];
const ROCK = ['#6b4fa8', '#5a3f94', '#7d5fc0'];
const RAINBOW = ['#ff6b6b', '#ffb36b', '#ffe66b', '#7dff8a', '#6bc6ff', '#b47dff'];

/**
 * The dream dimension: pastel floating islands high in a starry purple sky, joined by rainbow
 * bridges, with a staircase of cloud stones (you have to jump!) up to a summit. Reached through
 * the portal that opens in the jungle once the Vine is beaten. Registers as walkable land.
 * Exposes `arrive`, `keeperSpot`, `shrineSpot`, `wakeSpot`, `summitSpot`, `starSpots`, `wispSpots`.
 */
export class DreamWorld extends Entity {
  constructor({ x, z, y } = PLACES.dream) {
    super();
    this.center = { x, z };
    this.y = y;
    this.rng = createRng(SEED + 151);
    this.circles = []; // { x, z, r, h }
    this.bridges = []; // { ax, az, bx, bz, w, h }
    this.layout();
    this.build();
  }

  layout() {
    const { x: X, z: Z } = this.center;
    const Y = this.y;
    this.circles.push({ x: X, z: Z, r: 13, h: Y }); // the hub
    this.satellites = [30, 150, 270].map((deg) => {
      const a = THREE.MathUtils.degToRad(deg);
      const s = { x: X + Math.cos(a) * 34, z: Z + Math.sin(a) * 34, r: 8, h: Y };
      this.circles.push(s);
      this.bridges.push({ ax: X + Math.cos(a) * 11, az: Z + Math.sin(a) * 11, bx: s.x - Math.cos(a) * 6, bz: s.z - Math.sin(a) * 6, w: 3, h: Y });
      return s;
    });
    // Cloud stones curving up from the hub to the summit, each one higher: jump from stone to stone.
    // Each stone touches the next (so there's no gap to fall through) and is 1 block higher.
    this.stones = [];
    let sx = X;
    let sz = Z + 14;
    let heading = Math.PI / 2; // heading out from the hub, slowly curving round
    for (let i = 0; i < 12; i++) {
      const stone = { x: sx, z: sz, r: 1.4, h: Y + 1 + i, stone: true };
      this.stones.push(stone);
      this.circles.push(stone);
      heading += THREE.MathUtils.degToRad(12);
      sx += Math.cos(heading) * 2.4;
      sz += Math.sin(heading) * 2.4;
    }
    const last = this.stones.at(-1);
    this.summit = { x: last.x + Math.cos(heading) * 4.6, z: last.z + Math.sin(heading) * 4.6, r: 4.5, h: last.h + 1 };
    this.circles.push(this.summit);

    this.arrive = { x: X, z: Z - 6, facing: Math.PI };
    this.wakeSpot = { x: X - 6, z: Z - 9 };
    this.keeperSpot = { x: X + 4, y: Y, z: Z - 2 };
    this.shrineSpot = { x: X - 5, y: Y, z: Z + 3 };
    this.summitSpot = { x: this.summit.x, y: this.summit.h, z: this.summit.z };
    this.starSpots = [
      ...this.satellites.map((s) => ({ x: s.x + 2, y: Y, z: s.z - 2 })),
      { x: X + 9, y: Y, z: Z + 6 },
      { x: X - 9, y: Y, z: Z - 5 },
    ];
    this.wispSpots = this.satellites.flatMap((s) => [
      { x: s.x + 3, y: Y + 2.5, z: s.z },
      { x: s.x - 3, y: Y + 3, z: s.z + 2 },
    ]);
  }

  /** On a dream island, bridge or cloud stone? */
  isInside(x, z, margin = 0) {
    return this.heightAt(x, z, margin) !== null;
  }

  heightAt(x, z, margin = 0) {
    let h = null;
    for (const c of this.circles) {
      if (Math.hypot(x - c.x, z - c.z) < c.r - margin && (h === null || c.h > h)) h = c.h;
    }
    for (const b of this.bridges) {
      const dx = b.bx - b.ax;
      const dz = b.bz - b.az;
      const len2 = dx * dx + dz * dz;
      const t = THREE.MathUtils.clamp(((x - b.ax) * dx + (z - b.az) * dz) / len2, 0, 1);
      const d = Math.hypot(x - (b.ax + dx * t), z - (b.az + dz * t));
      if (d < b.w / 2 - margin && (h === null || b.h > h)) h = b.h;
    }
    return h;
  }

  build() {
    const { rng } = this;
    const ground = new VoxelBuilder();
    const glow = new VoxelBuilder();
    for (const c of this.circles) {
      const r = c.r;
      for (let ix = Math.floor(c.x - r); ix < c.x + r; ix++) {
        for (let iz = Math.floor(c.z - r); iz < c.z + r; iz++) {
          const x = ix + 0.5;
          const z = iz + 0.5;
          const d = Math.hypot(x - c.x, z - c.z);
          if (d > r) continue;
          if (c.stone) {
            glow.box(x, c.h - 0.4, z, 1, 0.8, 1, '#f4f0ff'); // fluffy cloud stone
            continue;
          }
          ground.box(x, c.h - 0.25, z, 1, 0.5, 1, vary(rng.pick(GRASS), rng, 0.05));
          // A rocky underside that tapers to a point.
          const depth = (1 - d / r) * r * 1.1 + 1;
          ground.box(x, c.h - 0.5 - depth / 2, z, 1, depth, 1, vary(rng.pick(ROCK), rng, 0.06));
        }
      }
      if (!c.stone && c.r > 5) {
        // Crystal trees and glowing mushrooms
        for (let i = 0; i < Math.round(c.r / 2.5); i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(2, c.r - 2);
          const x = c.x + Math.cos(a) * d;
          const z = c.z + Math.sin(a) * d;
          if (Math.hypot(x - this.keeperSpot.x, z - this.keeperSpot.z) < 3 || Math.hypot(x - this.shrineSpot.x, z - this.shrineSpot.z) < 3) continue;
          if (rng.chance(0.5)) {
            ground.box(x, c.h + 1, z, 0.3, 2, 0.3, '#e8e0ff');
            glow.box(x, c.h + 2.4, z, 1.2, 1.2, 1.2, rng.pick(['#b47dff', '#6bc6ff', '#ff8fe0']));
          } else {
            ground.box(x, c.h + 0.3, z, 0.2, 0.6, 0.2, '#ffffff');
            glow.box(x, c.h + 0.7, z, 0.7, 0.25, 0.7, rng.pick(['#ff8fe0', '#7dff8a', '#ffe66b']));
          }
        }
      }
    }
    // Rainbow bridges
    for (const b of this.bridges) {
      const len = Math.hypot(b.bx - b.ax, b.bz - b.az);
      for (let t = 0; t <= len; t += 0.5) {
        const x = b.ax + ((b.bx - b.ax) * t) / len;
        const z = b.az + ((b.bz - b.az) * t) / len;
        RAINBOW.forEach((color, i) => {
          const off = (i - 2.5) * 0.5;
          const px = x - ((b.bz - b.az) / len) * off;
          const pz = z + ((b.bx - b.ax) / len) * off;
          glow.box(px, b.h - 0.15, pz, 0.55, 0.3, 0.55, color);
        });
      }
    }
    this.object3d.add(ground.build(), glow.build({ material: glowMaterial, castShadow: false }));

    // The way home: a glowing doorway on the hub.
    this.wakePortal = createPortalModel('#ffe66b');
    this.wakePortal.position.set(this.wakeSpot.x, this.y, this.wakeSpot.z);
    this.object3d.add(this.wakePortal);

    // Stars all around (this sky is always night).
    const positions = [];
    for (let i = 0; i < 900; i++) {
      const a = rng.range(0, Math.PI * 2);
      const b = rng.range(-0.3, 1);
      const r = rng.range(160, 260);
      positions.push(this.center.x + Math.cos(a) * r * Math.cos(b), this.y + Math.sin(b) * r, this.center.z + Math.sin(a) * r * Math.cos(b));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.object3d.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: '#ffffff', size: 2.5, sizeAttenuation: false, fog: false })));
  }

  onAdd(game) {
    game.lands.push(this);
    game.dream = this;
  }

  /**
   * Wandering wisps float around the islands. Each one popped gives dream points, and comes
   * back after a while, so you can always earn more for the shrine. `makeWisp(spot)` builds one.
   */
  addWanderingWisps(game, makeWisp, { dreamPoints, respawnSeconds }) {
    const spots = [
      ...this.satellites.map((s) => ({ x: s.x - 4, y: this.y + 3, z: s.z + 3 })),
      { x: this.center.x + 8, y: this.y + 3.5, z: this.center.z - 8 },
      { x: this.center.x - 9, y: this.y + 3, z: this.center.z + 7 },
    ];
    const spawn = (spot) => {
      const wisp = game.add(makeWisp(spot));
      wisp.dreamPoints = dreamPoints;
      wisp.respawnSeconds = respawnSeconds;
      wisp.respawn = spawn;
      return wisp;
    };
    spots.forEach(spawn);
  }

  /** Is (x, y, z) up in the dream dimension? */
  contains(x, y, z) {
    return y > this.y - 40 && Math.hypot(x - this.center.x, z - this.center.z) < 120;
  }

  update(dt, game) {
    this.wakePortal.rotation.y += dt;
    const player = game.player;
    if (player.dead || game.isUiOpen()) return;
    const p = player.object3d.position;
    const d = Math.hypot(p.x - this.wakeSpot.x, p.z - this.wakeSpot.z);
    if (d < 2.5 && Math.abs(p.y - this.y) < 2) {
      game.dialog.offerInteraction('Press T to wake up (back to the jungle)', d, () => game.dreamPortal.goBack(game));
    }
  }
}

/** A spinning ring of glowing blocks: a doorway between worlds. */
function createPortalModel(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
  const geo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(Math.cos(a) * 1.6, 1.8 + Math.sin(a) * 1.6, 0);
    g.add(m);
  }
  const middle = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  middle.position.y = 1.8;
  g.add(middle);
  return g;
}

/**
 * The dream portal in the jungle. Hidden until the Vine is defeated; then press T next to it
 * to enter the dream dimension. Lives at game.dreamPortal.
 */
export class DreamPortal extends Entity {
  constructor({ x, z }) {
    super();
    this.spot = { x, z };
    this.isOpen = false; // not a menu: "open" means the portal has appeared
    this.model = createPortalModel('#b47dff');
    this.object3d.add(this.model);
    this.object3d.position.set(x, 0, z);
    this.object3d.visible = false;
  }

  onAdd(game) {
    game.dreamPortal = this;
  }

  open(game) {
    this.opened = true;
    this.object3d.visible = true;
    game.particles?.burst(this.object3d.position.clone().setY(1.8), { count: 60, colors: ['#b47dff', '#ff8fe0', '#ffffff'], speed: 6, size: 0.2 });
    game.questLog?.toast('A shimmering portal opened where the Vine was! It leads to the dream dimension.', 5);
  }

  enter(game) {
    const a = game.dream.arrive;
    game.teleport(a.x, a.z, { y: game.dream.y, facing: a.facing });
    game.questLog.toast('You stepped into the dream dimension...');
  }

  goBack(game) {
    game.teleport(this.spot.x, this.spot.z + 2.5, { facing: 0 });
  }

  update(dt, game) {
    if (!this.opened) return;
    this.model.rotation.y += dt;
    const player = game.player;
    if (player.dead || game.isUiOpen()) return;
    const p = player.object3d.position;
    const d = Math.hypot(p.x - this.spot.x, p.z - this.spot.z);
    if (d < 2.6 && p.y < 5) game.dialog.offerInteraction('Press T to enter the dream dimension', d, () => this.enter(game));
  }
}
