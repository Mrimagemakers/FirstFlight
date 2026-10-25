// Ultra: glossy planar reflections for polished floors (hangar epoxy).
// A hidden three.js Reflector renders the mirrored scene; the floor's own PBR material blends it in
// with a Fresnel term and a small blur, so roughness, markings and lighting stay intact.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

export function addPlanarReflection(lab, floor, { width, depth, strength = 0.32, blur = 2.5, resolution = 1024 } = {}) {
  const reflector = new Reflector(new THREE.PlaneGeometry(width, depth), { textureWidth: resolution, textureHeight: Math.round(resolution * depth / width), clipBias: 0.003 });
  reflector.rotation.x = -Math.PI / 2;
  reflector.position.copy(floor.position).y += 0.0005;
  // never visible itself: it only renders the mirror texture when drawn
  reflector.material.colorWrite = false;
  reflector.material.depthWrite = false;
  reflector.renderOrder = -10;
  floor.parent.add(reflector);

  const mat = floor.material.clone();
  const uniforms = {
    tReflect: { value: reflector.getRenderTarget().texture },
    reflMatrix: { value: reflector.material.uniforms.textureMatrix.value },
    reflInv: { value: new THREE.Matrix4() },
    reflStrength: { value: strength },
    reflBlur: { value: blur / resolution },
  };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 reflMatrix; uniform mat4 reflInv; varying vec4 vReflUv;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvReflUv = reflMatrix * reflInv * modelMatrix * vec4(transformed, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tReflect; uniform float reflStrength; uniform float reflBlur; varying vec4 vReflUv;')
      .replace('#include <opaque_fragment>', `
  {
    vec2 ruv = vReflUv.xy / vReflUv.w + normal.xz * 0.012;
    vec3 rc = texture2D(tReflect, ruv).rgb * 0.36;
    rc += texture2D(tReflect, ruv + vec2(reflBlur, 0.0)).rgb * 0.16;
    rc += texture2D(tReflect, ruv - vec2(reflBlur, 0.0)).rgb * 0.16;
    rc += texture2D(tReflect, ruv + vec2(0.0, reflBlur * 1.6)).rgb * 0.16;
    rc += texture2D(tReflect, ruv - vec2(0.0, reflBlur * 1.6)).rgb * 0.16;
    float ndv = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
    float fres = 0.35 + 0.65 * pow(1.0 - ndv, 3.0);
    float gloss = 1.0 - clamp(roughnessFactor, 0.0, 1.0) * 0.6;
    outgoingLight += rc * reflStrength * fres * gloss;
  }
#include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'planar-reflection';
  floor.material = mat;

  const api = {
    reflector,
    enabled: true,
    /** call each frame: keeps matrices fresh, and switches off inside VR headsets */
    update() {
      const on = api.enabled && !lab.renderer.xr.isPresenting;
      reflector.visible = on;
      uniforms.reflStrength.value = on ? strength : 0;
      reflector.updateMatrixWorld();
      uniforms.reflInv.value.copy(reflector.matrixWorld).invert();
    },
    setEnabled(v) { api.enabled = v; },
  };
  return api;
}
