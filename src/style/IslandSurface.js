import * as THREE from 'three';
import { gardenTexture, gradientMap, TEXTURE_SIZE } from './garden.js';
import { SEA } from '../config.js';

/**
 * One smooth mesh for an island's ground: flat grass in the middle, a sandy beach that slopes
 * gently into the sea, and a skirt down to the seabed. A painted "path map" lets villages and
 * roads draw smooth cobblestone paths onto the grass (no tiles, no extra meshes).
 *
 *   const surface = new IslandSurface({ center, edge: (angle) => radius, grassColor });
 *   surface.paintPath(x, z, radius);   // then surface.commitPaths()
 *
 * `edge(angle)` is the distance from the center to the waterline in that direction.
 */
const NO_PATHS = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
NO_PATHS.needsUpdate = true;

export class IslandSurface {
  constructor({ center = { x: 0, z: 0 }, edge, maxRadius, beach = 4, segments = 220, rings = 70, swirl = 1, grassTint = '#ffffff', paths = true }) {
    this.center = center;
    this.edge = edge;
    this.beach = beach;
    // The path map covers a square around the island (islands without paths share a blank one).
    this.half = maxRadius + 2;
    if (paths) {
      const size = 1024;
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.canvas.height = size;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.fillStyle = '#000';
      this.ctx.fillRect(0, 0, size, size);
      this.pathMap = new THREE.CanvasTexture(this.canvas);
      this.pathMap.colorSpace = THREE.NoColorSpace;
    } else {
      this.pathMap = NO_PATHS;
    }
    this.mesh = new THREE.Mesh(this.buildGeometry(segments, rings), this.buildMaterial(swirl, grassTint));
    this.mesh.receiveShadow = true;
  }

  /** Height of the ground at distance d from the center, when the waterline is at `e`. */
  profile(d, e) {
    const flatTo = e - 2.5;
    if (d <= flatTo) return 0;
    const t = Math.min(1, (d - flatTo) / 2.5);
    return -1.1 * t * t; // gentle beach slope into the water
  }

  buildGeometry(segments, rings) {
    const { x: cx, z: cz } = this.center;
    const positions = [];
    const sand = [];
    const index = [];
    // Rings of vertices from the middle out to the waterline, then a gentle underwater slope
    // down to the seabed.
    const under = [[4, -4.5], [13, SEA.floor]]; // [distance past the waterline, height]
    for (let r = 0; r <= rings + under.length; r++) {
      for (let s = 0; s < segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        const e = this.edge(a);
        let d;
        let y;
        if (r <= rings) {
          // Spread the rings out, but bunch them up near the beach where the shape changes.
          const u = r / rings;
          d = e * (u < 0.85 ? u / 0.85 * (1 - 6 / e) : (1 - 6 / e) + ((u - 0.85) / 0.15) * (6 / e));
          y = this.profile(d, e);
        } else {
          [d, y] = under[r - rings - 1];
          d += e;
        }
        positions.push(cx + Math.cos(a) * d, y, cz + Math.sin(a) * d);
        sand.push(THREE.MathUtils.smoothstep(d, e - this.beach - 0.8, e - this.beach + 0.8));
      }
    }
    for (let r = 0; r < rings + under.length; r++) {
      for (let s = 0; s < segments; s++) {
        const a = r * segments + s;
        const b = r * segments + ((s + 1) % segments);
        const c = (r + 1) * segments + s;
        const d = (r + 1) * segments + ((s + 1) % segments);
        index.push(a, b, c, b, d, c); // counter-clockwise seen from above, so the top faces up
      }
    }
    // Close the middle with a fan.
    const middle = positions.length / 3;
    positions.push(cx, 0, cz);
    sand.push(0);
    for (let s = 0; s < segments; s++) index.push(middle, (s + 1) % segments, s);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aSand', new THREE.Float32BufferAttribute(sand, 1));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }

  buildMaterial(swirl, grassTint) {
    const material = new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap });
    const uniforms = {
      tGrass: { value: gardenTexture('grass') },
      tSand: { value: gardenTexture('sand') },
      tPath: { value: gardenTexture('path') },
      tPathMap: { value: this.pathMap },
      uGrassScale: { value: 1 / TEXTURE_SIZE.grass },
      uSandScale: { value: 1 / TEXTURE_SIZE.sand },
      uPathScale: { value: 1 / TEXTURE_SIZE.path },
      uMapOrigin: { value: new THREE.Vector2(this.center.x - this.half, this.center.z - this.half) },
      uMapSize: { value: this.half * 2 },
      uSwirl: { value: swirl },
      uGrassTint: { value: new THREE.Color(grassTint) },
      uCenter: { value: new THREE.Vector2(this.center.x, this.center.z) },
    };
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSand;\nvarying float vSand;\nvarying vec3 vGroundPos;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSand = aSand;\nvGroundPos = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform sampler2D tGrass, tSand, tPath, tPathMap;
          uniform float uGrassScale, uSandScale, uPathScale, uMapSize, uSwirl;
          uniform vec2 uMapOrigin, uCenter;
          uniform vec3 uGrassTint;
          varying float vSand;
          varying vec3 vGroundPos;`,
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec2 p = vGroundPos.xz;
          vec3 grass = texture2D(tGrass, p * uGrassScale).rgb * uGrassTint;
          // Psychedelic swirls: slow rainbow ripples spiralling out from the middle of the island.
          vec2 q = p - uCenter;
          float swirl = sin(length(q) * 0.11 - atan(q.y, q.x) * 3.0 + sin(q.x * 0.05) * 2.0);
          grass = mix(grass, grass * vec3(1.15, 0.85, 1.25), smoothstep(0.55, 1.0, swirl) * 0.45 * uSwirl);
          grass = mix(grass, grass * vec3(0.8, 1.2, 1.15), smoothstep(0.55, 1.0, -swirl) * 0.35 * uSwirl);
          vec3 sand = texture2D(tSand, p * uSandScale).rgb;
          // Wet, darker sand at the waterline.
          sand *= mix(1.0, 0.82, smoothstep(-0.4, -1.0, vGroundPos.y));
          vec3 ground = mix(grass, sand, vSand);
          float path = texture2D(tPathMap, (p - uMapOrigin) / uMapSize).r;
          vec3 cobble = texture2D(tPath, p * uPathScale).rgb;
          // Softer pastel cobbles, so the paths don't shout over the characters on them.
          cobble = mix(vec3(dot(cobble, vec3(0.299, 0.587, 0.114))), cobble, 0.5) * vec3(1.04, 0.98, 1.06);
          ground = mix(ground, cobble, smoothstep(0.35, 0.65, path) * (1.0 - vSand));
          diffuseColor.rgb = ground;`,
        );
    };
    material.customProgramCacheKey = () => 'island-surface';
    return material;
  }

  /** Paint a round patch of path at (x, z). Call commitPaths() when done painting. */
  paintPath(x, z, radius = 0.9) {
    if (!this.ctx) throw new Error('This island was made with paths: false');
    const size = this.canvas.width;
    const px = ((x - (this.center.x - this.half)) / (this.half * 2)) * size;
    const py = ((z - (this.center.z - this.half)) / (this.half * 2)) * size;
    const pr = (radius / (this.half * 2)) * size;
    const g = this.ctx.createRadialGradient(px, py, pr * 0.4, px, py, pr);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    this.ctx.fillStyle = g;
    this.ctx.beginPath();
    this.ctx.arc(px, py, pr, 0, Math.PI * 2);
    this.ctx.fill();
  }

  commitPaths() {
    this.pathMap.needsUpdate = true;
  }
}
