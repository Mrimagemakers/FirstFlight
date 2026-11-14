// Sky Challenge: the flying game built on the flight station. More places to fly, more aircraft, and game
// modes that reuse the training flight paths (the valley tour, the airport circuit and the heading-change
// route): ring races against the clock with medals and best times, a star hunt, and a landing challenge.
// Everything works on screens, in VR headsets (haptics, a 3D guide arrow, results on the VR panel) and in
// phone VR.
import * as THREE from 'three';
import { noise2, rand } from '../util.js';
import { buildAirliner } from '../models/airliner.js';

const FT = 0.3048;

// ------------------------------------------------------------------ aircraft
// roll/pitch: control rates (deg/s per full input). base + thr: target airspeed (kt) at idle → full power.
// vmin/vmax/stall in knots. vsK: climb from extra power (ft/min). ring: course scale. eye: cockpit or nose camera.
export const AIRCRAFT = {
  trainer: { name: 'Trainer', blurb: 'Forgiving four-seat trainer. The airplane from the training missions.', model: 'trainer', livery: 'navy', roll: 28, pitch: 9, base: 58, thr: 68, vmin: 40, vmax: 160, stall: 50, vsK: 700, maxBank: 45, maxPitch: 18, ring: 1, chase: 14 },
  aerobat: { name: 'Aerobatic', blurb: 'Light, fast and very responsive, with a smoke system for display flying.', model: 'trainer', livery: 'display', roll: 72, pitch: 16, base: 72, thr: 112, vmin: 48, vmax: 230, stall: 52, vsK: 1500, maxBank: 88, maxPitch: 38, ring: 0.85, chase: 13, smoke: true },
  bush: { name: 'Bush plane', blurb: 'Slow and steady with a huge climb rate: ideal for valleys and short strips.', model: 'trainer', livery: 'bush', roll: 24, pitch: 11, base: 44, thr: 62, vmin: 34, vmax: 130, stall: 37, vsK: 1150, maxBank: 45, maxPitch: 22, ring: 1, chase: 14 },
  bizjet: { name: 'Business jet', blurb: 'A fast twin-engine jet. Plan your turns early: it covers ground quickly.', model: 'jet', scale: 0.42, accent: '#2a2f38', accent2: '#b88b4a', title: 'SKYLINE', roll: 30, pitch: 7, base: 150, thr: 320, vmin: 115, vmax: 470, stall: 110, vsK: 3000, maxBank: 50, maxPitch: 20, ring: 1.7, chase: 34, eye: [0, 1.2, -7.6], contrail: true },
  airliner: { name: 'Airliner', blurb: 'The First Flight twin-jet airliner. Smooth, heavy and stable: fly it like a pro.', model: 'jet', scale: 1, accent: '#0f3d5c', accent2: '#c9964f', title: 'FIRST FLIGHT', roll: 15, pitch: 5, base: 140, thr: 330, vmin: 125, vmax: 490, stall: 128, vsK: 2600, maxBank: 35, maxPitch: 16, ring: 2.1, chase: 70, eye: [0, 2.6, -17.6], contrail: true },
};

