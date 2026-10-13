import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { gradientMap } from '../style/garden.js';

/**
 * A calm, dreamy sea that gently bobs: bright turquoise shallows fading to cobalt and violet out
 * in the deep, with soft bands of light drifting across the surface.
 */
const MAX_ISLANDS = 16;

export class Water extends Entity {
  constructor() {
    super();
    const material = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap, transparent: true, opacity: 0.93 });
    const uniforms = {
      uTime: { value: 0 },
      uShallow: { value: new THREE.Color('#22d6d0') },
      uMid: { value: new THREE.Color('#1a8fe0') },
      uDeep: { value: new THREE.Color('#4a3cc8') },
      uLines: { value: new THREE.Color('#d8fff8') },
      // Every island (x, z, radius), so the water is bright and shallow around each one.
      uIslands: { value: Array.from({ length: MAX_ISLANDS }, () => new THREE.Vector3(0, 0, -1)) },
    };
    this.uniforms = uniforms;
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSeaPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSeaPos = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform vec3 uShallow, uMid, uDeep, uLines;
          uniform vec3 uIslands[${MAX_ISLANDS}];
          varying vec3 vSeaPos;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 p = vSeaPos.xz;
          // How far out from the nearest island's shore (in units).
          float d = 1e4;
          for (int i = 0; i < ${MAX_ISLANDS}; i++) {
            if (uIslands[i].z > 0.0) d = min(d, length(p - uIslands[i].xy) - uIslands[i].z);
          }
          vec3 sea = mix(uShallow, uMid, smoothstep(0.0, 45.0, d));
          sea = mix(sea, uDeep, smoothstep(60.0, 300.0, d));
          // Thin wavy ripple lines: contour lines of two wobbly wave patterns added together.
          float w1 = sin(p.x * 0.21 + uTime * 0.7 + sin(p.y * 0.17 + uTime * 0.35) * 2.2);
          float w2 = sin(p.y * 0.19 - uTime * 0.55 + sin(p.x * 0.13 - uTime * 0.25) * 2.4);
          float f = w1 + w2;
          float lines = 1.0 - smoothstep(0.03, 0.09, abs(f - 1.1));
          lines += (1.0 - smoothstep(0.02, 0.06, abs(f + 0.9))) * 0.5;
          float fade = 1.0 - smoothstep(40.0, 220.0, length(vSeaPos - cameraPosition));
          sea = mix(sea, uLines, clamp(lines, 0.0, 1.0) * 0.55 * fade);
          diffuseColor.rgb = sea;`,
        );
    };
    material.customProgramCacheKey = () => 'garden-water';
    this.mesh = new THREE.Mesh(new THREE.CircleGeometry(1200, 64), material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.receiveShadow = true;
    this.object3d.add(this.mesh);
  }

  update(_dt, game) {
    if (game.lands.length !== this.islandCount) {
      // Islands register themselves as they're added; pick up any new ones.
      this.islandCount = game.lands.length;
      const islands = [game.terrain, ...game.lands].filter((l) => l?.radius).slice(0, MAX_ISLANDS);
      islands.forEach((l, i) => this.uniforms.uIslands.value[i].set(l.center?.x ?? 0, l.center?.z ?? 0, l.radius));
    }
    this.mesh.position.y = -0.4 + Math.sin(game.elapsed * 0.8) * 0.06;
    this.uniforms.uTime.value = game.elapsed;
  }
}
