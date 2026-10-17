import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { VoxelBuilder } from '../core/VoxelBuilder.js';
import { dirtMaterial, blockMaterial } from '../core/textures.js';
import { createRng } from '../utils/random.js';
import { vary } from '../utils/color.js';
import { glowMaterial } from './Village.js';
import { SEED, VILLAGE } from '../config.js';

const DIRT = ['#c9a46b', '#bf9a60', '#d1ad75', '#b8925a'];

/**
 * A dirt road from the village plaza, out between two houses, curving down to the dock.
 * Lamp posts light it at night. Exposes `trapdoorSpot`: a clearing beside the road, outside town.
 */
export class Road extends Entity {
  constructor(village, dock) {
    super();
    this.village = village;
    this.dock = dock;
  }

  onAdd(game) {
    const { village, dock } = this;
    const rng = createRng(SEED + 81);
    const tiles = new VoxelBuilder();
    const props = new VoxelBuilder();
    const lamps = new VoxelBuilder();

    // Leave the plaza through the gap between houses that faces the dock.
    const end = new THREE.Vector2(dock.start + 0.5, dock.z);
    const gap = village.gapToward(Math.atan2(end.y, end.x));
    const dir = new THREE.Vector2(Math.cos(gap), Math.sin(gap));
    const start = dir.clone().multiplyScalar(VILLAGE.plazaRadius - 1);
    const bend = dir.clone().multiplyScalar(VILLAGE.ringRadius + 9);
    const control = bend.clone().add(dir.clone().multiplyScalar(end.distanceTo(bend) * 0.45));

    const points = [];
    for (let t = 0; t <= 1; t += 0.5 / start.distanceTo(bend)) points.push(start.clone().lerp(bend, t));
    const curveLength = end.distanceTo(bend) * 1.2;
    for (let t = 0; t <= 1; t += 0.5 / curveLength) {
      const a = bend.clone().lerp(control, t);
      const b = control.clone().lerp(end, t);
      points.push(a.lerp(b, t));
    }

    this.path = points.map((p) => ({ x: p.x, z: p.y })); // from the plaza to the dock (the intro's march uses it)
    game.road = this;
    const done = new Set();
    points.forEach((p, i) => {
      const next = points[Math.min(i + 1, points.length - 1)];
      const prev = points[Math.max(i - 1, 0)];
      const tangent = next.clone().sub(prev).normalize();
      const side = new THREE.Vector2(-tangent.y, tangent.x);
      for (const o of [-1.2, -0.4, 0.4, 1.2]) {
        const tx = Math.floor(p.x + side.x * o) + 0.5;
        const tz = Math.floor(p.y + side.y * o) + 0.5;
        const key = `${tx},${tz}`;
        if (done.has(key) || Math.hypot(tx, tz) < VILLAGE.plazaRadius - 0.5) continue;
        done.add(key);
        tiles.box(tx, 0.03, tz, 1, 0.06, 1, vary(rng.pick(DIRT), rng, 0.04));
      }
      if (i % 3 === 0) game.reservedAreas.push({ x: p.x, z: p.y, radius: 2.4 });
    });

    // Lamp posts every so often along the curve, alternating sides.
    let lampSide = 1;
    for (let i = Math.floor(points.length * 0.3); i < points.length - 6; i += 22) {
      const p = points[i];
      const tangent = points[i + 1].clone().sub(points[i - 1]).normalize();
      const x = p.x - tangent.y * 2.4 * lampSide;
      const z = p.y + tangent.x * 2.4 * lampSide;
      props.box(x, 1.2, z, 0.2, 2.4, 0.2, '#3b3b3b');
      props.box(x, 2.45, z, 0.5, 0.1, 0.5, '#3b3b3b');
      lamps.box(x, 2.2, z, 0.34, 0.4, 0.34, '#ffd23f');
      game.colliders.push({ x, z, radius: 0.25 });
      lampSide = -lampSide;
    }

    // A clearing for the old trapdoor, a little way off the road outside town.
    const mid = points[Math.floor(points.length * 0.55)];
    const t = points[Math.floor(points.length * 0.55) + 1].clone().sub(mid).normalize();
    this.trapdoorSpot = { x: mid.x - t.y * 5, z: mid.y + t.x * 5 };
    game.reservedAreas.push({ ...this.trapdoorSpot, radius: 3 });

    // A signpost where the road leaves the village.
    const sp = points[Math.floor(points.length * 0.12)];
    props.box(sp.x + dir.y * 2, 0.9, sp.y - dir.x * 2, 0.15, 1.8, 0.15, '#5e3b22');
    props.box(sp.x + dir.y * 2, 1.55, sp.y - dir.x * 2, 0.8, 0.35, 0.1, '#c58b52');

    this.object3d.add(tiles.build({ castShadow: false, material: dirtMaterial }), props.build({ material: blockMaterial }), lamps.build({ material: glowMaterial, castShadow: false }));
  }
}
