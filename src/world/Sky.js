import * as THREE from 'three';
import { Entity } from '../core/Entity.js';
import { SKY, FOG } from '../config.js';

/**
 * Gradient sky dome with color swirls and a round glowing sun with a rainbow ring (it turns into a
 * pale moon at night) and
 * stars that come out after dark. Also sets up scene fog. Lives at game.sky; DayNight changes
 * its colors through `uniforms` and `stars`.
 */
export class Sky extends Entity {
  constructor() {
    super();
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(SKY.top) },
        middleColor: { value: new THREE.Color(SKY.middle) },
        horizonColor: { value: new THREE.Color(SKY.horizon) },
        sunColor: { value: new THREE.Color(SKY.sun) },
        sunDirection: { value: SKY.sunDirection.clone() },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor;
        uniform vec3 middleColor;
        uniform vec3 horizonColor;
        uniform vec3 sunColor;
        uniform vec3 sunDirection;
        varying vec3 vDir;

        void main() {
          vec3 dir = normalize(vDir);
          float h = dir.y;

          vec3 col = mix(horizonColor, middleColor, smoothstep(0.0, 0.18, h));
          col = mix(col, topColor, smoothstep(0.15, 0.8, h));
          // Below the horizon just keep the horizon color (hidden by water anyway).
          col = mix(horizonColor, col, step(0.0, h));

          // Dreamy swirls of color drifting across the upper sky.
          float swirl = sin(atan(dir.z, dir.x) * 5.0 + h * 9.0) * 0.5 + 0.5;
          col = mix(col, col * vec3(1.12, 0.9, 1.15), swirl * smoothstep(0.1, 0.6, h) * 0.35);

          // Round sun with a soft glow and a faint rainbow ring around it.
          vec3 sd = normalize(sunDirection);
          float facing = dot(dir, sd);
          float angle = acos(clamp(facing, -1.0, 1.0));
          float sun = 1.0 - smoothstep(0.045, 0.052, angle);
          float glow = pow(max(facing, 0.0), 10.0) * 0.45 + pow(max(facing, 0.0), 120.0) * 0.6;
          float ring = smoothstep(0.03, 0.0, abs(angle - 0.22));
          vec3 rainbow = 0.5 + 0.5 * cos(6.2831 * ((angle - 0.22) * 18.0 + vec3(0.0, 0.33, 0.67)));
          col += rainbow * ring * 0.18 * step(0.0, facing);
          col += sunColor * glow;
          col = mix(col, sunColor * 1.15, sun);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });

    this.uniforms = material.uniforms;
    this.object3d.add(new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), material));
    this.buildStars();
  }

  buildStars() {
    const positions = [];
    for (let i = 0; i < 700; i++) {
      // Random points on the upper half of a big sphere.
      const y = 0.08 + Math.random() * 0.92;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      positions.push(Math.cos(a) * r * 1700, y * 1700, Math.sin(a) * r * 1700);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }),
    );
    this.object3d.add(this.stars);
  }

  onAdd(game) {
    game.scene.fog = new THREE.Fog(SKY.horizon, FOG.near, FOG.far);
    game.sky = this;
  }
}
