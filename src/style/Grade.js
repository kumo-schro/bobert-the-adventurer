import * as THREE from 'three';

/**
 * The finishing touch: the scene is drawn into an offscreen image (with antialiasing), then one
 * cheap full-screen pass grades it: a little extra saturation and contrast, violet-tinted shadows,
 * warm peachy highlights, and a soft vignette. Then it goes to the screen.
 */
export class Grade {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.uniforms = {
      tScene: { value: this.target.texture },
      uSaturation: { value: 1.12 },
      uContrast: { value: 1.06 },
      uShadowTint: { value: new THREE.Color('#6a3cc8') },
      uHighlightTint: { value: new THREE.Color('#ffd6b0') },
      uSplit: { value: 0.1 },
      uVignette: { value: 0.28 },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tScene;
        uniform float uSaturation, uContrast, uSplit, uVignette;
        uniform vec3 uShadowTint, uHighlightTint;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tScene, vUv).rgb;
          c = pow(max(c, 0.0), vec3(1.0 / 2.2)); // grade in a perceptual space
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, uSaturation);
          c = (c - 0.5) * uContrast + 0.5;
          // Split toning: shadows lean violet, highlights lean peach.
          c = mix(c, c * uShadowTint * 1.6, (1.0 - smoothstep(0.0, 0.45, l)) * uSplit);
          c = mix(c, c * uHighlightTint * 1.1, smoothstep(0.55, 1.0, l) * uSplit);
          vec2 d = vUv - 0.5;
          c *= 1.0 - uVignette * smoothstep(0.25, 0.85, dot(d, d) * 2.2);
          c = pow(max(c, 0.0), vec3(2.2));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    // One triangle that covers the whole screen.
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    this.quad = new THREE.Mesh(geometry, this.material);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCamera = new THREE.Camera();
    this.size = new THREE.Vector2();
  }

  render(scene, camera) {
    const { renderer } = this;
    renderer.getDrawingBufferSize(this.size);
    if (this.target.width !== this.size.x || this.target.height !== this.size.y) this.target.setSize(this.size.x, this.size.y);
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }
}
