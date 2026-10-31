// Ground support equipment, apron furniture, people and FOD items for the ramp station.
import * as THREE from 'three';
import { mesh, box, cyl, rod, tube, sphere, roundedBox, canvasTexture, contactShadow, rand, lathe } from '../util.js';
import { materials } from '../materials.js';
import { quality } from '../settings.js';
import { loadHF, addIdle } from './hf.js';

const gseYellow = () => new THREE.MeshPhysicalMaterial({ color: 0xe3b11b, roughness: 0.48, metalness: 0.15, clearcoat: 0.5 });
const gseWhite = () => new THREE.MeshPhysicalMaterial({ color: 0xe7e9e8, roughness: 0.45, metalness: 0.1, clearcoat: 0.4 });

function wheel(parent, x, y, z, r, w, M, axis = 'x') {
  const t = mesh(new THREE.CylinderGeometry(r, r, w, 24), M.rubber, parent);
  if (axis === 'x') t.rotation.z = Math.PI / 2; else t.rotation.x = Math.PI / 2;
  t.position.set(x, y, z);
  const h = mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, w * 1.04, 20), M.steel, parent);
  h.rotation.copy(t.rotation); h.position.copy(t.position);
  return t;
}

/** Amber rotating beacon used on GSE. */
function beacon(parent, pos) {
  const m = sphere(parent, [0.07, 0.07, 0.07], pos, new THREE.MeshStandardMaterial({ color: 0xffa21a, emissive: 0xff8800, emissiveIntensity: 1.2, roughness: 0.2 }), 12);
  m.castShadow = false;
  return m;
}

export function baggageTug(lab) {
  const M = materials(lab);
  const g = new THREE.Group(); g.name = 'tug';
  const paint = gseYellow();
  mesh(roundedBox(1.35, 0.55, 2.6, 0.08), paint, g).position.set(0, 0.62, 0);
  mesh(roundedBox(1.25, 0.3, 0.8, 0.06), M.plastic, g).position.set(0, 0.98, -0.75); // engine cover
  box(g, [1.2, 0.08, 1.1], [0, 0.92, 0.45], M.darkMetal);
  // seat + wheel
  box(g, [0.55, 0.12, 0.5], [0, 1.05, 0.55], M.leather);
  box(g, [0.55, 0.5, 0.1], [0, 1.3, 0.8], M.leather);
  rod(g, [0, 0.95, 0.0], [0, 1.35, 0.25], 0.025, M.steel);
  mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 24), M.plastic, g).position.set(0, 1.37, 0.27);
  // canopy frame
  for (const x of [-0.6, 0.6]) for (const z of [-0.05, 1.05]) rod(g, [x, 0.95, z], [x, 2.05, z], 0.03, M.darkMetal);
  box(g, [1.3, 0.06, 1.25], [0, 2.07, 0.5], M.plastic);
  for (const [x, z] of [[-0.62, -0.85], [0.62, -0.85], [-0.62, 0.85], [0.62, 0.85]]) wheel(g, x, 0.3, z, 0.3, 0.22, M);
  beacon(g, [0, 2.15, 0.5]);
  box(g, [0.2, 0.15, 0.2], [0, 0.45, 1.36], M.steel); // hitch
  contactShadow(g, 2.2, 3.4, [0, 0, 0], 0.55);
  return g;
}