// ------------------------------------------------------------------ new places to fly
export const EXTRA_REGIONS = {
  desert: { dry: 1, fields: 0, name: 'Golden Dunes', env: 'spruit_sunrise', az: 110, el: 30, turb: 4, ray: 1.1, exposure: 0.55, fog: ['#e2cfae', 0.000035], grass: [1.3, 1.05, 0.66], rock: [1.3, 0.85, 0.6], sand: [0.98, 0.78, 0.52], snow: 99999, height: 900, water: -9999, waterColor: 0x3c7c78, trees: 0.03, clouds: 0.1, cloudBase: 2800, sunColor: 0xffe6c2 },
  volcano: { fields: 0.2, name: 'Volcano Bay', env: 'pedestrian_overpass', az: 230, el: 48, turb: 2.6, ray: 1.5, exposure: 0.55, fog: ['#bfdbe4', 0.00003], grass: [0.72, 1.1, 0.6], rock: [0.62, 0.58, 0.58], sand: [0.92, 0.85, 0.66], snow: 99999, height: 600, water: 0, waterColor: 0x0f6d82, trees: 1.0, clouds: 0.45, cloudBase: 1500, sunColor: 0xfff4e2 },
  arctic: { fields: 0, name: 'Glacier Fjords', env: 'blouberg_sunrise', az: 160, el: 14, turb: 3, ray: 1.8, exposure: 0.62, fog: ['#c7d3dc', 0.00004], grass: [0.82, 0.92, 0.86], rock: [0.8, 0.84, 0.92], sand: [0.6, 0.6, 0.62], snow: 260, height: 2300, water: -18, waterColor: 0x23495a, trees: 0.18, clouds: 0.5, cloudBase: 1900, sunColor: 0xffead6 },
  metro: { fields: 0.1, name: 'Harbor City', env: 'venice_sunset', az: 245, el: 11, turb: 5, ray: 2.4, exposure: 0.6, fog: ['#b7a99c', 0.000045], grass: [0.85, 0.95, 0.72], rock: [0.9, 0.88, 0.86], sand: [0.78, 0.72, 0.6], snow: 99999, height: 380, water: 0, waterColor: 0x264f60, trees: 0.45, clouds: 0.3, cloudBase: 1800, sunColor: 0xffc88e, city: 1 },
  night: { fields: 0.1, name: 'City Lights (night)', env: 'moonless_golf', az: 30, el: -9, turb: 1, ray: 0.4, exposure: 1.15, fog: ['#141a26', 0.00005], grass: [0.6, 0.7, 0.6], rock: [0.7, 0.72, 0.78], sand: [0.6, 0.58, 0.55], snow: 99999, height: 380, water: 0, waterColor: 0x0a1626, trees: 0.45, clouds: 0.2, cloudBase: 1800, sunColor: 0x8fa4d6, city: 1, night: true, sunIntensity: 0.35, hemi: 0.22, envIntensity: 0.35 },
};

/** Terrain height for the new regions (metres), or null to use the standard valley shape. */
export function extraHeight(key, x, z, n, detail, c) {
  if (key === 'desert') {
    const dune = (Math.sin(x * 0.0042 + Math.sin(z * 0.0011) * 2.6) * 0.5 + 0.5) * (0.6 + 0.4 * Math.sin(z * 0.0023 + x * 0.0004));
    const valley = Math.max(0, (Math.abs(x) - 1100) / 4500);
    const mesa = Math.min(1, valley) * Math.max(0, noise2(x * 0.00045, z * 0.0004) - 0.05) * c.height;
    return dune * 38 + n * 60 + detail * 0.3 + Math.round(mesa / 90) * 90;
  }
  if (key === 'volcano') {
    let h = (Math.sin(x * 0.0007) * Math.cos(z * 0.00057) + n * 0.6 - 0.4) * c.height;
    const isle = Math.max(0, 1 - Math.hypot(x / 950, (z + 1800) / 1600));
    h = Math.max(h, isle * 60 - 8);
    const dv = Math.hypot(x - 3800, z + 9500);
    const cone = Math.max(0, 1 - dv / 3600);
    h = Math.max(h, Math.pow(cone, 1.6) * 1500 - Math.max(0, 1 - dv / 420) * 260 + detail * cone);
    return h;
  }
  if (key === 'metro' || key === 'night') {
    // a broad river valley: gentle hills inland, harbour water along the east side
    let h = n * 70 + detail * 0.5 + Math.max(0, (-x - 1500) / 3000) * 260 * (0.5 + noise2(x * 0.0004, z * 0.0005));
    if (x > 2600) h = -30 + (2600 - x) * 0.04 + detail * 0.15;
    return h;
  }
  return null;
}

/** Downtown blocks for the city regions: [x, z, radius, maxHeight]. */
export const CITY = [[1700, -6400, 900, 230], [-1300, -9800, 600, 120], [1500, 400, 500, 70], [-1100, -14500, 500, 90]];

