// Photoreal assets generated with Higgsfield (image → textured PBR mesh), optimised with glTF-Transform
// (meshopt geometry, 2K textures). Each file is loaded from assets/hf/ when bundled with the app and
// otherwise from the Higgsfield CDN. If neither loads, callers keep their procedural stand-in.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { contactShadow } from '../util.js';

const LOCAL = new URL('../../assets/hf/', import.meta.url).href;
const CDN = 'https://d2ol7oe51mr4n9.cloudfront.net/user_2xqdkXQxcL6UFHjJwLK5drKd1tT/';

/**
 * fit: which real-world dimension to scale to ('height' | 'length' | 'max') and its size in metres.
 * yaw: rotation that turns the generated mesh to face +Z (the app's "forward" for people and parts).
 * The generated people face +X, so they turn a quarter to the right.
 */
const FACE_Z = -Math.PI / 2;
export const HF = {
  trainer:     { file: 'b198a9a5-63fb-43eb-9ff9-554c607112ec.glb', fit: ['length', 8.3], yaw: 0 },
  piston:      { file: '67a04ed2-2851-47fd-b3d8-3ba29a39b7fb.glb', fit: ['max', 0.86], yaw: 0 },
  turbofan:    { file: '88ae4ac0-c296-4fb5-8984-d73a0d458956.glb', fit: ['max', 3.6], yaw: 0 },
  jetgear:     { file: '0c64a437-5926-4f97-ba79-d3c009142d6a.glb', fit: ['height', 2.4], yaw: 0 },
  rampYellow:  { file: '0ef86e67-fcdd-4b07-b909-f134b3baa9f7.glb', fit: ['height', 1.8], yaw: FACE_Z, person: true },
  rampOrange:  { file: 'c113daa7-1beb-4083-9fec-9aeb10eaf234.glb', fit: ['height', 1.68], yaw: FACE_Z, person: true },
  technician:  { file: '7efa3391-084e-46f2-9b3a-95474d0bd415.glb', fit: ['height', 1.78], yaw: FACE_Z, person: true },
  attendant:   { file: 'fa19e26e-d838-4cda-bf29-6d21c05c3a13.glb', fit: ['height', 1.7], yaw: FACE_Z, person: true },
};

let loader = null;
const scenes = new Map();

function fetchScene(name) {
  if (!scenes.has(name)) {
    const a = HF[name];
    scenes.set(name, new Promise((resolve, reject) => {
      loader ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      loader.setCrossOrigin('anonymous');
      const urls = [LOCAL + name + '.glb', CDN + a.file];
      const next = (i) => loader.load(urls[i], g => resolve(normalise(g.scene, a)), undefined, err => (i + 1 < urls.length ? next(i + 1) : reject(err)));
      next(0);
    }));
  }
  return scenes.get(name);
}

/** Scale to real size, stand on y=0, centre on x/z, face +Z. Wraps the mesh so callers can transform freely. */
function normalise(scene, a) {
  scene.rotation.y = a.yaw || 0;
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const [dim, metres] = a.fit;
  const ref = dim === 'height' ? size.y : dim === 'length' ? size.z : Math.max(size.x, size.y, size.z);
  const s = metres / ref;
  scene.scale.setScalar(s);
  box.setFromObject(scene);
  const c = box.getCenter(new THREE.Vector3());
  scene.position.set(-c.x, -box.min.y, -c.z);
  scene.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const m = o.material;
    if (!m) return;
    if (m.map) m.map.anisotropy = 8;
    if (a.person) {
      // generated maps read glossy and slightly flat for skin and cloth: soften the sheen, deepen the creases
      m.envMapIntensity = 0.7;
      m.roughness = Math.max(m.roughness ?? 1, 0.82);
      m.metalness = Math.min(m.metalness ?? 0, 0.05);
      if (m.normalMap) m.normalScale.set(1.25, 1.25);
      if ('sheen' in m) { m.sheen = 0.35; m.sheenRoughness = 0.8; m.sheenColor = new THREE.Color(0x3a3f4a); }
    } else {
      m.envMapIntensity = 1;
    }
  });
  const wrap = new THREE.Group();
  wrap.add(scene);
  wrap.userData.size = size.multiplyScalar(s);
  wrap.userData.person = !!a.person;
  return wrap;
}

/** Resolves with a fresh instance (shared geometry and materials) of the named asset. */
export async function loadHF(name) {
  const base = await fetchScene(name);
  const inst = base.clone(true);
  inst.userData.size = base.userData.size.clone();
  inst.userData.person = base.userData.person;
  return inst;
}

/** Warm the cache without waiting. */
export function preloadHF(...names) { names.forEach(n => fetchScene(n).catch(() => {})); }

// ------------------------------------------------------------------ living people
// The generated people are single static meshes. To make them read as alive without a skeleton, the vertex
// shader twists the head and neck around a pivot found from the mesh itself (smoothly blended into the
// shoulders), so a person can turn to look at you, glance around and nod. Breathing and weight shift move
// the whole figure from the feet.