export function baggageCart(lab, seed = 1, { leaking = false } = {}) {
  const M = materials(lab);
  const r = rand(seed);
  const g = new THREE.Group(); g.name = 'cart';
  box(g, [1.4, 0.08, 2.6], [0, 0.55, 0], M.steel);
  for (const x of [-0.68, 0.68]) for (const z of [-1.28, 1.28]) rod(g, [x, 0.55, z], [x, 1.85, z], 0.025, M.steel);
  box(g, [1.45, 0.06, 2.65], [0, 1.88, 0], gseWhite());
  for (const z of [-1.3, 1.3]) box(g, [1.4, 0.35, 0.03], [0, 0.78, z], M.steel);
  // curtain side (rolled) and coloured bags
  cyl(g, 0.07, 0.07, 2.6, [0.68, 1.78, 0], new THREE.MeshStandardMaterial({ color: 0x2b4e6e, roughness: 0.9 }), [Math.PI / 2, 0, 0], 12);
  const colors = [0x1c2a36, 0x6a1f24, 0x2f4f3a, 0x40464c, 0x8a6a3a, 0x232323, 0x3f5a7a, 0x7b2d4b];
  const bags = [];
  let z = -1.1;
  while (z < 1.1) {
    const h = 0.45 + r() * 0.25, d = 0.22 + r() * 0.12, w = 0.4 + r() * 0.25;
    for (let row = 0; row < 2; row++) {
      const bag = mesh(roundedBox(w, h, d, 0.05, 2), new THREE.MeshStandardMaterial({ color: colors[Math.floor(r() * colors.length)], roughness: 0.55 + r() * 0.3 }), g);
      bag.position.set(-0.35 + row * 0.6 + (r() - 0.5) * 0.1, 0.59 + h / 2, z + d / 2);
      bag.rotation.y = (r() - 0.5) * 0.15;
      box(g, [0.14, 0.03, 0.03], [bag.position.x, bag.position.y + h / 2 + 0.02, bag.position.z], M.plastic);
      bags.push(bag);
    }
    z += d + 0.08;
  }
  for (const [x, zz] of [[-0.6, -1.0], [0.6, -1.0], [-0.6, 1.0], [0.6, 1.0]]) wheel(g, x, 0.22, zz, 0.22, 0.14, M);
  rod(g, [0, 0.4, -1.3], [0, 0.35, -2.0], 0.03, M.steel);
  let leak = null;
  if (leaking) {
    // a damaged carton with a damp stain and a small puddle beneath the cart
    const carton = mesh(roundedBox(0.5, 0.4, 0.4, 0.02, 1), new THREE.MeshStandardMaterial({ color: 0xa47b4c, roughness: 0.85 }), g);
    carton.position.set(0.25, 1.2, 0.9); carton.rotation.z = 0.15;
    const stain = canvasTexture(256, 256, c => { c.fillStyle = '#a47b4c'; c.fillRect(0, 0, 256, 256); c.fillStyle = 'rgba(60,40,20,.75)'; c.beginPath(); c.ellipse(140, 170, 90, 70, 0.4, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#3d2a17'; c.lineWidth = 6; c.beginPath(); c.moveTo(40, 60); c.lineTo(110, 120); c.lineTo(70, 160); c.stroke(); c.fillStyle = '#c33'; c.font = '700 28px system-ui'; c.fillText('THIS SIDE UP ↑', 20, 40); }).texture;
    carton.material.map = stain;
    const puddle = mesh(new THREE.CircleGeometry(0.45, 32).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x2a2014, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.75, clearcoat: 1 }), g, { cast: false });
    puddle.scale.set(1.3, 1, 0.8); puddle.position.set(0.3, 0.012, 1.1);
    leak = carton;
  }
  contactShadow(g, 2, 3.2, [0, 0, 0], 0.5);
  g.userData.leak = leak;
  return g;
}

export function beltLoader(lab, length = 7.2, angle = 0.2) {
  const M = materials(lab);
  const g = new THREE.Group(); g.name = 'belt-loader';
  const paint = gseYellow();
  mesh(roundedBox(1.7, 0.6, 5.6, 0.1), paint, g).position.set(0, 0.65, 0);
  // driver position
  box(g, [0.6, 0.1, 0.6], [0.45, 1.05, -1.4], M.leather);
  box(g, [0.6, 0.55, 0.1], [0.45, 1.35, -1.15], M.leather);
  rod(g, [0.45, 1.0, -1.85], [0.45, 1.45, -1.7], 0.025, M.steel);
  mesh(new THREE.TorusGeometry(0.17, 0.02, 8, 24), M.plastic, g).position.set(0.45, 1.48, -1.68);
  for (const [x, z] of [[-0.75, -2.1], [0.75, -2.1], [-0.75, 2.1], [0.75, 2.1]]) wheel(g, x, 0.36, z, 0.36, 0.26, M);
  // inclined conveyor (rises towards -z)
  const belt = new THREE.Group(); belt.position.set(-0.15, 1.05, 2.6); belt.rotation.x = angle; g.add(belt);
  box(belt, [0.95, 0.08, length], [0, 0.18, -length / 2], new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.95 }));
  const cleats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.03, 0.04), M.rubber, 34);
  const d = new THREE.Object3D();
  for (let i = 0; i < 34; i++) { d.position.set(0, 0.235, -0.2 - i * (length - 0.4) / 34); d.updateMatrix(); cleats.setMatrixAt(i, d.matrix); }
  belt.add(cleats);
  for (const x of [-0.52, 0.52]) {
    box(belt, [0.08, 0.32, length], [x, 0.22, -length / 2], paint);
    for (let k = 0; k < 5; k++) rod(belt, [x, 0.38, -0.5 - k * 1.5], [x, 1.05, -0.5 - k * 1.5], 0.022, M.steel);
    rod(belt, [x, 1.05, -0.3], [x, 1.05, -length + 0.3], 0.025, M.steel);
  }
  // lift struts
  rod(g, [0, 0.9, 0.6], [-0.15, 1.05 + Math.sin(angle) * 3.4, 2.6 - Math.cos(angle) * 3.4], 0.07, M.steel);
  beacon(g, [0.75, 1.0, -2.7]);
  contactShadow(g, 2.4, 6.4, [0, 0, 0], 0.55);
  return g;
}

