// Desktop/mobile post-processing: ambient occlusion, bloom, filmic output and SMAA.
// WebXR sessions bypass this pipeline (headsets render directly for comfort and frame rate).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Subtle cinematic grade: vignette, gentle contrast curve and film grain (applied after tone mapping).
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, vignette: { value: 0.28 }, grain: { value: 0.025 }, warmth: { value: 0.0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float vignette; uniform float grain; uniform float warmth; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + time) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = mix(col, col * col * (3.0 - 2.0 * col), 0.18);            // soft S-curve
      col += vec3(warmth, warmth * 0.4, -warmth * 0.6) * 0.06;         // grade
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - smoothstep(0.42, 0.95, d) * vignette;               // vignette
      col += (h(vUv * 1024.0) - 0.5) * grain;                          // grain
      gl_FragColor = vec4(col, c.a);
    }`,
};

export class Post {
  constructor(lab) {
    this.lab = lab;
    const r = lab.renderer;
    const size = r.getSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(lab.scene, lab.camera);
    this.gtao = new GTAOPass(lab.scene, lab.camera, size.x, size.y);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.6, thickness: 1.2, scale: 1, samples: 16, distanceFallOff: 1 });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.22, 0.55, 0.9);
    this.output = new OutputPass();
    this.grade = new ShaderPass(GradeShader);
    this.smaa = new SMAAPass(size.x, size.y);
    [this.renderPass, this.gtao, this.bloom, this.output, this.grade, this.smaa].forEach(p => this.composer.addPass(p));
    this.enabled = true;
    this.flags = { ao: true, bloom: true, smaa: true };
  }

  configure({ enabled, ao, bloom, smaa, msaa, aoSamples, aoRadius, bloomStrength, warmth, vignette }) {
    if (msaa !== undefined) this.setSamples(msaa);
    if (aoSamples !== undefined && aoSamples !== this.aoSamples) { this.aoSamples = aoSamples; this.gtao.updateGtaoMaterial({ samples: aoSamples }); this.gtao.updatePdMaterial({ samples: Math.max(8, aoSamples) }); }
    if (enabled !== undefined) this.enabled = enabled;
    if (ao !== undefined) this.gtao.enabled = ao;
    if (bloom !== undefined) this.bloom.enabled = bloom;
    if (smaa !== undefined) this.smaa.enabled = smaa;
    if (aoRadius !== undefined) this.gtao.updateGtaoMaterial({ radius: aoRadius });
    if (bloomStrength !== undefined) this.bloom.strength = bloomStrength;
    if (warmth !== undefined) this.grade.uniforms.warmth.value = warmth;
    if (vignette !== undefined) this.grade.uniforms.vignette.value = vignette;
  }

  /** Multisampled (MSAA) post buffers for clean geometry edges on Ultra. */
  setSamples(n) {
    for (const rt of [this.composer.renderTarget1, this.composer.renderTarget2]) if (rt.samples !== n) { rt.samples = n; rt.dispose(); }
  }

  setSize(w, h) {
    const pr = this.lab.renderer.getPixelRatio();
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
  }

  render(dt) {
    this.grade.uniforms.time.value = (this.grade.uniforms.time.value + dt) % 100;
    this.renderPass.camera = this.lab.camera;
    this.gtao.camera = this.lab.camera;
    this.composer.render(dt);
  }
}