// ------------------------------------------------------------------ courses from the training flight paths
const RINGS0 = [[60, 660, -2400], [-280, 700, -5200], [180, 740, -8000], [-120, 690, -10800], [90, 650, -13600]];
export const COURSES = {
  valley: { name: 'Valley run', brief: 'The valley-tour route, extended to the far end of the valley.', start: { x: 0, z: 2600, alt: 2000, heading: 90 },
    points: () => [...RINGS0.map(([x, y, z]) => [x, y, z]), [320, 700, -16000], [-200, 660, -18300], [0, 620, -20200]], clear: 170 },
  circuit: { name: 'Airport circuit', brief: 'Fly the traffic pattern around the airport, then low over the runway.', start: { x: 0, z: 2600, alt: 1200, heading: 90 },
    points: () => [[0, 300, -3200], [-450, 340, -4600], [-1500, 360, -4200], [-1650, 360, -2400], [-1650, 350, -400], [-1450, 330, 1400], [-450, 260, 2300], [0, 160, 1100], [0, 50, -1300]], clear: 45 },
  turn: { name: 'Heading 120 tour', brief: 'The turn-to-a-heading route: out on 090, then a long sweep onto 120 and back.', start: { x: 0, z: 2600, alt: 2000, heading: 90 },
    points: () => [[0, 640, -1600], [700, 680, -4200], [2200, 700, -6500], [3800, 720, -8400], [5200, 700, -10400], [4300, 680, -12800], [2000, 660, -14100], [-400, 640, -12600]], clear: 170 },
  canyon: { name: 'Low-level dash', brief: 'Race down the valley floor through low rings. Watch the terrain!', start: { x: 0, z: 2000, alt: 900, heading: 90 },
    points: () => [[0, 0, -2000], [150, 0, -3600], [-200, 0, -5200], [250, 0, -6800], [-150, 0, -8400], [200, 0, -10000], [-250, 0, -11600], [100, 0, -13200]], clear: 70, low: true },
};

export const MODES = {
  race: 'Ring race', stars: 'Star hunt', landing: 'Landing challenge',
};

const BEST_KEY = 'ff-sky-best';
function loadBest() { try { return JSON.parse(localStorage.getItem(BEST_KEY) || '{}'); } catch { return {}; } }
function saveBest(b) { try { localStorage.setItem(BEST_KEY, JSON.stringify(b)); } catch { /* storage blocked */ } }
const fmt = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

// ------------------------------------------------------------------ particle trails (smoke, contrails)
class Trails {
  constructor(parent, max = 900) {
    this.max = max; this.i = 0;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.age = new Float32Array(max).fill(99); this.life = new Float32Array(max).fill(1); this.size = new Float32Array(max); this.col = new Float32Array(max * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('age', new THREE.BufferAttribute(this.age, 1));
    g.setAttribute('life', new THREE.BufferAttribute(this.life, 1));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(this.col, 3));
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false,
      uniforms: { scale: { value: 600 } },
      vertexShader: `attribute float age; attribute float life; attribute float size; attribute vec3 tint; uniform float scale; varying float vA; varying vec3 vC;
        void main(){ float k = clamp(age / life, 0.0, 1.0); vA = (1.0 - k) * (1.0 - k) * step(age, life); vC = tint;
          vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = min(size * (1.0 + k * 4.0) * scale / max(1.0, -mv.z), 160.0); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ vec2 p = gl_PointCoord - 0.5; float d = dot(p, p); if (d > 0.25) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.25, 0.0, d) * 0.75); }`,
    });
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = 5;
    parent.add(this.points);
  }
  emit(p, size, life, color) {
    const i = this.i = (this.i + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.age[i] = 0; this.life[i] = life; this.size[i] = size;
    this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b;
  }
  update(dt, viewportH) {
    for (let i = 0; i < this.max; i++) if (this.age[i] < 90) this.age[i] += dt;
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.age.needsUpdate = a.life.needsUpdate = a.size.needsUpdate = a.tint.needsUpdate = true;
    this.points.material.uniforms.scale.value = viewportH * 0.5;
  }
}