/** LD3-style contoured unit load device on a dolly. */
export function uldDolly(lab, seed = 3, label = 'AKE 12034 FF') {
  const M = materials(lab);
  const g = new THREE.Group(); g.name = 'uld';
  box(g, [1.75, 0.1, 1.85], [0, 0.5, 0], M.steel);
  for (const [x, z] of [[-0.7, -0.75], [0.7, -0.75], [-0.7, 0.75], [0.7, 0.75]]) wheel(g, x, 0.2, z, 0.2, 0.12, M);
  const s = new THREE.Shape();
  s.moveTo(-0.78, 0); s.lineTo(0.78, 0); s.lineTo(0.78, 1.0); s.lineTo(1.0, 1.62); s.lineTo(-0.78, 1.62); s.closePath();
  const body = mesh(new THREE.ExtrudeGeometry(s, { depth: 1.5, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: 0xb9bec1, metalness: 0.8, roughness: 0.38, normalMap: M.paint.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) }), g);
  body.position.set(-0.1, 0.56, -0.75);
  // net / curtain on the open face and an ID panel
  const tag = canvasTexture(512, 256, c => { c.fillStyle = '#f2f2ee'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#c0281f'; c.fillRect(0, 0, 512, 56); c.fillStyle = '#fff'; c.font = '700 34px system-ui'; c.fillText('UNIT LOAD DEVICE', 18, 40); c.fillStyle = '#111'; c.font = '700 54px ui-monospace,monospace'; c.fillText(label, 18, 130); c.font = '500 28px system-ui'; c.fillText('CHECK TAG · WEIGHT · DG LABELS', 18, 200); }).texture;
  const plate = mesh(new THREE.PlaneGeometry(0.7, 0.35), new THREE.MeshStandardMaterial({ map: tag, roughness: 0.6 }), g, { cast: false });
  plate.position.set(-0.1, 1.25, 0.78);
  const net = canvasTexture(256, 256, c => { c.clearRect(0, 0, 256, 256); c.strokeStyle = '#2b3b2b'; c.lineWidth = 5; for (let i = 0; i < 256; i += 32) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke(); } }, { repeat: [3, 3] }).texture;
  const n = mesh(new THREE.PlaneGeometry(1.5, 1.5), new THREE.MeshStandardMaterial({ map: net, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide }), g, { cast: false });
  n.rotation.y = -Math.PI / 2; n.position.set(-0.89, 1.32, 0);
  for (let i = 0; i < 5; i++) { const b = mesh(roundedBox(0.4, 0.35, 0.5, 0.03, 1), new THREE.MeshStandardMaterial({ color: [0xa47b4c, 0x8c6a42, 0xb08a5a][i % 3], roughness: 0.85 }), g); b.position.set(-0.5 + (i % 2) * 0.45, 0.78 + Math.floor(i / 2) * 0.36, -0.4 + (i % 3) * 0.35); }
  contactShadow(g, 2.4, 2.4, [0, 0, 0], 0.5);
  return g;
}

