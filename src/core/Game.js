import * as THREE from 'three';
import { Input } from './Input.js';

/**
 * Owns the renderer, scene, camera and the main loop.
 * Everything else is an Entity added with game.add(entity).
 */
export class Game {
  constructor(container) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 4000);
    this.input = new Input(this.renderer.domElement);

    this.entities = [];
    // Shapes characters can't walk through. See core/collision.js.
    this.colliders = [];
    // Every monster currently in the world (they add and remove themselves).
    this.monsters = [];
    // Circles { x, z, radius } where scenery (trees, flowers) shouldn't be placed.
    this.reservedAreas = [];
    // Meshes the camera shouldn't pass through (it zooms in instead).
    this.cameraBlockers = [];
    // The ground entity registers itself here so others can ask about height/bounds.
    this.terrain = null;
    // Other places you can stand on besides the main island (the dock, the tower island...).
    // Each has isInside(x, z, margin) and heightAt(x, z) (null where it doesn't cover).
    this.lands = [];
    // Screens like the dialog box and the shop. While any is open, the world pauses for the player.
    this.ui = [];

    this.elapsed = 0;
    this._last = performance.now();

    window.addEventListener('resize', () => this.resize());
  }

  add(entity) {
    this.entities.push(entity);
    this.scene.add(entity.object3d);
    entity.onAdd(this);
    return entity;
  }

  remove(entity) {
    const i = this.entities.indexOf(entity);
    if (i === -1) return;
    this.entities.splice(i, 1);
    this.scene.remove(entity.object3d);
    entity.onRemove(this);
  }

  /** True while a dialog, shop or other menu is open. */
  isUiOpen() {
    return this.ui.some((u) => u.isOpen);
  }

  /** True if (x, z) is within `margin` of a reserved area (village buildings, paths...). */
  isReserved(x, z, margin = 0) {
    return this.reservedAreas.some((a) => Math.hypot(a.x - x, a.z - z) < a.radius + margin);
  }

  /** Ground height at a world position (the highest of the island, dock, stairs...). */
  heightAt(x, z) {
    let h = this.terrain ? this.terrain.heightAt(x, z) : 0;
    for (const land of this.lands) {
      const lh = land.heightAt(x, z);
      if (lh !== null && lh > h) h = lh;
    }
    return h;
  }

  /** True if (x, z) is somewhere you can walk (not the sea). Positive margin keeps away from the edge. */
  isWalkable(x, z, margin = 0) {
    if (this.terrain?.isInside(x, z, margin)) return true;
    return this.lands.some((land) => land.isInside(x, z, margin));
  }

  /** Move the player somewhere else instantly (down a trapdoor...), with a quick fade. */
  teleport(x, z, { y = 0, facing } = {}) {
    const player = this.player;
    player.object3d.position.set(x, y, z);
    player.velocity.set(0, 0, 0);
    player.swimming = false;
    if (facing !== undefined) player.model.root.rotation.y = facing;
    this.cameraRig?.snap();
    this.statusBar?.fade();
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  start() {
    this.renderer.setAnimationLoop(() => this.tick());
  }

  tick() {
    const now = performance.now();
    // Clamp dt so a backgrounded tab doesn't cause a giant physics step.
    const dt = Math.min((now - this._last) / 1000, 0.05);
    this._last = now;
    this.elapsed += dt;

    for (const entity of this.entities) entity.update(dt, this);
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}
