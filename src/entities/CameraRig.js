import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { CAMERA } from '../config.js';

const _dir = new THREE.Vector3();

const CONVERSATION_DISTANCE = 7;
const UNDERWATER_DISTANCE = 12;
// Inside caves (and Keegan's cellar) the camera looks down from above (the roof is cut away).
const MODES = {
  cave: { minPitch: 1.05, maxDistance: 11 },
  indoor: { minPitch: 0.95, maxDistance: 9 },
};

/**
 * Overhead camera that follows a target entity, always looking down from above. Drag (left or
 * right mouse) to orbit, scroll or -/= to zoom, Q/E to turn, R/G to tilt (but never down low),
 * and C to swing round behind the player.
 * While a dialog with a `focus` entity is open, it swings round to show both characters side-on.
 * When game.cameraMode is 'cave' or 'indoor' it tilts down to look in from above.
 */
export class CameraRig extends Entity {
  constructor(target, { yaw = CAMERA.yaw, pitch = CAMERA.pitch, distance = CAMERA.distance } = {}) {
    super();
    this.target = target;
    this.yaw = yaw;
    this.pitch = pitch;
    this.distance = distance;
    this.zoom = distance; // smoothed distance actually used
    this.tilt = pitch; // smoothed pitch actually used
    this.focus = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
  }

  onAdd(game) {
    game.cameraRig = this;
    this.game = game;
    this.focus.copy(this.target.object3d.position);
    this.update(0, game);
  }

  /** Give the camera a little shake (0.1 = a tap, 0.4 = a big thump). */
  shake(amount) {
    this.shakeAmount = Math.max(this.shakeAmount ?? 0, amount);
  }

  /** Jump straight to the target (after a teleport), looking from behind it. */
  snap() {
    this.yaw = this.target.model.root.rotation.y + Math.PI;
    this.focus.copy(this.target.object3d.position);
    this.update(0, this.game);
  }

  update(dt, game) {
    const { input, camera } = game;

    const turn = input.drag.dx * 0.008 - input.axisOf('camRight', 'camLeft') * 2.6 * dt;
    const tilt = input.drag.dy * 0.006 + input.axisOf('tiltDown', 'tiltUp') * 1.5 * dt;
    this.yaw -= turn;
    this.pitch = THREE.MathUtils.clamp(this.pitch + tilt, CAMERA.minPitch, CAMERA.maxPitch);
    const zoomKeys = input.axisOf('zoomOut', 'zoomIn');
    this.distance = THREE.MathUtils.clamp(this.distance * (1 + input.wheel * 0.001) * (1 - zoomKeys * 1.2 * dt), 4, 40);

    // C: swing round behind the player (any other turning cancels it).
    if (input.hit('camBehind')) this.recenter = true;
    if (turn !== 0) this.recenter = false;
    if (this.recenter) {
      const behind = wrapAngle(this.target.model.root.rotation.y + Math.PI - this.yaw);
      this.yaw += behind * (1 - Math.exp(-8 * dt));
      if (Math.abs(behind) < 0.01) this.recenter = false;
    }

    const t = this.target.object3d.position;
    let fx = t.x;
    let fz = t.z;
    let wantedZoom = this.distance;
    let wantedTilt = this.pitch;
    const mode = MODES[game.cameraMode];
    if (mode) {
      wantedZoom = Math.min(wantedZoom, mode.maxDistance);
      wantedTilt = Math.max(wantedTilt, mode.minPitch);
    }
    // Swimming: look down through the water from a little closer in.
    if (this.target.swimming) wantedZoom = Math.min(wantedZoom, UNDERWATER_DISTANCE);

    const speaker = game.dialog?.isOpen ? game.dialog.focus : null;
    if (speaker) {
      const s = speaker.object3d.position;
      fx = (t.x + s.x) / 2;
      fz = (t.z + s.z) / 2;
      wantedZoom = Math.min(this.distance, CONVERSATION_DISTANCE);
      // Look from the side of the line between them, whichever side we're already nearest.
      const line = Math.atan2(s.x - t.x, s.z - t.z);
      const offA = wrapAngle(line + Math.PI / 2 - this.yaw);
      const offB = wrapAngle(line - Math.PI / 2 - this.yaw);
      this.yaw += (Math.abs(offA) < Math.abs(offB) ? offA : offB) * (1 - Math.exp(-3 * dt));
    }
    // The customization screen: swing round to Bobert's front, close up and low, with him on the
    // left of the screen (the menu is on the right).
    let focusHeight = 1.4;
    if (game.customizer?.isOpen) {
      this.yaw += wrapAngle(this.target.model.root.rotation.y - this.yaw) * (dt === 0 ? 1 : 1 - Math.exp(-4 * dt));
      wantedZoom = 4.4;
      wantedTilt = 0.2;
      focusHeight = 1.0;
      fx = t.x + Math.cos(this.yaw) * 0.9; // a little to the camera's right
      fz = t.z - Math.sin(this.yaw) * 0.9;
    }

    const k = dt === 0 ? 1 : 1 - Math.exp(-10 * dt);
    this.focus.x += (fx - this.focus.x) * k;
    this.focus.y += (t.y + focusHeight - this.focus.y) * k;
    this.focus.z += (fz - this.focus.z) * k;
    const ease = dt === 0 ? 1 : 1 - Math.exp(-4 * dt);
    this.zoom += (wantedZoom - this.zoom) * ease;
    this.tilt += (wantedTilt - this.tilt) * ease;

    _dir.set(
      Math.sin(this.yaw) * Math.cos(this.tilt),
      Math.sin(this.tilt),
      Math.cos(this.yaw) * Math.cos(this.tilt),
    );

    // Pull the camera in if something (like a tree) is between it and the player.
    let distance = this.zoom;
    const blockers = game.cameraBlockers.filter((m) => !m.userData.ignoreCamera);
    if (blockers.length) {
      this.raycaster.set(this.focus, _dir);
      this.raycaster.far = distance;
      const hit = this.raycaster.intersectObjects(blockers, false)[0];
      if (hit) distance = Math.max(1.5, hit.distance - 0.4);
    }

    camera.position.copy(this.focus).addScaledVector(_dir, distance);
    camera.lookAt(this.focus);
    if (this.shakeAmount > 0.001) {
      const s = this.shakeAmount;
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      this.shakeAmount *= Math.exp(-14 * dt);
    }
  }
}

function wrapAngle(a) {
  return Math.atan2(Math.sin(a), Math.cos(a));
}