export function groundPowerUnit(lab) {
  const M = materials(lab);
  const g = new THREE.Group(); g.name = 'gpu';
  mesh(roundedBox(1.3, 1.25, 2.2, 0.08), gseWhite(), g).position.set(0, 0.95, 0);
  for (let i = 0; i < 6; i++) box(g, [0.02, 0.6, 0.05], [0.66, 1.0, -0.6 + i * 0.22], M.darkMetal);
  for (const [x, z] of [[-0.55, -0.8], [0.55, -0.8], [-0.55, 0.8], [0.55, 0.8]]) wheel(g, x, 0.25, z, 0.25, 0.16, M);
  const label = canvasTexture(512, 128, c => { c.fillStyle = '#e7e9e8'; c.fillRect(0, 0, 512, 128); c.fillStyle = '#173a52'; c.font = '700 64px system-ui'; c.fillText('GPU 400Hz', 20, 86); }).texture;
  mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshStandardMaterial({ map: label }), g, { cast: false }).position.set(0, 1.35, 1.11);
  contactShadow(g, 2, 2.8, [0, 0, 0], 0.5);
  return g;
}

export function cone(lab) {
  const M = materials(lab);
  const g = new THREE.Group();
  const body = mesh(lathe([[0.18, 0], [0.18, 0.04], [0.15, 0.06], [0.04, 0.72], [0.0, 0.74]], 24), M.hiVisOrange, g);
  box(g, [0.4, 0.04, 0.4], [0, 0.02, 0], M.hiVisOrange);
  for (const y of [0.32, 0.5]) { const band = mesh(new THREE.CylinderGeometry(0.04 + (0.72 - y) * 0.155 + 0.005, 0.04 + (0.72 - y - 0.08) * 0.155 + 0.005, 0.08, 24, 1, true), M.reflective, g); band.position.y = y + 0.04; }
  contactShadow(g, 0.6, 0.6, [0, 0, 0], 0.5);
  return g;
}

export function chock(lab) {
  const M = materials(lab);
  const g = new THREE.Group();
  const s = new THREE.Shape(); s.moveTo(-0.22, 0); s.lineTo(0.22, 0); s.lineTo(0.08, 0.2); s.lineTo(-0.08, 0.2); s.closePath();
  const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.55, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 1 }), new THREE.MeshStandardMaterial({ color: 0xe5b51c, roughness: 0.7 }), g);
  m.position.z = -0.275;
  rod(g, [0, 0.12, -0.275], [0, 0.12, -0.6], 0.012, M.plastic);
  return g;
}

