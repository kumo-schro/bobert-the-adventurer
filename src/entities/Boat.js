import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { pushOut } from '../core/collision.js';
import { part } from '../models/character.js';
import { SEA, BOAT } from '../config.js';

const RADIUS = 1.3;
const _seat = new THREE.Vector3();

/**
 * Bobert's sailboat. It's unlocked once you've been to the jungle: build it at the end of the
 * dock for BOAT.price coins. Get in (T), steer with the move keys (Shift to go faster), and press T out
 * at sea for the boat map (sail to the jungle, sail home, or hop out and swim). Near land, T gets
 * you out. Sea monsters live underwater, so they can't get you in the boat. Lives at game.boat.
 */
export class Boat extends Entity {
  constructor(dock, menu) {
    super();
    this.dock = dock;
    this.menu = menu; // the boat map (a Shop menu with sailing choices)
    this.built = false;
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.object3d.visible = false;
    this.buildModel();
  }

  buildModel() {
    const hull = '#a0522d';
    const dark = '#6b3a1f';
    const g = new THREE.Group();
    this.model = g;
    this.object3d.add(g);
    part(g, [2, 0.5, 4.4], hull, [0, 0, 0]); // bottom
    for (const side of [-1, 1]) part(g, [0.18, 0.7, 4.4], dark, [side * 1.05, 0.4, 0]); // sides
    part(g, [2.2, 0.7, 0.2], dark, [0, 0.4, -2.2]); // back
    part(g, [1.4, 0.8, 0.6], hull, [0, 0.45, 2.3]); // pointy front
    part(g, [0.7, 0.8, 0.4], hull, [0, 0.5, 2.7]);
    part(g, [1.8, 0.12, 0.5], '#c58b52', [0, 0.45, -0.4]); // seat
    part(g, [0.15, 4.2, 0.15], dark, [0, 2.2, 0.8]); // mast
    const sail = part(g, [0.06, 3, 2], '#ffffff', [0, 2.5, -0.2]); // sail
    sail.castShadow = true;
    part(g, [0.07, 0.5, 2.02], '#d9293f', [0, 2.2, -0.2]); // red stripe
    part(g, [0.04, 0.4, 0.6], '#ffd23f', [0, 4.2, 1.1]); // flag
  }

  onAdd(game) {
    this.game = game;
    game.boat = this;
    this.mooring = { x: this.dock.end + 2.2, z: this.dock.z + 3.4 };
    this.object3d.position.set(this.mooring.x, SEA.level, this.mooring.z);
  }

  build(game) {
    const player = game.player;
    if (player.coins < BOAT.price) {
      game.questLog.toast(`You need ${BOAT.price - player.coins} more coins to build a boat.`, { icon: '⛵' });
      game.sound?.play('deny');
      return;
    }
    player.coins -= BOAT.price;
    game.sound?.play('buy');
    this.built = true;
    this.object3d.visible = true;
    game.particles?.burst(this.object3d.position.clone().setY(1), { count: 50, colors: ['#a0522d', '#ffffff', '#ffd23f'], speed: 6, size: 0.18 });
    game.questLog.toast('You built a boat! Press T to get in.', { icon: '⛵' });
  }

  get boarded() {
    return this.game?.player.boat === this;
  }

  board(game) {
    const player = game.player;
    player.boat = this;
    player.swimming = false;
    player.velocity.set(0, 0, 0);
    this.heading = player.model.root.rotation.y;
    game.questLog.toast('All aboard! Steer with the move keys. Press T for the boat map, or near land to get out.');
  }

  /** Step out onto the nearest bit of land (or the dock). */
  getOut(game) {
    const player = game.player;
    const spot = this.nearestLand(game);
    if (!spot) return;
    player.boat = null;
    player.object3d.position.set(spot.x, game.heightAt(spot.x, spot.z), spot.z);
    player.model.root.position.set(0, 0, 0);
    player.velocity.set(0, 0, 0);
  }