// ------------------------------------------------------------------ the game
export class SkyGame {
  constructor(station, lab, root) {
    this.st = station; this.lab = lab; this.root = root;
    this.mode = null; this.course = 'valley';
    this.best = loadBest();
    this.group = new THREE.Group(); root.add(this.group);
    this.trails = new Trails(root);
    this.smokeOn = false;
    this.models = {};
    this.buildRings();
    this.buildStars();
    this.buildArrow();
    this.buildNavLights();
  }

  // ---------------------------------------------------------------- scene pieces
  buildRings() {
    this.ringGeo = new THREE.TorusGeometry(1, 0.06, 12, 64);
    this.ringMats = {
      next: new THREE.MeshStandardMaterial({ color: 0xf2c46b, emissive: 0xffb43a, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.3 }),
      later: new THREE.MeshStandardMaterial({ color: 0xbfd6e2, emissive: 0x6aa6c8, emissiveIntensity: 0.45, roughness: 0.4, metalness: 0.3, transparent: true, opacity: 0.75 }),
      done: new THREE.MeshStandardMaterial({ color: 0x8fd6b0, emissive: 0x3c9a6a, emissiveIntensity: 0.3, roughness: 0.4, transparent: true, opacity: 0.35 }),
    };
    this.rings = [];
  }