/** Simple ramp worker with hi-vis vest and ear defenders. Pose: 'stand' | 'wands' */
export function worker(lab, { pose = 'stand', vest = 'yellow', seed = 1, real = true } = {}) {
  const M = materials(lab);
  const r = rand(seed);
  const g = new THREE.Group(); g.name = 'worker';
  const skinTones = [0x8d5524, 0xc68642, 0xe0ac69, 0x5c3a21, 0xf1c27d];
  const skin = new THREE.MeshStandardMaterial({ color: skinTones[Math.floor(r() * skinTones.length)], roughness: 0.6 });
  const trousers = new THREE.MeshStandardMaterial({ color: 0x1f2a36, roughness: 0.85 });
  const vestMat = vest === 'orange' ? M.hiVisOrange : M.hiVis;
  for (const x of [-0.1, 0.1]) {
    mesh(new THREE.CapsuleGeometry(0.075, 0.72, 4, 10), trousers, g).position.set(x, 0.48, 0);
    mesh(roundedBox(0.13, 0.09, 0.27, 0.03, 1), M.rubber, g).position.set(x, 0.045, -0.04);
  }
  mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 14), new THREE.MeshStandardMaterial({ color: 0x2c3540, roughness: 0.8 }), g).position.set(0, 1.18, 0);
  const vestM = mesh(new THREE.CapsuleGeometry(0.185, 0.36, 4, 14), vestMat, g); vestM.position.set(0, 1.2, 0); vestM.scale.z = 0.8;
  for (const y of [1.05, 1.22]) { const band = mesh(new THREE.CylinderGeometry(0.188, 0.188, 0.045, 18, 1, true), M.reflective, g); band.position.y = y; band.scale.z = 0.82; }
  sphere(g, [0.105, 0.125, 0.11], [0, 1.66, 0], skin, 20);
  sphere(g, [0.112, 0.07, 0.115], [0, 1.73, 0.0], new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }), 16); // hair/cap
  for (const x of [-0.115, 0.115]) sphere(g, [0.035, 0.055, 0.05], [x, 1.66, 0], new THREE.MeshStandardMaterial({ color: 0xd04020, roughness: 0.5 }), 12);
  mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 20, Math.PI), M.plastic, g).position.set(0, 1.66, 0);
  const arm = (x, up) => {
    const a = new THREE.Group(); a.position.set(x, 1.42, 0); g.add(a);
    mesh(new THREE.CapsuleGeometry(0.055, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x2c3540, roughness: 0.8 }), a).position.y = -0.3;
    sphere(a, [0.05, 0.06, 0.05], [0, -0.6, 0], skin, 10);
    if (up) a.rotation.z = Math.sign(x) * 2.5;
    else a.rotation.z = Math.sign(x) * 0.12;
    return a;
  };
  const wands = pose === 'wands';
  const L = arm(-0.24, wands), R = arm(0.24, wands);
  if (wands) for (const a of [L, R]) { const w = cyl(a, 0.025, 0.025, 0.4, [0, -0.78, 0], new THREE.MeshStandardMaterial({ color: 0xff5a1a, emissive: 0xff4400, emissiveIntensity: 0.8 }), null, 8); w.castShadow = false; }
  const procedural = [...g.children];
  contactShadow(g, 0.8, 0.8, [0, 0, 0], 0.5);
  // photoreal Higgsfield model replaces the stand-in once it has loaded (Medium quality and up)
  if (real && pose === 'stand' && quality().realPeople) {
    loadHF(vest === 'orange' ? 'rampOrange' : 'rampYellow').then(p => {
      procedural.forEach(o => (o.visible = false));
      g.add(p); addIdle(p, seed);
    }).catch(() => { /* keep the stand-in */ });
  }
  return g;
}

/** Floodlight mast. */
export function lightMast(lab, h = 22) {
  const M = materials(lab);
  const g = new THREE.Group();
  cyl(g, 0.18, 0.32, h, [0, h / 2, 0], M.brushed, null, 12);
  box(g, [2.6, 0.12, 0.3], [0, h, 0], M.steel);
  for (let i = 0; i < 4; i++) { box(g, [0.5, 0.35, 0.18], [-0.95 + i * 0.63, h - 0.25, 0.15], M.darkMetal).rotation.x = 0.35; }
  return g;
}