/** Head pivot and blend bands in the mesh's own (geometry) space, measured once per geometry. */
function headRig(geo) {
  if (geo.userData.headRig) return geo.userData.headRig;
  geo.computeBoundingBox();
  const bb = geo.boundingBox, H = bb.max.y - bb.min.y, y0 = bb.min.y;
  const pos = geo.attributes.position;
  let sx = 0, sz = 0, n = 0;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > y0 + 0.88 * H && y < y0 + 0.95 * H) { sx += pos.getX(i); sz += pos.getZ(i); n++; }
  }
  const px = n ? sx / n : (bb.min.x + bb.max.x) / 2, pz = n ? sz / n : (bb.min.z + bb.max.z) / 2;
  const rig = {
    pivot: new THREE.Vector3(px, y0 + 0.835 * H, pz),
    band: new THREE.Vector2(y0 + 0.80 * H, y0 + 0.875 * H),  // shoulders → jaw: twist fades in
    rad: new THREE.Vector2(0.07 * H, 0.11 * H),              // keep the shoulders and arms still
  };
  geo.userData.headRig = rig;
  return rig;
}

function makeLiving(mesh) {
  const rig = headRig(mesh.geometry);
  const mat = mesh.material.clone();           // per-person uniforms
  const u = { uYaw: { value: 0 }, uPitch: { value: 0 }, uPivot: { value: rig.pivot }, uBand: { value: rig.band }, uRad: { value: rig.rad } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uYaw; uniform float uPitch; uniform vec3 uPivot; uniform vec2 uBand; uniform vec2 uRad;
mat3 hfHead(vec3 p) {
  float w = smoothstep(uBand.x, uBand.y, p.y) * (1.0 - smoothstep(uRad.x, uRad.y, length(p.xz - uPivot.xz)));
  float a = uYaw * w, b = uPitch * w;
  mat3 rz = mat3(cos(b), sin(b), 0.0, -sin(b), cos(b), 0.0, 0.0, 0.0, 1.0);
  mat3 ry = mat3(cos(a), 0.0, -sin(a), 0.0, 1.0, 0.0, sin(a), 0.0, cos(a));
  return ry * rz;
}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
mat3 hfR = hfHead(position);
objectNormal = hfR * objectNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
transformed = uPivot + hfR * (transformed - uPivot);`);
  };
  mat.customProgramCacheKey = () => 'hf-living';
  mesh.material = mat;
  return u;
}

const _cam = new THREE.Vector3(), _loc = new THREE.Vector3();

/**
 * Life for a person: breathing, slow weight shift, and a head that follows a nearby viewer (within ~6 m and
 * in front), otherwise glances around now and then. Runs from onBeforeRender, so it costs nothing off screen.
 */
export function addIdle(person, seed = 1, { look = true } = {}) {
  const phase = seed * 1.7, rate = 0.9 + (seed % 5) * 0.06;
  const base = { sy: person.scale.y, sx: person.scale.x, rz: person.rotation.z, rx: person.rotation.x };
  let mesh = null; person.traverse(o => { if (!mesh && o.isMesh) mesh = o; });
  if (!mesh) return;
  const u = look ? makeLiving(mesh) : null;
  let yaw = 0, pitch = 0, last = performance.now();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); last = now;
    const t = now / 1000 * rate + phase;
    const breathe = Math.sin(t * 1.6) * 0.5 + 0.5;
    person.scale.y = base.sy * (1 + breathe * 0.006);
    person.scale.x = person.scale.z = base.sx * (1 + breathe * 0.004);
    person.rotation.z = base.rz + Math.sin(t * 0.37) * 0.012;   // weight shift
    person.rotation.x = base.rx + Math.sin(t * 0.23 + 1.3) * 0.006;
    if (!u) return;
    // where is the viewer, in the mesh's own space? (people face +X there)
    _cam.setFromMatrixPosition(camera.matrixWorld);
    _loc.copy(_cam); mesh.worldToLocal(_loc).sub(u.uPivot.value);
    const s = mesh.matrixWorld.getMaxScaleOnAxis();
    const dist = _loc.length() * s;
    let ty = 0, tp = 0;
    const ahead = Math.atan2(-_loc.z, _loc.x);
    if (dist < 6 && Math.abs(ahead) < 1.9) {
      ty = THREE.MathUtils.clamp(ahead, -0.75, 0.75);
      tp = THREE.MathUtils.clamp(Math.atan2(_loc.y, Math.hypot(_loc.x, _loc.z)) * 0.6, -0.28, 0.22);
    } else {
      // idle glances: hold, look aside, come back
      const g = Math.sin(t * 0.21) + Math.sin(t * 0.13 + 2.1) * 0.6;
      ty = Math.abs(g) > 1.05 ? Math.sign(g) * 0.45 : 0;
      tp = -0.05 + Math.sin(t * 0.17) * 0.04;
    }
    const k = 1 - Math.exp(-dt * 3.2);   // smooth, human-speed head turn
    yaw += (ty - yaw) * k; pitch += (tp - pitch) * k;
    u.uYaw.value = yaw; u.uPitch.value = pitch;
  };
}

/**
 * A person that appears immediately as a procedural stand-in (optional) and is swapped for the
 * photoreal model once it has loaded.
 */
export function hfPerson(name, { standIn = null, seed = 1, idle = true, look = true } = {}) {
  const g = new THREE.Group(); g.name = 'person-' + name;
  if (standIn) g.add(standIn);
  loadHF(name).then(p => {
    if (standIn) standIn.visible = false;
    g.add(p);
    contactShadow(g, 0.75, 0.6, [0, 0, 0], 0.55);
    if (idle) addIdle(p, seed, { look });
    g.userData.real = p;
  }).catch(() => { /* offline and not bundled: keep the stand-in */ });
  return g;
}
