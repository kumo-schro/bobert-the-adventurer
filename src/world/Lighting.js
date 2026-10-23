import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { SKY } from '../config.js';

// The sun's shadows cover a square this many units from its middle, drawn into a
// SHADOW_MAP x SHADOW_MAP texture (about 14 pixels per block). The square follows the player,
// pushed ahead toward where the camera looks, since that's the part you see.
const SHADOW_REACH = 72;
const SHADOW_MAP = 2048;
const TEXEL = (SHADOW_REACH * 2) / SHADOW_MAP;
const SUN_DISTANCE = 150;

// The shadow camera's sideways and up directions (it looks along the sunlight). Moving the
// shadow square only in whole texels along these keeps shadow edges from shimmering.
const SUN_RIGHT = new THREE.Vector3(0, 1, 0).cross(SKY.sunDirection).normalize();
const SUN_UP = SKY.sunDirection.clone().cross(SUN_RIGHT).normalize();
const _center = new THREE.Vector3();
const _forward = new THREE.Vector3();

/**
 * Soft sky/ground ambient light plus a sun that casts shadows. The shadow area follows the
 * player, so things far out at sea (like the tower island) get shadows too.
 */
export class Lighting extends Entity {
  constructor() {
    super();

    const hemi = new THREE.HemisphereLight('#d8eeff', '#7a9c5a', 1.6);
    this.hemi = hemi;
    this.object3d.add(hemi);

    const sun = new THREE.DirectionalLight('#fff3dc', 2.4);
    sun.position.copy(SKY.sunDirection).multiplyScalar(SUN_DISTANCE);
    this.sun = sun;
    sun.castShadow = true;
    Object.assign(sun.shadow.camera, {
      left: -SHADOW_REACH,
      right: SHADOW_REACH,
      top: SHADOW_REACH,
      bottom: -SHADOW_REACH,
      near: 1,
      far: 400,
    });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.object3d.add(sun, sun.target);
  }

  onAdd(game) {
    game.lighting = this;
  }

  update(_dt, game) {
    const p = game.player?.object3d.position;
    if (!p) return;
    // Centered a little ahead of the player, in the direction the camera faces.
    game.camera.getWorldDirection(_forward).setY(0);
    if (_forward.lengthSq() > 1e-6) _forward.normalize().multiplyScalar(SHADOW_REACH * 0.45);
    _center.set(p.x + _forward.x, p.y > 50 ? p.y : 0, p.z + _forward.z); // up in the dream dimension, the shadows come with you
    // Snap to whole shadow-map texels (seen from the sun), so the shadows don't shimmer as it moves.
    const r = Math.round(_center.dot(SUN_RIGHT) / TEXEL) * TEXEL;
    const u = Math.round(_center.dot(SUN_UP) / TEXEL) * TEXEL;
    const f = _center.dot(SKY.sunDirection);
    _center.copy(SUN_RIGHT).multiplyScalar(r).addScaledVector(SUN_UP, u).addScaledVector(SKY.sunDirection, f);
    this.sun.target.position.copy(_center);
    this.sun.position.copy(SKY.sunDirection).multiplyScalar(SUN_DISTANCE).add(_center);
  }
}
