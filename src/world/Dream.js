import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { gardenMaterial } from '../style/garden.js';
import { instances } from '../style/models.js';
import { createRng } from '../utils/random.js';
import { SEED, PLACES } from '../config.js';

// Concentric pastel rings across each island's top, middle outward.
const RINGS = ['#7dffd8', '#b49cff', '#ff9ad8', '#ffc08a', '#8ad8ff', '#c8ff8a'];
const ROCK_TOP = new THREE.Color('#8a6cd8');
const ROCK_TIP = new THREE.Color('#3a1f78');
const RAINBOW = ['#ff6b6b', '#ffb36b', '#ffe66b', '#7dff8a', '#6bc6ff', '#b47dff'];
const CRYSTALS = ['#b47dff', '#6bc6ff', '#ff8fe0'];
const CAPS = ['#ff8fe0', '#7dff8a', '#ffe66b'];

const islandMaterial = gardenMaterial({ rim: 0.15, glow: 0.18 }); // softly luminous in the dream's night
islandMaterial.vertexColors = true;
const rockMaterial = gardenMaterial({ rim: 0.5, rimColor: '#c8a8ff' });
rockMaterial.vertexColors = true;
rockMaterial.flatShading = true;
const glowingMaterial = gardenMaterial({ glow: 0.75, rim: 0.4 }); // glows in each instance's own color
const cloudStoneMaterial = gardenMaterial({ color: '#f8f2ff', glow: 0.35, rim: 0.7, rimColor: '#ffd6f6' });
cloudStoneMaterial.flatShading = true;

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
    const crystals = [];
    const mushrooms = [];
    const stems = new VoxelBuilder();
    const stones = [];
    for (const c of this.circles) {
      if (c.stone) {
        stones.push(this.cloudStone(c));
        continue;
      }
      this.object3d.add(this.floatingIsland(c));
      if (c.r > 5) {
        // Crystal trees and glowing toadstools
        for (let i = 0; i < Math.round(c.r / 2.5); i++) {
          const a = rng.range(0, Math.PI * 2);
          const d = rng.range(2, c.r - 2);
          const x = c.x + Math.cos(a) * d;
          const z = c.z + Math.sin(a) * d;
          if (Math.hypot(x - this.keeperSpot.x, z - this.keeperSpot.z) < 3 || Math.hypot(x - this.shrineSpot.x, z - this.shrineSpot.z) < 3) continue;
          if (rng.chance(0.5)) {
            stems.box(x, c.h + 1, z, 0.3, 2, 0.3, '#e8e0ff');
            crystals.push({ x, y: c.h + 2.5, z, rotation: rng.range(0, Math.PI), color: rng.pick(CRYSTALS) });
          } else {
            mushrooms.push({ x, y: c.h, z, rotation: rng.range(0, Math.PI * 2), scale: rng.range(0.5, 0.8), color: rng.pick(CAPS) });
          }
        }
      }
    }
    this.object3d.add(new THREE.Mesh(mergeGeometries(stones), cloudStoneMaterial));
    this.object3d.add(stems.build({ castShadow: false }), this.crystalMesh(crystals));
    this.object3d.add(instances('mushroom', mushrooms, { castShadow: false, materials: { cap: glowingMaterial } }));
    this.object3d.add(this.rainbowBridges());

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

  /** A floating island: a gently domed top in pastel rings, over a faceted crystal-rock underside. */
  floatingIsland(c) {
    const { rng } = this;
    const segments = 40;
    const rings = RINGS.length * 2;
    const top = [];
    const topColors = [];
    const color = new THREE.Color();
    // Top: rings of vertices from the middle out to the rim.
    for (let r = 0; r <= rings; r++) {
      const d = (r / rings) * c.r;
      for (let s = 0; s < segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        const y = 0.12 * (1 - (d / c.r) ** 2);
        top.push(c.x + Math.cos(a) * d, c.h + y, c.z + Math.sin(a) * d);
        color.set(RINGS[Math.floor(r / 2) % RINGS.length]);
        topColors.push(color.r, color.g, color.b);
      }
    }
    const index = [];
    for (let r = 0; r < rings; r++) {
      for (let s = 0; s < segments; s++) {
        const a = r * segments + s;
        const b = r * segments + ((s + 1) % segments);
        index.push(a, b, a + segments, b, b + segments, a + segments);
      }
    }
    const topGeometry = new THREE.BufferGeometry();
    topGeometry.setAttribute('position', new THREE.Float32BufferAttribute(top, 3));
    topGeometry.setAttribute('color', new THREE.Float32BufferAttribute(topColors, 3));
    topGeometry.setIndex(index);
    topGeometry.computeVertexNormals();

    // Underside: a jagged cone of crystal rock hanging down to a point.
    const depth = c.r * 1.1 + 1;
    const profile = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const w = i === steps ? 0.01 : c.r * (1 - t) ** 0.8 * (i === 0 ? 1 : rng.range(0.85, 1.05));
      profile.push(new THREE.Vector2(w, -t * depth));
    }
    const under = new THREE.LatheGeometry(profile, Math.max(9, Math.round(c.r * 1.4))).translate(c.x, c.h, c.z);
    const pos = under.attributes.position;
    const colors = [];
    for (let i = 0; i < pos.count; i++) {
      color.copy(ROCK_TOP).lerp(ROCK_TIP, (c.h - pos.getY(i)) / depth);
      colors.push(color.r, color.g, color.b);
    }
    under.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    under.computeVertexNormals();

    const group = new THREE.Group();
    const surface = new THREE.Mesh(topGeometry, islandMaterial);
    surface.receiveShadow = true;
    const rock = new THREE.Mesh(under, rockMaterial);
    group.add(surface, rock);
    return group;
  }

  /** A puffy faceted cloud to jump on (a few squashed lumps). */
  cloudStone(c) {
    const { rng } = this;
    const lumps = [[0, 0, 1], [0.6, 0.15, 0.6], [-0.55, 0.1, 0.65]].map(([dx, dy, s]) => {
      const a = rng.range(0, Math.PI * 2);
      return new THREE.IcosahedronGeometry(c.r * s, 1)
        .scale(1, 0.45, 1)
        .translate(c.x + Math.cos(a) * dx, c.h - 0.4 + dy, c.z + Math.sin(a) * dx);
    });
    return mergeGeometries(lumps);
  }

  /** Long glowing crystals on top of the crystal trees. */
  crystalMesh(list) {
    const geometry = new THREE.OctahedronGeometry(0.7, 0).scale(0.8, 1.6, 0.8);
    const mesh = new THREE.InstancedMesh(geometry, glowingMaterial, list.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    list.forEach((it, i) => {
      mesh.setMatrixAt(i, m.compose(new THREE.Vector3(it.x, it.y, it.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.rotation), one));
      mesh.setColorAt(i, new THREE.Color(it.color));
    });
    mesh.computeBoundingSphere();
    return mesh;
  }

  /** Each bridge is six glowing stripes, one per color of the rainbow. */
  rainbowBridges() {
    const b = new VoxelBuilder();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    for (const br of this.bridges) {
      const dx = br.bx - br.ax;
      const dz = br.bz - br.az;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      RAINBOW.forEach((color, i) => {
        const off = (i - 2.5) * 0.5;
        const x = (br.ax + br.bx) / 2 - (dz / len) * off;
        const z = (br.az + br.bz) / 2 + (dx / len) * off;
        b.box(x, br.h - 0.15, z, len + 0.6, 0.3, 0.52, color, q.clone().setFromAxisAngle(up, -angle));
      });
    }
    return b.build({ material: glowingMaterial, castShadow: false });
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
