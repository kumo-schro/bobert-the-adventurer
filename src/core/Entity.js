import * as THREE from 'three';

/**
 * Base class for everything in the game world.
 *
 * Subclasses put their visuals inside `this.object3d` and can override:
 *   onAdd(game)       - called once when added via game.add()
 *   update(dt, game)  - called every frame (dt is seconds since last frame)
 *   onRemove(game)    - called when removed via game.remove()
 */
export class Entity {
  constructor() {
    this.object3d = new THREE.Group();
  }

  onAdd(_game) {}

  update(_dt, _game) {}

  onRemove(_game) {}
}
