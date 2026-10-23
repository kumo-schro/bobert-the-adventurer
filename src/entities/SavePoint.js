import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { part } from '../models/character.js';
import { saveGame } from '../saves.js';

const TOUCH = 1.8; // walk this close and it saves
const REARM = 5; // walk this far away and it'll save again next time

/**
 * A save point: a glowing crystal floating over a stone stand. There's one on every island.
 * Walk up to it and the game saves straight away, under the name you're playing as (the save
 * you loaded or last saved). If your adventure has no name yet, it opens the saved games menu so
 * you can give it one. It's also where you get back up if you're knocked out.
 */
export class SavePoint extends Entity {
  constructor({ x, y = 0, z }, name = 'a save point') {
    super();
    this.name = name;
    this.object3d.position.set(x, y, z);
    this.armed = true;
    part(this.object3d, [1.0, 0.5, 1.0], '#7d8088', [0, 0.25, 0]);
    part(this.object3d, [0.7, 0.5, 0.7], '#9a9ca3', [0, 0.7, 0]);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(1.1, 1.35, 32),
      new THREE.MeshBasicMaterial({ color: '#7af0ff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.04;
    this.object3d.add(this.ring);
    this.crystal = new THREE.Group();
    this.crystal.position.y = 1.7;
    this.object3d.add(this.crystal);
    const c = part(this.crystal, [0.4, 0.7, 0.4], '#7af0ff', [0, 0, 0], { emissive: '#3fd0ff' });
    c.material.emissiveIntensity = 0.9;
    c.rotation.set(0.3, 0, 0.3);
    this.collider = { x, z, radius: 0.55, sound: 'stone' };
  }

  onAdd(game) {
    game.colliders.push(this.collider);
    game.savePoints = [...(game.savePoints ?? []), this];
  }

  update(dt, game) {
    this.crystal.rotation.y += dt * 1.5;
    this.crystal.position.y = 1.7 + Math.sin(game.elapsed * 2) * 0.12;
    const player = game.player;
    const p = player.object3d.position;
    const pos = this.object3d.position;
    const dist = Math.hypot(p.x - pos.x, p.z - pos.z);
    const near = dist < TOUCH && Math.abs(p.y - pos.y) < 2 && !player.dead && !player.swimming;
    this.ring.material.opacity = 0.35 + Math.sin(game.elapsed * 3) * 0.15 + (near ? 0.3 : 0);
    if (dist > REARM) this.armed = true;
    if (!near || !this.armed || game.isUiOpen()) return;
    this.armed = false;
    player.spawn.copy(p); // knocked out? You'll get back up here.
    if (!game.saveName) {
      game.questLog?.toast('A save crystal! Name your adventure, and every crystal will save it for you. (If you get knocked out, you get back up at the last one you touched.)', { seconds: 7, icon: '💎' });
      game.saveMenu?.open();
      return;
    }
    try {
      saveGame(game, game.saveName);
    } catch {
      game.questLog?.toast("Couldn't save: this browser isn't letting the game store anything.");
      return;
    }
    game.questLog?.toast(`💾 Saved “${game.saveName}”`);
    game.particles?.burst(pos.clone().setY(pos.y + 1.7), { count: 24, colors: ['#7af0ff', '#ffffff', '#3fd0ff'], speed: 3, size: 0.12, gravity: -2 });
    game.sound?.play('magic');
  }
}