  buildStars() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.42 : 1, a = Math.PI / 2 + i * Math.PI / 5; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 }); g.center();
    this.starGeo = g;
    this.starMat = new THREE.MeshStandardMaterial({ color: 0xffd76a, emissive: 0xffb020, emissiveIntensity: 1.3, metalness: 0.6, roughness: 0.3 });
    this.stars = [];
  }

  /**
   * A flat 3D chevron just below the pilot's eye line that points at the next target, plus a tall light
   * beam on the next ring so it can be seen from kilometres away (useful in VR, where there is no map).
   */
  buildArrow() {
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.16); sh.lineTo(0.11, 0.02); sh.lineTo(0.045, 0.02); sh.lineTo(0.045, 0.12); sh.lineTo(-0.045, 0.12); sh.lineTo(-0.045, 0.02); sh.lineTo(-0.11, 0.02); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.018, bevelEnabled: false }).rotateX(Math.PI / 2); // lies flat, tip toward -z (forward)
    geo.translate(0, 0, 0);
    const m = new THREE.MeshBasicMaterial({ color: 0xffc85a, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false });
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x5a3a08, depthTest: false, transparent: true, opacity: 0.8 }));
    const g = new THREE.Group(); const body = new THREE.Mesh(geo, m); g.add(body, edge);
    g.traverse(o => (o.renderOrder = 998));
    g.visible = false;
    this.arrow = g;
    this.root.add(g);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc66a, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 20, 1, true).translate(0, 0.5, 0), beamMat);
    this.beam.visible = false;
    this.root.add(this.beam);
  }

  /** Red / green wingtip lights, a white tail light and a flashing strobe on every aircraft. */
  buildNavLights() {
    const mk = c => new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: c, toneMapped: false }));
    this.nav = { red: mk(0xff3030), green: mk(0x30ff60), white: mk(0xffffff), strobe: mk(0xffffff) };
    Object.values(this.nav).forEach(m => this.st.plane.add(m));
    this.placeNav();
  }

  placeNav() {
    const a = this.ac || AIRCRAFT.trainer;
    const span = a.model === 'jet' ? 17.2 * a.scale : 5.5, y = a.model === 'jet' ? (0.6 - 4 + 4) * a.scale : 0.92, z = a.model === 'jet' ? 2 * a.scale : -0.4;
    const r = a.model === 'jet' ? 0.22 * a.scale + 0.08 : 0.07;
    this.nav.red.position.set(-span, y, z); this.nav.green.position.set(span, y, z);
    this.nav.white.position.set(0, a.model === 'jet' ? 9 * a.scale : 1.2, a.model === 'jet' ? 20 * a.scale : 3.7);
    this.nav.strobe.position.set(0, a.model === 'jet' ? -2.3 * a.scale : -0.65, a.model === 'jet' ? 0 : 0.2);
    Object.values(this.nav).forEach(m => m.scale.setScalar(r));
  }

  // ---------------------------------------------------------------- aircraft
  get ac() { return AIRCRAFT[this.st.aircraft] || AIRCRAFT.trainer; }

  setAircraft(id) {
    const st = this.st, a = AIRCRAFT[id] || AIRCRAFT.trainer;
    st.aircraft = AIRCRAFT[id] ? id : 'trainer';
    try { localStorage.setItem('ff-sky-aircraft', st.aircraft); } catch { /* ignore */ }
    const jet = a.model === 'jet';
    st.trainer.root.visible = !jet;
    if (!jet) st.trainer.setLivery?.(a.livery);
    for (const [k, m] of Object.entries(this.models)) m.visible = k === st.aircraft;
    if (jet && !this.models[st.aircraft]) {
      const ap = buildAirliner(this.lab, { quality: a.scale < 0.6 ? 'standard' : 'high', cargoOpen: false, accent: a.accent, accent2: a.accent2, name: a.title });
      const holder = new THREE.Group();
      ap.root.position.y = -4.0;                 // fuselage centre line on the aircraft origin
      holder.add(ap.root); holder.scale.setScalar(a.scale);
      holder.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
      st.plane.add(holder);
      this.models[st.aircraft] = holder;
    }
    this.placeNav();
    // cockpit interior only for the light aircraft; jets use a nose camera
    if (jet && st.view === 'cockpit') st.cockpit.visible = false;
    st.eye = jet ? new THREE.Vector3(...a.eye).multiplyScalar(a.scale === 1 ? 1 : 1) : new THREE.Vector3(-0.27, 0.64, -0.16);
    if (st.lab) st.setView(st.view);
    this.smokeOn = !!a.smoke;
  }

  // ---------------------------------------------------------------- game flow
  start(mode, course) {
    const st = this.st;
    this.mode = mode; if (course) this.course = course;
    this.clearTargets();
    this.time = 0; this.score = 0; this.done = false; this.result = null; this.countdown = 3;
    st.resetFlight(false);
    const s = st.state;
    if (mode === 'race') {
      const c = COURSES[this.course];
      Object.assign(s, { x: c.start.x, z: c.start.z, y: Math.max(c.start.alt * FT, st.height(c.start.x, c.start.z) + 250), heading: c.start.heading });
      this.makeRings(c);
    } else if (mode === 'stars') {
      Object.assign(s, { x: 0, z: 2600, y: 2000 * FT, heading: 90 });
      this.makeStars();
      this.limit = 180;
    } else if (mode === 'landing') {
      // three nautical miles out on a stable approach to runway 09
      const jet = this.ac.model === 'jet';
      const dist = jet ? 9000 : 5200;
      Object.assign(s, { x: (Math.random() - 0.5) * 60, z: -1050 + dist, y: 6 + dist * Math.tan(3 * Math.PI / 180), heading: 90, pitch: -2.5, throttle: jet ? 0.32 : 0.42, speed: jet ? 150 : 70 });
      this.landed = null;
    }
    s.speed = Math.max(s.speed, this.ac.stall + 25);
    if (mode !== 'landing') s.throttle = 0.65;
    st.running = true; st.startAudio?.(); if (st.audio) st.audio.gain.gain.setTargetAtTime(st.sound ? 0.06 : 0, st.audio.ctx.currentTime, 0.2);
    this.lab.ui.toast(`${MODES[mode]}${mode === 'race' ? ' · ' + COURSES[this.course].name : ''} · Go!`, 'good');
    st.panel();
  }

  stop() { this.mode = null; this.clearTargets(); this.arrow.visible = false; this.beam.visible = false; this.st.panel(); }

  clearTargets() {
    this.rings.forEach(r => this.group.remove(r)); this.rings = [];
    this.stars.forEach(r => this.group.remove(r)); this.stars = [];
    this.next = 0;
  }

  makeRings(c) {
    const st = this.st, k = this.ac.ring, R = 55 * k;
    this.ringPath = c.points().map(([x, y, z]) => new THREE.Vector3(x, c.low ? st.height(x, z) + 110 * Math.max(1, k * 0.8) : Math.max(y, st.height(x, z) + c.clear * Math.max(1, k * 0.8)), z));
    this.rings = this.ringPath.map((p, i) => {
      const r = new THREE.Mesh(this.ringGeo, this.ringMats.later);
      r.scale.setScalar(R); r.position.copy(p);
      const n = this.ringPath[i + 1] || p.clone().add(p.clone().sub(this.ringPath[i - 1] || p).setLength(10));
      r.lookAt(n.x, p.y, n.z);
      this.group.add(r);
      return r;
    });
    this.ringR = R;
    this.paintRings();
    // par time from the path length at a brisk cruise
    let L = new THREE.Vector3(c.start.x, 0, c.start.z).distanceTo(new THREE.Vector3(this.ringPath[0].x, 0, this.ringPath[0].z));
    for (let i = 1; i < this.ringPath.length; i++) L += this.ringPath[i].distanceTo(this.ringPath[i - 1]);
    const cruise = (this.ac.base + this.ac.thr * 0.8) * 0.5144;
    this.par = L / cruise;
  }

  paintRings() { this.rings.forEach((r, i) => (r.material = i < this.next ? this.ringMats.done : i === this.next ? this.ringMats.next : this.ringMats.later)); }

  makeStars() {
    const st = this.st, r = rand(Math.floor(Math.random() * 1e6)), k = Math.max(1, this.ac.ring * 0.8);
    for (let i = 0; i < 24; i++) {
      const z = -1000 - r() * 15000, x = (r() - 0.5) * 3600 * (0.4 + Math.abs(z) / 16000);
      const y = st.height(x, z) + 160 + r() * 420;
      const m = new THREE.Mesh(this.starGeo, this.starMat);
      m.position.set(x, Math.max(y, 120), z); m.scale.setScalar(16 * k);
      m.userData.spin = r() * 6;
      this.group.add(m); this.stars.push(m);
    }
  }

  buzz(strength = 0.6, ms = 90) {
    const xr = this.lab.xr;
    if (this.lab.renderer.xr.isPresenting) xr?.controllers?.forEach(c => xr.buzz(c, strength, ms));
    this.lab.gamepad?.rumble?.(strength, ms);
  }

  chime(kind = 'good') { try { this.lab.audio?.click?.(kind); } catch { /* audio unavailable */ } }

  finish(text, record) {
    this.done = true; this.result = text; this.arrow.visible = false; this.beam.visible = false;
    this.st.running = false;
    if (this.st.audio) this.st.audio.gain.gain.setTargetAtTime(0, this.st.audio.ctx.currentTime, 0.3);
    if (record) { this.best[record.key] = record.value; saveBest(this.best); }
    this.lab.ui.toast(text, 'good');
    this.buzz(0.9, 220);
    this.st.panel();
  }

  /** Called when the aircraft reaches the ground. Return true when the game handled it (a landing). */
  groundContact(s) {
    if (this.mode !== 'landing' || this.done) return false;
    const onRunway = Math.abs(s.x) < 15 && s.z < -1040 && s.z > -2560;
    if (!onRunway) return false;
    if (this.landed) return true;
    const vs = s.vs, bank = Math.abs(s.bank), cl = Math.abs(s.x);
    const tdz = s.z < -1110 && s.z > -1500 ? 1 : s.z <= -1500 && s.z > -1900 ? 0.6 : 0.2;
    if (vs < -900 || bank > 12 || s.pitch < -6) return false; // too hard: a crash, not a landing
    const smooth = Math.max(0, 100 - Math.max(0, -vs - 60) / 6);
    const center = Math.max(0, 100 - cl * 7);
    const score = Math.round(smooth * 0.45 + center * 0.3 + tdz * 100 * 0.25 - bank * 2);
    this.landed = { score, vs: Math.round(vs), cl: cl.toFixed(1), zone: tdz === 1 ? 'in the touchdown zone' : tdz > 0.5 ? 'a little long' : 'well past the touchdown zone' };
    s.y = this.st.height(s.x, s.z) + 1.0 + (this.ac.model === 'jet' ? 2.5 * this.ac.scale + 1.5 : 0.4); s.pitch = 1; s.bank = 0; s.vs = 0; s.onGround = true;
    return true;
  }

  // ---------------------------------------------------------------- per-frame
  update(dt) {
    const st = this.st, s = st.state, lab = this.lab;
    // trails: smoke from the aerobatic tail, contrails from jet engines up high
    const a = this.ac, pq = st.plane.quaternion;
    if (st.running) {
      if (this.smokeOn && a.smoke) for (let k = 0; k < 2; k++) this.trails.emit(new THREE.Vector3(0, -0.1, 4.2 + k * 0.6).applyQuaternion(pq).add(st.plane.position), 1.1, 8, new THREE.Color(0xf4f4f4));
      if (a.contrail && s.y / FT > 4500) for (const sx of [-1, 1]) this.trails.emit(new THREE.Vector3(sx * 5.8 * a.scale, -1.2 * a.scale, 3 * a.scale).applyQuaternion(pq).add(st.plane.position), 3 * a.scale + 1.5, 9, new THREE.Color(0xffffff));
    }
    this.trails.update(dt, lab.renderer.domElement.clientHeight || 800);
    // nav lights: strobe flashes, and they glow at night
    const tt = performance.now() / 1000;
    this.nav.strobe.visible = (tt % 1.2) < 0.07 || ((tt + 0.18) % 1.2) < 0.06;
    // spin the stars
    this.stars.forEach(m => { m.rotation.y = (m.userData.spin += dt * 1.6); });

    if (!this.mode) { this.arrow.visible = false; this.beam.visible = false; return; }
    if (this.done) { st.status = this.result; st.statusFrac = 1; this.arrow.visible = false; this.beam.visible = false; return; }
    if (!st.running) { st.status = 'Paused'; return; }
    this.time += dt;
    const P = new THREE.Vector3(s.x, s.y, s.z);
    let target = null;

    if (this.mode === 'race') {
      const ring = this.rings[this.next];
      if (ring) {
        target = ring.position;
        const local = ring.worldToLocal(P.clone());
        if (Math.abs(local.z) < 0.6 && Math.hypot(local.x, local.y) < 1.05) {
          this.next++; this.paintRings(); this.chime('good'); this.buzz(0.5, 70);
          if (this.next >= this.rings.length) {
            const key = `race:${this.course}:${st.aircraft}`, t = this.time, prev = this.best[key];
            const medal = t <= this.par * 1.08 ? 'Gold' : t <= this.par * 1.3 ? 'Silver' : t <= this.par * 1.6 ? 'Bronze' : null;
            const rec = !prev || t < prev;
            this.finish(`Finished in ${fmt(t)}${medal ? ' · ' + medal + ' medal' : ''}${rec ? ' · New best!' : ' · Best ' + fmt(prev)}`, rec ? { key, value: +t.toFixed(2) } : null);
            return;
          } else lab.ui.toast(`Ring ${this.next} of ${this.rings.length}`, 'good');
        }
        st.status = `${COURSES[this.course].name} · ring ${this.next + 1}/${this.rings.length} · ${fmt(this.time)}`;
        st.statusFrac = this.next / this.rings.length;
      }
    } else if (this.mode === 'stars') {
      const R = 34 * Math.max(1, a.ring * 0.8);
      let nearest = null, nd = Infinity;
      for (let i = this.stars.length - 1; i >= 0; i--) {
        const m = this.stars[i], d = m.position.distanceTo(P);
        if (d < R) { this.group.remove(m); this.stars.splice(i, 1); this.score += 100; this.chime('good'); this.buzz(0.5, 60); continue; }
        if (d < nd) { nd = d; nearest = m; }
      }
      target = nearest?.position;
      const left = Math.max(0, this.limit - this.time);
      st.status = `Star hunt · ${24 - this.stars.length}/24 stars · ${fmt(left)} left`;
      st.statusFrac = (24 - this.stars.length) / 24;
      if (!this.stars.length || left <= 0) {
        const bonus = this.stars.length ? 0 : Math.round(left * 10), total = this.score + bonus, key = `stars:${st.aircraft}`, prev = this.best[key];
        const rec = !prev || total > prev;
        this.finish(`${24 - this.stars.length} stars · ${total} points${rec ? ' · New best!' : ' · Best ' + prev}`, rec ? { key, value: total } : null);
        return;
      }
    } else if (this.mode === 'landing') {
      target = new THREE.Vector3(0, 6, -1200);
      if (this.landed) {
        // roll out and brake
        s.throttle = 0; s.speed = Math.max(0, s.speed - dt * (a.model === 'jet' ? 9 : 7));
        if (s.speed < 25) {
          const key = `landing:${st.aircraft}`, prev = this.best[key], L = this.landed;
          const rec = !prev || L.score > prev;
          this.finish(`Landed ${L.zone} · ${L.vs} ft/min · ${L.cl} m off centre · ${L.score} points${rec ? ' · New best!' : ''}`, rec ? { key, value: L.score } : null);
          s.speed = 0;
          return;
        }
        st.status = `Rolling out · ${Math.round(s.speed)} kt`;
      } else {
        const d = Math.hypot(s.x, s.z + 1200);
        const glide = (s.y - 6) / Math.max(1, d), gs = Math.atan(glide) * 180 / Math.PI;
        st.status = `Approach · ${(d / 1852).toFixed(1)} NM · glidepath ${gs > 3.6 ? 'high' : gs < 2.4 ? 'low' : 'on'} · ${Math.round(s.vs)} ft/min`;
        st.statusFrac = 1 - Math.min(1, d / 9000);
      }
    }
    this.pointArrow(target);
  }

  pointArrow(target) {
    const lab = this.lab, cam = lab.renderer.xr.isPresenting ? lab.renderer.xr.getCamera() : lab.camera;
    if (!target) { this.arrow.visible = false; this.beam.visible = false; return; }
    const cq = cam.getWorldQuaternion(new THREE.Quaternion());
    const eye = cam.getWorldPosition(new THREE.Vector3());
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cq), up = new THREE.Vector3(0, 1, 0).applyQuaternion(cq);
    const pos = eye.clone().addScaledVector(fwd, 0.95).addScaledVector(up, this.st.view === 'cockpit' ? -0.04 : -0.2);
    this.arrow.position.copy(pos);
    // point along the direction to the target, keeping the chevron flat to the horizon (tilted for climbs)
    const dir = target.clone().sub(pos);
    const yaw = Math.atan2(-dir.x, -dir.z), pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
    this.arrow.rotation.set(THREE.MathUtils.clamp(pitch, -0.6, 0.6), yaw, 0, 'YXZ');
    const d = eye.distanceTo(target);
    this.arrow.scale.setScalar(d < 400 ? 0.8 : 1);
    this.arrow.visible = true;
    // a light beam from the ground up through the target
    const ground = this.st.height(target.x, target.z);
    this.beam.position.set(target.x, ground, target.z);
    const R = this.mode === 'race' ? this.ringR * 0.18 : 10;
    this.beam.scale.set(R, Math.max(10, target.y - ground + (this.mode === 'race' ? this.ringR : 60)), R);
    this.beam.material.opacity = THREE.MathUtils.clamp(d / 3000, 0.08, 0.3);
    this.beam.visible = this.mode !== 'landing';
  }

  // ---------------------------------------------------------------- panel content
  bestLine() {
    const b = this.best, ac = this.st.aircraft, out = [];
    for (const [k, c] of Object.entries(COURSES)) if (b[`race:${k}:${ac}`]) out.push(`${c.name} ${fmt(b[`race:${k}:${ac}`])}`);
    if (b[`stars:${ac}`]) out.push(`Star hunt ${b[`stars:${ac}`]} pts`);
    if (b[`landing:${ac}`]) out.push(`Landing ${b[`landing:${ac}`]} pts`);
    return out.length ? out.join(' · ') : 'No records yet in this aircraft.';
  }
}