/** Passenger boarding bridge from a rotunda to the aircraft door. */
export function jetBridge(lab, { rotunda, door, height = 3.05 }) {
  const M = materials(lab);
  const g = new THREE.Group(); g.name = 'jet-bridge';
  const shell = new THREE.MeshPhysicalMaterial({ color: 0xb9c0c4, metalness: 0.6, roughness: 0.38, clearcoat: 0.3 });
  const glass = materials(lab).tintedGlass;
  // rotunda
  cyl(g, 1.7, 1.7, 2.8, [rotunda.x, height + 1.0, rotunda.z], shell, null, 32);
  cyl(g, 0.45, 0.6, height - 0.2, [rotunda.x, (height - 0.2) / 2, rotunda.z], M.steel, null, 16);
  // tunnel
  const cabPos = door.clone().add(new THREE.Vector3(-2.2, 0, 0));
  const start = new THREE.Vector3(rotunda.x, height + 0.4, rotunda.z);
  const end = new THREE.Vector3(cabPos.x, height + 0.05, cabPos.z);
  const dir = end.clone().sub(start);
  const len = dir.length();
  const tunnel = new THREE.Group();
  tunnel.position.copy(start);
  tunnel.lookAt(end);
  g.add(tunnel);
  // telescoping sections, slightly stepped
  const sections = [[0.0, 0.42, 2.55, 2.55], [0.4, 0.75, 2.45, 2.45], [0.72, 1.0, 2.35, 2.35]];
  sections.forEach(([a, b, w, h]) => {
    const l = (b - a) * len;
    const s = new THREE.Group(); s.position.z = (a + (b - a) / 2) * len; tunnel.add(s);
    box(s, [w, 0.12, l], [0, -h / 2 + 0.06, 0], shell);
    box(s, [w, 0.14, l], [0, h / 2 - 0.07, 0], shell);
    for (const x of [-w / 2, w / 2]) {
      box(s, [0.08, h, l], [x, 0, 0], shell);
      const pane = mesh(new THREE.PlaneGeometry(l - 0.3, h * 0.3), glass, s, { cast: false }); pane.rotation.y = Math.sign(x) * Math.PI / 2; pane.position.set(x + Math.sign(x) * 0.05, h * 0.1, 0);
      for (let k = -l / 2 + 0.7; k <= l / 2 - 0.5; k += 1.4) box(s, [0.12, h * 0.34, 0.07], [x + Math.sign(x) * 0.05, h * 0.1, k], M.steel);
      box(s, [0.12, 0.06, l], [x + Math.sign(x) * 0.04, -h * 0.38, 0], M.steel);
    }
    for (let k = -l / 2 + 0.6; k <= l / 2; k += 1.6) box(s, [w + 0.06, 0.08, 0.1], [0, h / 2 + 0.02, k], M.steel);
  });
  // drive column with wheel bogie under the outer section
  const col = start.clone().lerp(end, 0.82);
  rod(g, [col.x, col.y - 1.3, col.z], [col.x, 0.5, col.z], 0.16, M.steel);
  box(g, [2.0, 0.35, 0.6], [col.x, 0.5, col.z], M.darkMetal);
  for (const x of [-0.7, 0.7]) wheel(g, col.x + x, 0.42, col.z, 0.42, 0.3, M);
  // cab + bellows canopy at the door
  const cab = new THREE.Group(); cab.position.set(cabPos.x + 0.8, height, cabPos.z); g.add(cab);
  mesh(roundedBox(2.6, 2.5, 3.0, 0.12), shell, cab).position.set(0, 1.25, 0);
  box(cab, [0.9, 2.3, 2.4], [1.45, 1.2, 0], new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.9 })); // bellows
  for (let i = 0; i < 6; i++) box(cab, [0.05, 2.35, 2.45], [1.05 + i * 0.16, 1.2, 0], M.plastic);
  const cabGlass = mesh(new THREE.PlaneGeometry(2.4, 1.0), glass, cab, { cast: false }); cabGlass.position.set(0, 1.6, -1.52); cabGlass.rotation.y = Math.PI;
  // stair + service door
  const stairs = new THREE.Group(); stairs.position.set(rotunda.x + 1.6, 0, rotunda.z + 1.2); g.add(stairs);
  for (let i = 0; i < 14; i++) box(stairs, [1.0, 0.05, 0.3], [0, 0.2 + i * 0.2, i * 0.26], M.steel);
  rod(stairs, [0.5, 0.2, 0], [0.5, 3.0, 3.6], 0.025, M.paintYellow); rod(stairs, [0.5, 1.1, 0], [0.5, 3.9, 3.6], 0.025, M.paintYellow);
  return g;
}