  /** Jump over the side into the sea. */
  hopOut(game) {
    const player = game.player;
    player.boat = null;
    player.model.root.position.set(0, 0, 0);
    const pos = this.object3d.position;
    player.object3d.position.set(pos.x + Math.cos(this.heading) * 2, SEA.level, pos.z - Math.sin(this.heading) * 2);
  }

  /** Sail somewhere far away (the jungle, or home to the dock). */
  sailTo(game, x, z, heading = 0) {
    this.object3d.position.set(x, SEA.level, z);
    this.heading = heading;
    this.velocity.set(0, 0, 0);
    const seat = this.seat();
    game.teleport(seat.x, seat.z, { y: seat.y, facing: heading });
    game.player.boat = this; // teleport doesn't take you out of the boat
  }

  nearestLand(game) {
    const pos = this.object3d.position;
    for (let r = 1.5; r <= 4.5; r += 0.5) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
        const x = pos.x + Math.cos(a) * r;
        const z = pos.z + Math.sin(a) * r;
        if (game.isWalkable(x, z) && game.heightAt(x, z) < 1) return { x, z };
      }
    }
    return null;
  }

  /** Can the boat be here? Open water in the home sea or around the jungle island. */
  canSail(game, x, z) {
    if (game.isWalkable(x, z, -1.6)) return false;
    if (Math.hypot(x, z) < SEA.radius) return true;
    const j = game.jungle;
    return !!j && Math.hypot(x - j.center.x, z - j.center.z) < j.radius + 45;
  }

  seat() {
    const pos = this.object3d.position;
    return _seat.set(pos.x - Math.sin(this.heading) * 0.4, pos.y + 0.5, pos.z - Math.cos(this.heading) * 0.4);
  }

  /** Called by the player each frame while aboard: steer with the camera-relative move direction. */
  drive(dt, game, move, fast) {
    const speed = fast ? BOAT.fastSpeed : BOAT.speed;
    const k = 1 - Math.exp(-2 * dt);
    this.velocity.x += (move.x * speed - this.velocity.x) * k;
    this.velocity.z += (move.z * speed - this.velocity.z) * k;
    const pos = this.object3d.position;
    const nx = pos.x + this.velocity.x * dt;
    const nz = pos.z + this.velocity.z * dt;
    if (this.canSail(game, nx, pos.z)) pos.x = nx;
    else this.velocity.x = 0;
    if (this.canSail(game, pos.x, nz)) pos.z = nz;
    else this.velocity.z = 0;
    pushOut(pos, RADIUS, game.colliders);
    if (Math.hypot(this.velocity.x, this.velocity.z) > 0.5) {
      const target = Math.atan2(this.velocity.x, this.velocity.z);
      this.heading += Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading)) * (1 - Math.exp(-3 * dt));
    }
    return this.seat();
  }

  update(dt, game) {
    const pos = this.object3d.position;
    pos.y = SEA.level + Math.sin(game.elapsed * 1.6) * 0.08;
    this.object3d.rotation.y = this.heading;
    this.model.rotation.z = Math.sin(game.elapsed * 1.3) * 0.04; // gentle rocking

    const player = game.player;
    if (player.dead || game.isUiOpen()) return;
    const p = player.object3d.position;

    if (this.boarded) {
      if (this.nearestLand(game)) game.dialog.offerInteraction('Press T to get out of the boat', 0.5, () => this.getOut(game));
      else game.dialog.offerInteraction('Press T for the boat map', 0.5, () => this.menu.open());
      return;
    }
    if (!this.built) {
      const d = Math.hypot(p.x - this.dock.end, p.z - this.dock.z);
      if (player.visitedJungle && d < 4) {
        game.dialog.offerInteraction(`Press T to build a boat (${BOAT.price} coins)`, d, () => this.build(game));
      }
      return;
    }
    const d = Math.hypot(p.x - pos.x, p.z - pos.z);
    if (d < 5.6) game.dialog.offerInteraction('Press T to get in the boat', d, () => this.board(game)); // (reachable from where you build it)
  }
}