/** Terminal façade with glass curtain wall and gate signage. */
export function terminal(lab, { width = 140, depth = 30, height = 14, gate = 'A7' } = {}) {
  const M = materials(lab);
  const g = new THREE.Group(); g.name = 'terminal';
  const concrete = new THREE.MeshStandardMaterial({ color: 0xc9c6bf, roughness: 0.85 });
  box(g, [width, 4, depth], [0, 2, -depth / 2], concrete);
  // curtain wall
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x5f7f8f, metalness: 0.15, roughness: 0.04, envMapIntensity: 2.2, clearcoat: 1, transparent: true, opacity: 0.92 });
  const wall = mesh(new THREE.PlaneGeometry(width, height - 4), glass, g, { cast: false });
  wall.position.set(0, 4 + (height - 4) / 2, 0.02);
  // interior glow behind glass (simple emissive backdrop)
  const interior = mesh(new THREE.PlaneGeometry(width, height - 4), new THREE.MeshStandardMaterial({ color: 0x1d2830, emissive: 0xfff0d8, emissiveIntensity: 0.12, roughness: 1 }), g, { cast: false });
  interior.position.set(0, 4 + (height - 4) / 2, -3);
  const mullions = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, height - 4, 0.25), M.steel, Math.ceil(width / 2.5) + 1);
  const d = new THREE.Object3D();
  for (let i = 0; i <= width / 2.5; i++) { d.position.set(-width / 2 + i * 2.5, 4 + (height - 4) / 2, 0.12); d.updateMatrix(); mullions.setMatrixAt(i, d.matrix); }
  mullions.castShadow = true;
  g.add(mullions);
  for (let y = 4; y <= height; y += 2.5) box(g, [width, 0.12, 0.25], [0, y, 0.12], M.steel);
  // roof canopy
  box(g, [width + 4, 0.6, depth + 6], [0, height + 0.3, -depth / 2 + 3], new THREE.MeshStandardMaterial({ color: 0xdedcd6, roughness: 0.6 }));
  box(g, [width + 4.2, 0.9, 0.4], [0, height + 0.15, 6.1], M.brushed);
  // gate sign
  const sign = canvasTexture(1024, 256, c => { c.fillStyle = '#163a57'; c.fillRect(0, 0, 1024, 256); c.fillStyle = '#e8c27c'; c.font = '800 150px system-ui'; c.fillText(gate, 40, 180); c.fillStyle = '#fff'; c.font = '600 54px system-ui'; c.fillText('FIRST FLIGHT', 330, 110); c.font = '400 40px system-ui'; c.globalAlpha = 0.8; c.fillText('TRAINING GATE · STAND 7', 330, 180); }).texture;
  mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.25 }), g, { cast: false }).position.set(-10, 3, 0.1);
  // ground floor service doors
  for (let i = 0; i < 6; i++) box(g, [3.2, 3.2, 0.1], [-60 + i * 22, 1.6, 0.06], new THREE.MeshStandardMaterial({ color: 0x6b7378, metalness: 0.6, roughness: 0.4 }));
  return g;
}

export function controlTower(lab) {
  const M = materials(lab);
  const g = new THREE.Group();
  cyl(g, 2.6, 3.4, 42, [0, 21, 0], new THREE.MeshStandardMaterial({ color: 0xd8d6d0, roughness: 0.7 }), null, 24);
  cyl(g, 5.5, 4.2, 1.2, [0, 42.6, 0], M.steel, null, 24);
  cyl(g, 5.2, 5.6, 4, [0, 45.2, 0], new THREE.MeshPhysicalMaterial({ color: 0x31505f, roughness: 0.05, metalness: 0.3, envMapIntensity: 2 }), null, 24);
  cyl(g, 6.0, 5.2, 1.0, [0, 47.7, 0], M.steel, null, 24);
  rod(g, [0, 48, 0], [0, 54, 0], 0.15, M.steel);
  return g;
}

/** Small realistic FOD objects. Returns an array of {object, name}. */
export function fodItems(lab) {
  const M = materials(lab);
  const out = [];
  const add = (name, build) => { const g = new THREE.Group(); build(g); g.name = name; out.push({ object: g, name }); };
  add('Bolt', g => { cyl(g, 0.009, 0.009, 0.07, [0, 0.009, 0], M.steel, [0, 0, Math.PI / 2], 10); cyl(g, 0.017, 0.017, 0.012, [0.04, 0.017, 0], M.steel, [0, 0, Math.PI / 2], 6); });
  add('Drink can', g => { const c = cyl(g, 0.033, 0.033, 0.12, [0, 0.033, 0], new THREE.MeshStandardMaterial({ color: 0xc0262d, metalness: 0.8, roughness: 0.3 }), [0, 0, Math.PI / 2], 20); c.scale.x = 0.85; });
  add('Luggage tag', g => { box(g, [0.06, 0.003, 0.24], [0, 0.003, 0], new THREE.MeshStandardMaterial({ color: 0xf0eee4, roughness: 0.7 })); box(g, [0.06, 0.004, 0.04], [0, 0.004, -0.09], new THREE.MeshStandardMaterial({ color: 0x1a7fc0 })); });
  add('Safety wire', g => tube(g, [[0, 0.004, 0], [0.05, 0.004, 0.03], [0.09, 0.004, -0.02], [0.14, 0.004, 0.02], [0.2, 0.004, -0.01]], 0.0025, M.steel));
  add('Pen', g => cyl(g, 0.006, 0.006, 0.14, [0, 0.006, 0], new THREE.MeshStandardMaterial({ color: 0x1b4fa0, roughness: 0.4 }), [0, 0, Math.PI / 2], 10));
  add('Rag', g => { const geo = new THREE.PlaneGeometry(0.28, 0.22, 8, 8); const p = geo.attributes.position; const r = rand(9); for (let i = 0; i < p.count; i++) p.setZ(i, r() * 0.03); geo.computeVertexNormals(); const m = mesh(geo, new THREE.MeshStandardMaterial({ color: 0xc2a35a, roughness: 1, side: THREE.DoubleSide }), g); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; });
  add('Nut', g => cyl(g, 0.014, 0.014, 0.012, [0, 0.006, 0], M.steel, null, 6));
  add('Bottle cap', g => cyl(g, 0.016, 0.016, 0.012, [0, 0.006, 0], new THREE.MeshStandardMaterial({ color: 0x2b8f3a, roughness: 0.4 }), null, 16));
  add('Plastic wrap', g => { const geo = new THREE.PlaneGeometry(0.35, 0.25, 6, 6); const p = geo.attributes.position; const r = rand(4); for (let i = 0; i < p.count; i++) p.setZ(i, r() * 0.04); geo.computeVertexNormals(); const m = mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0xe8f0f4, roughness: 0.15, transparent: true, opacity: 0.55, side: THREE.DoubleSide }), g); m.rotation.x = -Math.PI / 2; m.position.y = 0.01; });
  add('Rivet', g => { cyl(g, 0.004, 0.004, 0.02, [0, 0.004, 0], M.aluminum, [0, 0, Math.PI / 2], 8); sphere(g, [0.008, 0.005, 0.008], [0.011, 0.005, 0], M.aluminum, 8); });
  return out;
}
