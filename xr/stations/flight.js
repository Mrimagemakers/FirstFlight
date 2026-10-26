// Station 05: flight practice over six realistic regions, seen from a detailed trainer cockpit.
import * as THREE from 'three';
import { mesh, box, cyl, rod, sphere, canvasTexture, noise2, rand, roundedBox, lathe } from '../util.js';
import { materials } from '../materials.js';
import { buildTrainer, TRAINER_GROUND } from '../models/trainer.js';
import { quality } from '../settings.js';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FT = 0.3048;
const $ = id => document.getElementById(id);

export const REGIONS = {
  alpine: { name: 'Alpine Lakes', env: 'quarry_01', az: 150, el: 42, turb: 2.4, ray: 1.3, exposure: 0.55, fog: ['#b9cbd8', 0.000045], grass: [0.82, 1.0, 0.78], rock: [0.95, 0.95, 0.98], sand: [0.62, 0.58, 0.5], snow: 1350, height: 2700, water: -18, waterColor: 0x2e5f6e, trees: 1.0, clouds: 0.55, cloudBase: 1700, sunColor: 0xfff2df },
  coast: { name: 'Pacific Coast', env: 'pedestrian_overpass', az: 200, el: 38, turb: 3, ray: 1.6, exposure: 0.55, fog: ['#c3d6e2', 0.00004], grass: [0.95, 1.0, 0.7], rock: [1.0, 0.96, 0.88], sand: [0.82, 0.76, 0.6], snow: 99999, height: 450, water: 0, waterColor: 0x1f5d73, trees: 0.7, clouds: 0.4, cloudBase: 1400, sunColor: 0xfff4e4 },
  canyon: { dry: 0.85, fields: 0.15, name: 'Red Rock Canyon', env: 'quarry_01', az: 120, el: 50, turb: 5, ray: 0.9, exposure: 0.52, fog: ['#d7cdbd', 0.00004], grass: [1.25, 1.0, 0.62], rock: [1.35, 0.72, 0.5], sand: [0.78, 0.55, 0.38], snow: 99999, height: 1300, water: -9999, waterColor: 0x3c7c78, trees: 0.12, clouds: 0.15, cloudBase: 2600, sunColor: 0xfff0d6 },
  islands: { fields: 0.35, name: 'Emerald Islands', env: 'pedestrian_overpass', az: 210, el: 55, turb: 2.2, ray: 1.4, exposure: 0.55, fog: ['#bcdbe6', 0.000035], grass: [0.78, 1.05, 0.62], rock: [0.95, 0.95, 0.9], sand: [0.9, 0.84, 0.66], snow: 99999, height: 700, water: 0, waterColor: 0x10707c, trees: 0.9, clouds: 0.5, cloudBase: 1300, sunColor: 0xfff6e8 },
  highlands: { dry: 0.32, fields: 0.25, name: 'Northern Highlands', env: 'blouberg_sunrise', az: 140, el: 22, turb: 6, ray: 2.2, exposure: 0.6, fog: ['#a9b6bf', 0.00008], grass: [0.95, 0.86, 0.62], rock: [0.86, 0.86, 0.88], sand: [0.52, 0.44, 0.34], snow: 99999, height: 1200, water: -12, waterColor: 0x34525e, trees: 0.3, clouds: 0.85, cloudBase: 1200, sunColor: 0xffe2c4 },
  twilight: { name: 'Blue Hour Valley', env: 'venice_sunset', az: 250, el: 3.5, turb: 8, ray: 3, exposure: 0.62, fog: ['#6f7f99', 0.00006], grass: [0.8, 0.88, 0.8], rock: [0.88, 0.9, 1.0], sand: [0.6, 0.55, 0.5], snow: 1750, height: 2000, water: -18, waterColor: 0x2b3d5c, trees: 0.9, clouds: 0.35, cloudBase: 2100, sunColor: 0xffb27a },
};

const MISSIONS = [
  { id: 0, title: 'Straight & level', brief: 'Hold 2,000 ft ±100 ft, heading 090° ±10°, and wings level (bank within 5°) for 15 seconds.' },
  { id: 1, title: 'A gentle climb', brief: 'Add power, raise the nose gently and climb to 2,500 ft. Hold ±100 ft with wings level for 15 seconds.' },
  { id: 2, title: 'Turn to a heading', brief: 'Make a gentle right turn to heading 120°, then hold ±10° at 2,000 ft ±150 ft with wings level for 15 seconds.' },
  { id: 3, title: 'Valley tour', brief: 'Fly through the five gold rings down the valley. Use small, early corrections and watch the terrain.' },
  { id: 4, title: 'Free flight', brief: 'Explore the region. Watch the terrain, the horizon and your instruments, and practice small corrections.' },
];
const RINGS = [[60, 660, -2400], [-280, 700, -5200], [180, 740, -8000], [-120, 690, -10800], [90, 650, -13600]];

export class FlightStation {
  constructor() {
    this.title = 'Flight practice';
    this.xrLocomotion = 'none';
    this.keys = new Set();
    this.touch = {};
    this.view = 'cockpit';
    this.mission = 0;
  }

  // ------------------------------------------------------------------ terrain height (metres)
  height(x, z, key = this.region) {
    const c = REGIONS[key];
    const n = noise2(x * 0.0006, z * 0.0006), detail = noise2(x * 0.003, z * 0.003) * 55;
    let h;
    if (key === 'islands') {
      h = (Math.sin(x * 0.0007) * Math.cos(z * 0.00057) + n * 0.6 - 0.45) * c.height;
      const isle = Math.max(0, 1 - Math.hypot(x / 900, (z + 1800) / 1500)); // the airport island
      h = Math.max(h, isle * 60 - 8);
    } else {
      const valley = Math.max(0, (Math.abs(x) - 900) / 5000);
      const ridge = 1 - Math.abs(noise2(x * 0.00031, z * 0.00035));
      h = Math.pow(Math.min(valley, 1.7), 1.25) * c.height * (0.2 + ridge * 0.75) + n * 100 + detail;
      if (key === 'canyon') h = Math.round(h / 140) * 140 + detail * 0.3 + Math.max(0, n) * 30;
      if (key === 'coast' && x < -1800) h = -40 + (x + 1800) * 0.05 + detail * 0.2;
    }
    // flatten the airport strip
    const clear = THREE.MathUtils.clamp((Math.abs(x) - 250) / 650, 0, 1);
    const along = THREE.MathUtils.clamp((Math.max(z - 1500, -3200 - z, 0)) / 900, 0, 1);
    const flat = Math.max(clear, along);
    if (z > -4200 && z < 2400) h = 6 + (h - 6) * flat;
    return h;
  }

  async build(lab) {
    const M = materials(lab);
    const root = this.root = new THREE.Group();
    root.name = 'flight';
    this.region = REGIONS[localStorage.getItem('flight-world')] ? localStorage.getItem('flight-world') : 'alpine';

    // -------------------------------------------------------------- terrain mesh + custom splat material
    const SIZE = 40000, SEG = quality().terrainSeg;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG).rotateX(-Math.PI / 2);
    geo.translate(0, 0, -7000);
    { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * SIZE / 45, uv.getY(i) * SIZE / 45); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    this.terrainUniforms = {
      tGrass: { value: lab.tex('grass_albedo.jpg', { srgb: true }) },
      tRock: { value: lab.tex('rock_albedo.jpg', { srgb: true }) },
      grassTint: { value: new THREE.Color() }, rockTint: { value: new THREE.Color() }, sandTint: { value: new THREE.Color() },
      snowLine: { value: 1600 }, waterLevel: { value: -18 }, dryness: { value: 0 }, fieldAmount: { value: 0.9 },
    };
    const tmat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, normalMap: lab.tex('rock_normal.jpg'), normalScale: new THREE.Vector2(0.55, 0.55) });
    tmat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.terrainUniforms);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNor;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWNor = normalize(mat3(modelMatrix) * objectNormal);');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vWPos; varying vec3 vWNor;
uniform sampler2D tGrass; uniform sampler2D tRock; uniform vec3 grassTint; uniform vec3 rockTint; uniform vec3 sandTint; uniform float snowLine; uniform float waterLevel; uniform float dryness; uniform float fieldAmount;
float fHash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }`)
        .replace('#include <map_fragment>', `
  vec2 wp = vWPos.xz;
  vec3 g1 = texture2D(tGrass, wp / 34.0).rgb;
  vec3 g2 = texture2D(tGrass, wp / 420.0 + 0.37).rgb;
  vec3 grassC = mix(g1, g2, 0.55) * grassTint;
  // patchwork of fields on the gentle valley floor
  vec2 fp = (wp + vec2(wp.y * 0.18, 0.0)) / 340.0;
  vec2 cell = floor(fp);
  float hsh = fHash(cell);
  vec3 field = hsh < 0.35 ? vec3(0.72, 0.95, 0.6) : hsh < 0.55 ? vec3(1.45, 1.25, 0.55) : hsh < 0.7 ? vec3(1.05, 0.78, 0.55) : hsh < 0.85 ? vec3(0.95, 1.1, 0.7) : vec3(1.2, 1.15, 0.75);
  vec2 edge = abs(fract(fp) - 0.5);
  field *= mix(0.84, 1.0, smoothstep(0.48, 0.46, max(edge.x, edge.y)));
  field = mix(vec3(1.0), field, 0.75);
  float slope = 1.0 - clamp(vWNor.y, 0.0, 1.0);
  float valleyFloor = (1.0 - smoothstep(60.0, 260.0, vWPos.y - waterLevel)) * (1.0 - smoothstep(0.04, 0.12, slope));
  grassC *= mix(vec3(1.0), field, valleyFloor * fieldAmount);
  float lum = dot(grassC, vec3(0.3, 0.55, 0.15));
  grassC = mix(grassC, sandTint * (0.55 + lum * 1.2), dryness);
#ifdef TERRAIN_HQ
  // tri-planar rock: no stretching on cliffs; two scales plus sedimentary banding
  vec3 an = pow(abs(vWNor), vec3(4.0)); an /= (an.x + an.y + an.z);
  vec3 rA = texture2D(tRock, vWPos.zy / 70.0).rgb * an.x + texture2D(tRock, wp / 70.0).rgb * an.y + texture2D(tRock, vWPos.xy / 70.0).rgb * an.z;
  vec3 rB = texture2D(tRock, vWPos.zy / 19.0).rgb * an.x + texture2D(tRock, wp / 19.0).rgb * an.y + texture2D(tRock, vWPos.xy / 19.0).rgb * an.z;
  vec3 rockC = mix(rA, rB, 0.38) * rockTint;
  float strata = sin(vWPos.y * 0.11 + texture2D(tRock, wp / 380.0).r * 7.0);
  rockC *= 0.9 + 0.16 * strata * smoothstep(0.25, 0.6, slope);
  // large-scale colour variation so meadows and forests don't look uniform
  float macro = texture2D(tGrass, wp / 3100.0).g;
  grassC *= 0.82 + 0.36 * macro;
  grassC = mix(vec3(dot(grassC, vec3(0.3, 0.59, 0.11))), grassC, 0.8);
  rockC *= 0.88 + 0.24 * texture2D(tRock, wp / 2700.0).b;
#else
  vec3 r1 = texture2D(tRock, wp / 70.0).rgb;
  vec3 r2 = texture2D(tRock, vec2(wp.x + wp.y, vWPos.y * 1.6) / 60.0).rgb;
  vec3 rockC = mix(r1, r2, 0.5) * rockTint;
#endif
  float rockMix = smoothstep(0.07, 0.2, slope);
  vec3 col = mix(grassC, rockC, rockMix);
  float sNoise = texture2D(tRock, wp / 900.0).r * 0.6 + texture2D(tRock, wp / 140.0).g * 0.4;
  float sn = smoothstep(snowLine - 260.0, snowLine + 60.0, vWPos.y + (sNoise - 0.5) * 520.0) * (1.0 - smoothstep(0.42, 0.78, slope + (sNoise - 0.5) * 0.25));
  col = mix(col, vec3(0.8, 0.83, 0.88) * (0.82 + texture2D(tRock, wp / 50.0).r * 0.3), sn);
  float bn = (texture2D(tRock, wp / 160.0).r - 0.5) * 7.0;
  float beach = 1.0 - smoothstep(waterLevel + 1.0 + bn, waterLevel + 4.5 + bn, vWPos.y);
  col = mix(col, sandTint, beach * step(-9000.0, waterLevel));
  diffuseColor.rgb *= col;
`);
    };
    this.terrainMat = tmat;
    if (quality().terrainHQ) tmat.defines = { TERRAIN_HQ: '' };
    this.terrain = mesh(geo, tmat, root, { cast: false, receive: true });
    this.terrain.name = 'terrain';

    // -------------------------------------------------------------- water
    const wn = lab.tex('water_normal.jpg', { repeat: [220, 220] });
    this.waterMat = new THREE.MeshPhysicalMaterial({ color: 0x2e5f6e, roughness: 0.07, metalness: 0, normalMap: wn, normalScale: new THREE.Vector2(0.45, 0.45), clearcoat: 0.6, clearcoatRoughness: 0.15, envMapIntensity: 1.1 });
    this.water = mesh(new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.6).rotateX(-Math.PI / 2), this.waterMat, root, { cast: false });
    this.water.position.set(0, -18, -7000);
    this.waterNormal = wn;
    // Ultra: real-time reflections of terrain, sky and the airplane (screens only; headsets use the standard water)
    this.waterR = null;
    if (quality().water === 'reflect') this.makeReflectiveWater(SIZE);

    // -------------------------------------------------------------- vegetation & villages (instanced)
    const { conGeo, decGeo } = this.treeGeometry(quality().trees > 1.2);
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: !(quality().trees > 1.2) });
    const nTrees = Math.round(8000 * quality().trees);
    this.conifers = new THREE.InstancedMesh(conGeo, treeMat, nTrees);
    this.broadleaf = new THREE.InstancedMesh(decGeo, treeMat, Math.round(nTrees * 0.6));
    this.conifers.castShadow = this.broadleaf.castShadow = !!quality().treeShadows;
    root.add(this.conifers, this.broadleaf);
    const houseGeo = new THREE.BoxGeometry(1, 1, 1); houseGeo.translate(0, 0.5, 0);
    const roofGeo = new THREE.CylinderGeometry(0, 0.78, 0.6, 4, 1); roofGeo.rotateY(Math.PI / 4); roofGeo.scale(1, 1, 1.4); roofGeo.translate(0, 1.3, 0);
    this.houses = new THREE.InstancedMesh(houseGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), 900);
    this.roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75 }), 900);
    root.add(this.houses, this.roofs);

    // -------------------------------------------------------------- airport: runway, taxiway, apron, hangars, windsock
    const ap = new THREE.Group(); ap.position.y = 4; root.add(ap); this.airport = ap;
    const rw = new THREE.PlaneGeometry(30, 1500).rotateX(-Math.PI / 2);
    const ruv = rw.attributes.uv; for (let i = 0; i < ruv.count; i++) ruv.setXY(i, ruv.getX(i) * 30 / 10, ruv.getY(i) * 1500 / 10);
    mesh(rw, M.asphalt, ap, { cast: false }).position.set(0, 2.05, -1800);
    const marks = canvasTexture(256, 4096, (c) => {
      c.clearRect(0, 0, 256, 4096);
      c.fillStyle = '#eceee8';
      c.fillRect(6, 0, 5, 4096); c.fillRect(245, 0, 5, 4096);
      for (let y = 330; y < 3760; y += 136) c.fillRect(124, y, 8, 68);
      for (const top of [true, false]) for (let i = 0; i < 8; i++) c.fillRect(22 + i * 27 + (i > 3 ? 12 : 0), top ? 24 : 4096 - 24 - 150, 14, 150);
      c.font = '700 120px system-ui'; c.textAlign = 'center';
      c.save(); c.translate(128, 4096 - 210); c.fillText('09', 0, 0); c.restore();
      c.save(); c.translate(128, 210); c.rotate(Math.PI); c.fillText('27', 0, 0); c.restore();
      for (const y of [700, 3396]) { c.fillRect(40, y, 40, 160); c.fillRect(176, y, 40, 160); }
    }, { srgb: true, anisotropy: 16 }).texture;
    const rm = mesh(new THREE.PlaneGeometry(30, 1500).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: marks, transparent: true, roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2 }), ap, { cast: false });
    rm.position.set(0, 2.07, -1800);
    const tw = new THREE.PlaneGeometry(14, 1300).rotateX(-Math.PI / 2);
    const tuv = tw.attributes.uv; for (let i = 0; i < tuv.count; i++) tuv.setXY(i, tuv.getX(i) * 1.4, tuv.getY(i) * 130);
    mesh(tw, M.asphalt, ap, { cast: false }).position.set(70, 2.04, -1800);
    mesh(new THREE.PlaneGeometry(0.3, 1290).rotateX(-Math.PI / 2), M.paintYellow, ap, { cast: false }).position.set(70, 2.08, -1800);
    const apron = new THREE.PlaneGeometry(130, 240).rotateX(-Math.PI / 2);
    const auv = apron.attributes.uv; for (let i = 0; i < auv.count; i++) auv.setXY(i, auv.getX(i) * 130 / 7.5, auv.getY(i) * 240 / 7.5);
    mesh(apron, M.concrete, ap, { cast: false }).position.set(150, 2.03, -1700);
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Group(); h.position.set(190, 2, -1800 + i * 55); ap.add(h);
      box(h, [32, 11, 40], [0, 5.5, 0], new THREE.MeshStandardMaterial({ color: [0xb9c0c3, 0x8fa3ae, 0xc5c2b8, 0xa8b2b6][i], metalness: 0.5, roughness: 0.45 }));
      const roof = mesh(new THREE.CylinderGeometry(20, 20, 40, 24, 1, false, -0.55, 1.1), new THREE.MeshStandardMaterial({ color: 0x8b969b, metalness: 0.6, roughness: 0.4 }), h);
      roof.rotation.x = Math.PI / 2; roof.position.y = 11 - 20 * Math.cos(0.55) + 0.1;
      box(h, [26, 9, 0.3], [-16.1, 4.5, 0], new THREE.MeshStandardMaterial({ color: 0x2b4458, metalness: 0.5, roughness: 0.45 })).rotation.y = Math.PI / 2;
    }
    // parked light aircraft on the apron
    for (let i = 0; i < 3; i++) { const t = buildTrainer(lab, { interior: false }); t.root.scale.setScalar(1); t.root.position.set(130, 2.03, -1760 + i * 18); t.root.rotation.y = Math.PI / 2; ap.add(t.root); }
    // windsock
    const sock = new THREE.Group(); sock.position.set(-40, 2, -1150); ap.add(sock);
    rod(sock, [0, 0, 0], [0, 7, 0], 0.08, M.paintWhite);
    const cone = mesh(new THREE.CylinderGeometry(0.15, 0.45, 3, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xff6a1a, roughness: 0.7, side: THREE.DoubleSide }), sock);
    cone.rotation.z = Math.PI / 2; cone.position.set(1.6, 6.8, 0);
    this.sock = cone;

    // -------------------------------------------------------------- clouds (camera-facing sprites)
    const cloudMats = [0, 1, 2, 3, 4, 5].map(k => new THREE.SpriteMaterial({ map: lab.tex(`cumulus${k}.png`, { srgb: true }), transparent: true, depthWrite: false, fog: true }));
    this.cloudMats = cloudMats;
    this.clouds = new THREE.Group(); root.add(this.clouds);
    const cr = rand(77);
    for (let c = 0; c < Math.round(70 * (quality().clouds || 1)); c++) {
      const cx = (cr() - 0.5) * 28000, cz = -7000 + (cr() - 0.5) * 32000;
      const big = 0.6 + cr() * 0.9;
      const n = 4 + Math.floor(cr() * 6);
      for (let k = 0; k < n; k++) {
        const s = new THREE.Sprite(cloudMats[Math.floor(cr() * 6)]);
        const sc = (520 + cr() * 700) * big;
        s.scale.set(sc * 1.25, sc, 1);
        s.userData.base = new THREE.Vector3(cx + (cr() - 0.5) * 1100 * big, (cr() - 0.25) * 160 * big + k * 25, cz + (cr() - 0.5) * 1100 * big);
        s.userData.k = cr();
        this.clouds.add(s);
      }
    }

    // -------------------------------------------------------------- rings for the valley tour
    this.rings = RINGS.map(([x, y, z]) => {
      const r = mesh(new THREE.TorusGeometry(55, 3.2, 12, 64), new THREE.MeshStandardMaterial({ color: 0xf2c46b, emissive: 0xc98a2a, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.4 }), root, { cast: false });
      r.position.set(x, y, z);
      return r;
    });

    // -------------------------------------------------------------- the airplane + a detailed cockpit
    this.plane = new THREE.Group(); root.add(this.plane);
    this.trainer = buildTrainer(lab, { interior: false });
    this.trainer.root.children.forEach(o => { if (o.material?.map?.isTexture && o.geometry?.type === 'PlaneGeometry') o.visible = false; }); // drop the ground contact shadow
    this.trainer.model.position.y = 0; // model space origin at the fuselage centre line
    this.plane.add(this.trainer.root);
    this.trainer.setSystems([]);
    this.trainer.animate = false;
    this.trainer.spinning = true;
    this.buildCockpit(lab);
    // clearer glazing for flying (the hangar model uses a darker tint)
    const flightGlass = M.cockpitGlass.clone(); flightGlass.opacity = 0.1; flightGlass.color.set(0x9fb8c4);
    this.trainer.skin.traverse(o => { if (o.isMesh && o.material === M.cockpitGlass) o.material = flightGlass; });
    this.eye = new THREE.Vector3(-0.27, 0.64, -0.16);

    // engine audio (created on first user gesture)
    this.audio = null;
    this.sound = lab.settings?.engine !== false;
    this.post = { ao: false, bloomStrength: 0.18, vignette: 0.24 };
    this.ambience = 'flight';
    this.state = this.initialState();
    this.running = false;
    this.applyRegion(this.region);

    // input listeners (keyboard + on-screen pad + throttle)
    addEventListener('keydown', e => {
      if (this.lab?.stationKey !== 'flight' || ['INPUT', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
      if (e.code === 'Space') this.toggleRun();
      if (e.code === 'KeyC') this.toggleView();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    document.querySelectorAll('#touch [data-key]').forEach(b => {
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); this.touch[b.dataset.key] = true; });
      const up = () => (this.touch[b.dataset.key] = false);
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
    });
    $('throttle').addEventListener('input', e => { this.state.throttle = +e.target.value / 100; $('throttleVal').textContent = e.target.value + '%'; });
    $('region').innerHTML = Object.entries(REGIONS).map(([k, r]) => `<option value="${k}">${r.name}</option>`).join('');
    $('region').addEventListener('change', e => this.setRegion(e.target.value));
  }

  initialState() {
    return { x: 0, y: 2000 * FT, z: 2600, heading: 90, pitch: 0, bank: 0, speed: 95, vs: 0, throttle: 0.62, hold: 0, ringIndex: 0, stall: false };
  }

  // ------------------------------------------------------------------ cockpit interior
  buildCockpit(lab) {
    const M = materials(lab);
    const cp = this.cockpit = new THREE.Group();
    this.trainer.model.add(cp);
    const trim = new THREE.MeshStandardMaterial({ color: 0x4a4f52, roughness: 0.85 });
    const liner = new THREE.MeshStandardMaterial({ color: 0xbdb7aa, roughness: 0.9 });
    const leather = new THREE.MeshStandardMaterial({ color: 0x2c2b2a, roughness: 0.8 });
    for (const dir of [-1, 1]) {
      box(cp, [0.03, 0.72, 1.35], [dir * 0.56, 0.08, -0.45], trim);                    // door panel
      box(cp, [0.08, 0.05, 0.9], [dir * 0.53, 0.32, -0.45], leather);                  // armrest
      rod(cp, [dir * 0.5, 0.48, -1.12], [dir * 0.44, 0.99, -0.72], 0.025, M.paintPlain); // A-pillar
      rod(cp, [dir * 0.57, 0.44, 0.16], [dir * 0.49, 0.99, 0.16], 0.03, M.paintPlain);   // door post
      // seats
      box(cp, [0.44, 0.12, 0.46], [dir * 0.27, -0.26, -0.12], leather);
      const back = box(cp, [0.44, 0.65, 0.1], [dir * 0.27, 0.08, 0.17], leather); back.rotation.x = -0.18;
      // rudder pedals
      for (const s of [-1, 1]) box(cp, [0.08, 0.12, 0.03], [dir * 0.27 + s * 0.1, -0.33, -0.98], M.steel).rotation.x = 0.4;
    }
    box(cp, [1.1, 0.04, 1.4], [0, 0.99, -0.3], liner);   // headliner
    box(cp, [1.1, 0.03, 1.5], [0, -0.36, -0.45], new THREE.MeshStandardMaterial({ color: 0x2a2d2f, roughness: 1 })); // floor
    box(cp, [1.06, 0.3, 0.04], [0, -0.2, -1.05], trim); // lower panel
    // instrument panel face with live gauges
    this.panelCanvas = canvasTexture(1536, 512, null, { anisotropy: 8 });
    const face = mesh(new THREE.PlaneGeometry(1.04, 0.347), new THREE.MeshStandardMaterial({ map: this.panelCanvas.texture, roughness: 0.55, metalness: 0.1, emissive: 0xffffff, emissiveMap: this.panelCanvas.texture, emissiveIntensity: 0.12 }), cp, { cast: false });
    face.position.set(0, 0.24, -1.035);
    box(cp, [1.08, 0.37, 0.06], [0, 0.24, -1.07], trim);
    const glare = mesh(roundedBox(1.08, 0.035, 0.12, 0.015, 2), leather, cp); glare.position.set(0, 0.43, -1.02);
    // magnetic compass on the glareshield
    sphere(cp, [0.03, 0.026, 0.03], [0, 0.47, -1.0], new THREE.MeshPhysicalMaterial({ color: 0x223, roughness: 0.1, transmission: 0, clearcoat: 1 }), 14);
    // yokes
    this.yokes = [];
    for (const dir of [-1, 1]) {
      const y = new THREE.Group(); y.position.set(dir * 0.27, 0.1, -0.98); cp.add(y);
      rod(y, [0, 0, 0], [0, 0, 0.2], 0.014, M.steel);
      const hub = new THREE.Group(); hub.position.z = 0.2; y.add(hub);
      box(hub, [0.07, 0.05, 0.04], [0, 0, 0], M.plastic);
      for (const s of [-1, 1]) { const h = mesh(roundedBox(0.035, 0.13, 0.035, 0.012, 2), M.plastic, hub); h.position.set(s * 0.12, 0.03, 0); box(hub, [0.12, 0.03, 0.03], [s * 0.06, -0.02, 0], M.plastic); }
      this.yokes.push(y);
    }
    // throttle and mixture
    this.throttleKnob = new THREE.Group(); this.throttleKnob.position.set(0.0, 0.1, -1.0); cp.add(this.throttleKnob);
    rod(this.throttleKnob, [0, 0, 0], [0, 0, 0.1], 0.006, M.steel);
    sphere(this.throttleKnob, [0.022, 0.022, 0.018], [0, 0, 0.11], new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }), 12);
    rod(cp, [0.06, 0.1, -1.0], [0.06, 0.1, -0.93], 0.006, M.steel);
    sphere(cp, [0.02, 0.02, 0.016], [0.06, 0.1, -0.92], new THREE.MeshStandardMaterial({ color: 0xb01c1c, roughness: 0.4 }), 12);
    // a reference string on the windscreen? keep the view clean. Add a small placard instead.
    const plac = canvasTexture(256, 64, c => { c.fillStyle = '#1b1f22'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#e8e2cf'; c.font = '600 20px system-ui'; c.fillText('TEACHING SIMULATOR · NOT FOR', 8, 26); c.fillText('REAL-WORLD FLIGHT PROCEDURES', 8, 52); }).texture;
    mesh(new THREE.PlaneGeometry(0.16, 0.04), new THREE.MeshBasicMaterial({ map: plac }), cp, { cast: false }).position.set(0.32, 0.075, -1.03);
    // ---- interior tub so the outside is only seen through the glazing
    const tub = new THREE.MeshStandardMaterial({ color: 0x3a3f42, roughness: 0.9 });
    box(cp, [1.1, 0.8, 0.04], [0, -0.02, -1.12], tub);
    box(cp, [1.1, 0.12, 0.08], [0, 0.03, -1.07], tub);
    box(cp, [1.12, 1.4, 0.04], [0, 0.3, 1.02], tub);
    for (const dir of [-1, 1]) box(cp, [0.03, 0.6, 0.85], [dir * 0.55, 0.1, 0.62], tub);
    // ---- extra cockpit detail: switch row, breakers, vents, visors, trim wheel, fuel selector, headset
    const swPlate = box(cp, [0.62, 0.05, 0.015], [-0.18, 0.045, -1.03], new THREE.MeshStandardMaterial({ color: 0x1c2024, roughness: 0.6 }));
    swPlate.castShadow = false;
    for (let i = 0; i < 9; i++) {
      const sw = box(cp, [0.018, 0.028, 0.02], [-0.45 + i * 0.065, 0.045, -1.018], i < 2 ? M.red : new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.4 }));
      sw.rotation.x = (i % 3 ? -0.35 : 0.35);
    }
    const cb = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.012, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: 0.5, roughness: 0.4 }), 24);
    const cbd = new THREE.Object3D();
    for (let i = 0; i < 24; i++) { cbd.position.set(0.3 + (i % 8) * 0.026, 0.03 + Math.floor(i / 8) * 0.026, -1.022); cbd.updateMatrix(); cb.setMatrixAt(i, cbd.matrix); }
    cp.add(cb);
    for (const dir of [-1, 1]) {
      const visor = new THREE.Group(); visor.position.set(dir * 0.27, 0.95, -0.78); visor.rotation.x = 0.35; cp.add(visor);
      box(visor, [0.36, 0.14, 0.01], [0, -0.07, 0], new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.3, transparent: true, opacity: 0.85 }));
      sphere(cp, [0.025, 0.025, 0.025], [dir * 0.45, 0.93, -0.55], M.steel, 12); // eyeball vents
      box(cp, [0.03, 0.02, 0.1], [dir * 0.55, 0.12, -0.2], M.steel); // door handle
    }
    cyl(cp, 0.06, 0.06, 0.02, [0, -0.05, -0.62], new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 }), [0, 0, Math.PI / 2], 24); // trim wheel
    const fuelSel = new THREE.Group(); fuelSel.position.set(0, -0.32, -0.5); cp.add(fuelSel);
    cyl(fuelSel, 0.06, 0.06, 0.01, [0, 0, 0], new THREE.MeshStandardMaterial({ color: 0xc9c3b0, roughness: 0.6 }), null, 24);
    box(fuelSel, [0.02, 0.025, 0.1], [0, 0.015, 0], M.red);
    const hs = new THREE.Group(); hs.position.set(0.53, 0.55, 0.05); cp.add(hs); // spare headset on the door post
    mesh(new THREE.TorusGeometry(0.08, 0.01, 8, 24, Math.PI), M.plastic, hs).rotation.y = Math.PI / 2;
    for (const z of [-0.08, 0.08]) sphere(hs, [0.02, 0.045, 0.04], [0, -0.01, z], new THREE.MeshStandardMaterial({ color: 0x25292c, roughness: 0.6 }), 12);
    // gloved hands on the pilot's yoke (hidden in VR, where you see your own controllers)
    const glove = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.62, metalness: 0.02 });
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x2b3640, roughness: 0.85 });
    this.hands = [];
    const hub = this.yokes[0].children[1];
    for (const s of [-1, 1]) {
      const h = new THREE.Group(); h.position.set(s * 0.12, 0.03, 0); hub.add(h); this.hands.push(h);
      mesh(roundedBox(0.03, 0.085, 0.05, 0.014, 2), glove, h).position.set(s * 0.028, 0, 0.012); // palm/back
      for (let f = 0; f < 4; f++) { const fg = mesh(new THREE.CapsuleGeometry(0.0095, 0.03, 3, 8), glove, h); fg.rotation.z = Math.PI / 2; fg.position.set(-s * 0.002, 0.03 - f * 0.02, -0.026); }
      const th = mesh(new THREE.CapsuleGeometry(0.01, 0.035, 3, 8), glove, h); th.position.set(-s * 0.012, 0.05, 0.012); th.rotation.set(0.5, 0, s * 0.9);
      const cuff = mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.05, 14), glove, h); cuff.position.set(s * 0.035, -0.045, 0.04); cuff.rotation.x = 0.9;
    }
    this.cockpit.visible = false;
  }

  drawPanel() {
    const c = this.panelCanvas.ctx, s = this.state;
    const W = 1536, H = 512;
    c.fillStyle = '#25292c'; c.fillRect(0, 0, W, H);
    // subtle panel texture
    c.fillStyle = 'rgba(255,255,255,.025)'; for (let i = 0; i < 40; i++) c.fillRect((i * 97) % W, (i * 53) % H, 60, 1);
    const R = 92;
    const bezel = (x, y) => {
      c.fillStyle = '#0f1214'; c.beginPath(); c.arc(x, y, R + 12, 0, 7); c.fill();
      c.fillStyle = '#121619'; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { c.fillStyle = '#3a4045'; c.beginPath(); c.arc(x + dx * (R + 4), y + dy * (R + 4), 5, 0, 7); c.fill(); }
    };
    const ticks = (x, y, a0, a1, n, major, labels, r0 = R - 4) => {
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * i / n, maj = i % major === 0;
        c.strokeStyle = '#e9e8de'; c.lineWidth = maj ? 3 : 1.5;
        c.beginPath(); c.moveTo(x + Math.sin(a) * r0, y - Math.cos(a) * r0); c.lineTo(x + Math.sin(a) * (r0 - (maj ? 14 : 8)), y - Math.cos(a) * (r0 - (maj ? 14 : 8))); c.stroke();
        if (maj && labels) { c.fillStyle = '#e9e8de'; c.font = '600 17px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(labels(i / n), x + Math.sin(a) * (r0 - 32), y - Math.cos(a) * (r0 - 32)); }
      }
    };
    const needle = (x, y, a, len, w = 5, col = '#f1efe6') => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(-w, 10); c.lineTo(0, -len); c.lineTo(w, 10); c.closePath(); c.fill(); c.restore(); c.fillStyle = '#2b2f33'; c.beginPath(); c.arc(x, y, 8, 0, 7); c.fill(); };
    const label = (x, y, t) => { c.fillStyle = '#c9c9bd'; c.font = '600 13px system-ui'; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(t, x, y); };
    const cols = [150, 390, 630], rows = [128, 382];
    // 1 airspeed
    let [x, y] = [cols[0], rows[0]];
    bezel(x, y);
    const asA = v => -2.6 + THREE.MathUtils.clamp(v, 0, 180) / 180 * 5.2;
    c.lineWidth = 9;
    for (const [v0, v1, col] of [[48, 85, '#2f9b4d'], [85, 128, '#2f9b4d'], [128, 160, '#e3c13a']]) { c.strokeStyle = col; c.beginPath(); c.arc(x, y, R - 8, asA(v0) - Math.PI / 2, asA(v1) - Math.PI / 2); c.stroke(); }
    c.strokeStyle = '#d23a2a'; c.lineWidth = 5; c.beginPath(); c.moveTo(x + Math.sin(asA(160)) * (R - 2), y - Math.cos(asA(160)) * (R - 2)); c.lineTo(x + Math.sin(asA(160)) * (R - 20), y - Math.cos(asA(160)) * (R - 20)); c.stroke();
    ticks(x, y, asA(0), asA(180), 36, 4, t => Math.round(t * 180 / 20) * 20 || '');
    label(x, y + 34, 'AIRSPEED'); label(x, y + 50, 'KNOTS · GAME');
    needle(x, y, asA(s.speed), 74);
    // 2 attitude
    [x, y] = [cols[1], rows[0]];
    bezel(x, y);
    c.save(); c.beginPath(); c.arc(x, y, R - 2, 0, 7); c.clip();
    c.translate(x, y); c.rotate(-s.bank * Math.PI / 180);
    const py = s.pitch * 3.2;
    c.fillStyle = '#3f86c4'; c.fillRect(-200, -260 + py, 400, 260);
    c.fillStyle = '#8a5a2b'; c.fillRect(-200, py, 400, 260);
    c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(-200, py); c.lineTo(200, py); c.stroke();
    for (let p = -20; p <= 20; p += 5) { if (!p) continue; const yy = py - p * 3.2; c.lineWidth = 1.6; c.beginPath(); c.moveTo(p % 10 ? -12 : -26, yy); c.lineTo(p % 10 ? 12 : 26, yy); c.stroke(); }
    c.restore();
    // bank scale + pointer
    for (const b of [-60, -30, -20, -10, 0, 10, 20, 30, 60]) { const a = b * Math.PI / 180; c.strokeStyle = '#fff'; c.lineWidth = b % 30 ? 2 : 3; c.beginPath(); c.moveTo(x + Math.sin(a) * (R - 4), y - Math.cos(a) * (R - 4)); c.lineTo(x + Math.sin(a) * (R - (b % 30 ? 12 : 18)), y - Math.cos(a) * (R - (b % 30 ? 12 : 18))); c.stroke(); }
    c.save(); c.translate(x, y); c.rotate(-s.bank * Math.PI / 180); c.fillStyle = '#f0a020'; c.beginPath(); c.moveTo(0, -R + 6); c.lineTo(-7, -R + 18); c.lineTo(7, -R + 18); c.fill(); c.restore();
    c.strokeStyle = '#f0a020'; c.lineWidth = 5; c.beginPath(); c.moveTo(x - 52, y); c.lineTo(x - 18, y); c.lineTo(x, y + 10); c.lineTo(x + 18, y); c.lineTo(x + 52, y); c.stroke();
    c.fillStyle = '#f0a020'; c.beginPath(); c.arc(x, y, 4, 0, 7); c.fill();
    // 3 altimeter
    [x, y] = [cols[2], rows[0]];
    bezel(x, y);
    ticks(x, y, 0, Math.PI * 2 - 0.0001, 50, 5, t => (Math.round(t * 10) % 10));
    c.fillStyle = '#0a0c0d'; c.fillRect(x + 22, y - 9, 46, 18); c.fillStyle = '#e9e8de'; c.font = '600 13px ui-monospace,monospace'; c.textAlign = 'center'; c.fillText('29.92', x + 45, y + 5);
    label(x, y + 40, 'ALT · FT · GAME');
    const altFt = s.y / FT;
    needle(x, y, (altFt % 10000) / 10000 * Math.PI * 2, 46, 7, '#d8d7cc');
    needle(x, y, (altFt % 1000) / 1000 * Math.PI * 2, 78, 4);
    // 4 turn coordinator
    [x, y] = [cols[0], rows[1]];
    bezel(x, y);
    label(x, y - 46, 'TURN COORDINATOR'); label(x, y + 70, '2 MIN · GAME');
    for (const a of [-0.32, 0.32]) { c.strokeStyle = '#fff'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + Math.cos(a) * 70 * Math.sign(a), y + Math.abs(Math.sin(a)) * 70); c.lineTo(x + Math.cos(a) * 86 * Math.sign(a), y + Math.abs(Math.sin(a)) * 86); c.stroke(); }
    const rate = s.turnRate || 0;
    c.save(); c.translate(x, y); c.rotate(THREE.MathUtils.clamp(rate / 3, -1.4, 1.4) * 0.32); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.moveTo(-62, 0); c.lineTo(62, 0); c.stroke(); c.beginPath(); c.arc(0, 0, 9, 0, 7); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 4; c.beginPath(); c.moveTo(0, -4); c.lineTo(0, -22); c.stroke(); c.restore();
    c.fillStyle = '#0b0d0e'; c.beginPath(); c.roundRect(x - 40, y + 26, 80, 22, 11); c.fill();
    c.fillStyle = '#111'; c.strokeStyle = '#ddd'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y + 37, 9, 0, 7); c.fill(); c.stroke();
    // 5 heading indicator
    [x, y] = [cols[1], rows[1]];
    bezel(x, y);
    c.save(); c.translate(x, y); c.rotate(-s.heading * Math.PI / 180);
    for (let h = 0; h < 360; h += 5) { c.save(); c.rotate(h * Math.PI / 180); c.strokeStyle = '#eee'; c.lineWidth = h % 10 ? 1.5 : 2.5; c.beginPath(); c.moveTo(0, -R + 6); c.lineTo(0, -R + (h % 10 ? 14 : 20)); c.stroke(); if (h % 30 === 0) { c.fillStyle = '#eee'; c.font = '700 19px system-ui'; c.textAlign = 'center'; c.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[h] || String(h / 10), 0, -R + 40); } c.restore(); }
    c.restore();
    c.strokeStyle = '#f0a020'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y - 30); c.lineTo(x, y + 26); c.moveTo(x - 24, y - 6); c.lineTo(x + 24, y - 6); c.moveTo(x - 10, y + 22); c.lineTo(x + 10, y + 22); c.stroke();
    c.fillStyle = '#f0a020'; c.beginPath(); c.moveTo(x, y - R + 2); c.lineTo(x - 7, y - R - 10); c.lineTo(x + 7, y - R - 10); c.fill();
    // 6 VSI
    [x, y] = [cols[2], rows[1]];
    bezel(x, y);
    const vsA = v => -Math.PI / 2 + THREE.MathUtils.clamp(v / 2000, -1, 1) * 2.6;
    ticks(x, y, vsA(-2000), vsA(2000), 40, 5, t => Math.abs(Math.round((t - 0.5) * 40 / 10) * 10 / 10 * 1) || 0);
    label(x, y + 36, 'VERTICAL SPEED'); label(x, y + 52, '×100 FT/MIN');
    c.fillStyle = '#e9e8de'; c.font = '600 12px system-ui'; c.fillText('UP', x - 40, y - 26); c.fillText('DN', x - 40, y + 34);
    needle(x, y, vsA(s.vs) + Math.PI / 2 - Math.PI / 2, 76);
    // right side: radio stack + engine gauges
    c.fillStyle = '#0d1012'; c.fillRect(820, 40, 330, 430);
    for (let i = 0; i < 4; i++) { c.fillStyle = '#16191b'; c.fillRect(832, 52 + i * 104, 306, 92); c.fillStyle = '#7fd6a8'; c.font = '600 26px ui-monospace,monospace'; c.textAlign = 'left'; c.fillText(['COM1 118.000', 'NAV1 110.50', 'XPDR 1200 ALT', 'GPS  — TRAINING —'][i], 846, 108 + i * 104); }
    // tach + fuel
    const tx = 1260, ty = 140;
    bezel(tx, ty);
    const rpm = 900 + s.throttle * 1800 + s.speed * 3;
    ticks(tx, ty, -2.3, 2.3, 35, 5, t => Math.round(t * 35));
    label(tx, ty + 40, 'RPM ×100'); needle(tx, ty, -2.3 + THREE.MathUtils.clamp(rpm / 3500, 0, 1) * 4.6, 74);
    c.fillStyle = '#121619'; c.fillRect(1180, 270, 300, 200);
    for (let i = 0; i < 4; i++) { const v = [0.72, 0.7, 0.55, 0.62][i]; c.fillStyle = '#e9e8de'; c.font = '600 14px system-ui'; c.textAlign = 'left'; c.fillText(['FUEL L', 'FUEL R', 'OIL T', 'OIL P'][i], 1192, 300 + i * 46); c.fillStyle = '#2b3135'; c.fillRect(1270, 288 + i * 46, 190, 14); c.fillStyle = '#4fbf6e'; c.fillRect(1270, 288 + i * 46, 190 * v, 14); }
    c.fillStyle = '#7f8a8f'; c.font = '600 13px system-ui'; c.textAlign = 'center';
    c.fillText('FIRST FLIGHT · CONCEPTUAL TEACHING PANEL · GAME VALUES, NOT AIRCRAFT DATA', W / 2, H - 12);
    if (s.stall) { c.fillStyle = '#d23a2a'; c.fillRect(840, 8, 280, 26); c.fillStyle = '#fff'; c.font = '700 18px system-ui'; c.fillText('STALL WARNING', 980, 27); }
    this.panelCanvas.texture.needsUpdate = true;
  }

  // ------------------------------------------------------------------ region switching
  setRegion(key) {
    if (!REGIONS[key]) return;
    this.region = key;
    try { localStorage.setItem('flight-world', key); } catch { /* ignore */ }
    this.applyRegion(key);
    this.lab && this.applyAtmosphere();
    this.resetFlight(false);
  }

  applyRegion(key) {
    const c = REGIONS[key];
    const pos = this.terrain.geometry.attributes.position, col = this.terrain.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = this.height(x, z, key);
      pos.setY(i, h);
      const v = 0.86 + noise2(x * 0.0021, z * 0.0021) * 0.14;
      col.setXYZ(i, v, v, v);
    }
    pos.needsUpdate = col.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
    this.terrain.geometry.computeBoundingSphere();
    const U = this.terrainUniforms;
    U.grassTint.value.setRGB(...c.grass); U.rockTint.value.setRGB(...c.rock); U.sandTint.value.setRGB(...c.sand);
    U.snowLine.value = c.snow; U.waterLevel.value = c.water; U.dryness.value = c.dry || 0; U.fieldAmount.value = c.fields ?? 0.9;
    this.water.visible = c.water > -9000;
    this.water.position.y = c.water;
    this.waterMat.color.set(c.waterColor);
    if (this.waterR) { this.waterR.position.y = c.water; this.waterR.material.uniforms.waterColor.value.set(c.waterColor).multiplyScalar(1.05); }
    // trees
    const r = rand(1234), d = new THREE.Object3D();
    const place = (inst, count, broad) => {
      let n = 0, tries = 0;
      while (n < count && tries < count * 8) {
        tries++;
        const x = (r() - 0.5) * 26000, z = -7000 + (r() - 0.5) * 30000;
        if (Math.abs(x) < 320 && z > -4300 && z < 2500) continue;
        const h = this.height(x, z, key);
        if (h < c.water + 4 || h > Math.min(c.snow - 250, key === 'canyon' ? 900 : 1500)) continue;
        const sl = Math.abs(this.height(x + 30, z, key) - h) + Math.abs(this.height(x, z + 30, key) - h);
        if (sl > 22) continue;
        if (r() > c.trees * (broad ? 0.6 : 1)) continue;
        // clump: place several trees around this point
        const clump = quality().trees > 1.2 ? 11 : 6, spread = quality().trees > 1.2 ? 190 : 140;
        for (let k = 0; k < clump && n < count; k++) {
          const tx = x + (r() - 0.5) * spread, tz = z + (r() - 0.5) * spread, th = this.height(tx, tz, key);
          if (th < c.water + 3) continue;
          const s = (broad ? 9 : 11) + r() * 10;
          d.position.set(tx, th - 0.5, tz); d.rotation.set(0, r() * 6.28, 0); d.scale.set(s * (0.8 + r() * 0.3), s * (broad ? 1 : 1.6 + r() * 0.6), s * (0.8 + r() * 0.3));
          d.updateMatrix(); inst.setMatrixAt(n, d.matrix);
          inst.setColorAt(n, new THREE.Color().setHSL(0.24 + r() * 0.1, 0.3 + r() * 0.18, (broad ? 0.36 : 0.3) + r() * 0.16));
          n++;
        }
      }
      for (let i = n; i < count; i++) { d.position.set(0, -9999, 0); d.scale.setScalar(0.001); d.updateMatrix(); inst.setMatrixAt(i, d.matrix); }
      inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      inst.computeBoundingSphere();
    };
    place(this.conifers, this.conifers.count, false);
    place(this.broadleaf, this.broadleaf.count, true);
    // villages near the valley floor
    const vr = rand(99);
    let hn = 0;
    const towns = key === 'islands' ? [[400, -400], [-2600, -6800], [2900, -9500]] : [[1500, -5200], [-1400, -9000], [700, 900], [-900, -13500]];
    const wallCols = [0xe9e2d3, 0xd8cbb4, 0xf2efe8, 0xc9b9a0], roofCols = key === 'canyon' ? [0xa0573a, 0xb8754e] : [0x7a3b2e, 0x4b4f55, 0x8a4a2f, 0x5b3a2a];
    for (const [tx, tz] of towns) {
      for (let k = 0; k < 200 && hn < this.houses.count; k++) {
        const a = vr() * 6.28, rr = Math.sqrt(vr()) * 450;
        const x = tx + Math.cos(a) * rr, z = tz + Math.sin(a) * rr, h = this.height(x, z, key);
        if (h < c.water + 3 || Math.abs(this.height(x + 15, z, key) - h) > 6 || (Math.abs(x) < 300 && z > -4300 && z < 2500)) continue;
        const w = 8 + vr() * 8, dd = 10 + vr() * 10, hh = 5 + vr() * 4;
        d.position.set(x, h - 0.3, z); d.rotation.set(0, Math.round(vr() * 4) * Math.PI / 2 + (vr() - 0.5) * 0.2, 0); d.scale.set(w, hh, dd); d.updateMatrix();
        this.houses.setMatrixAt(hn, d.matrix); this.houses.setColorAt(hn, new THREE.Color(wallCols[Math.floor(vr() * 4)]));
        d.scale.set(w * 1.05, hh * 0.9, dd * 0.75); d.updateMatrix();
        this.roofs.setMatrixAt(hn, d.matrix); this.roofs.setColorAt(hn, new THREE.Color(roofCols[Math.floor(vr() * roofCols.length)]));
        hn++;
      }
    }
    for (let i = hn; i < this.houses.count; i++) { d.position.set(0, -9999, 0); d.scale.setScalar(0.001); d.updateMatrix(); this.houses.setMatrixAt(i, d.matrix); this.roofs.setMatrixAt(i, d.matrix); }
    for (const m of [this.houses, this.roofs]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
    // clouds
    this.clouds.children.forEach(s => {
      const b = s.userData.base;
      s.visible = s.userData.k < c.clouds;
      s.position.set(b.x, c.cloudBase + b.y, b.z);
    });
    this.cloudMats.forEach(m => m.color.set(key === 'twilight' ? 0xd9a898 : key === 'highlands' ? 0xc9cfd3 : 0xffffff).multiplyScalar(key === 'twilight' ? 1.0 : 1.45));
    // rings sit above the local terrain
    this.rings.forEach((ring, i) => { const [x, y, z] = RINGS[i]; ring.position.set(x, Math.max(y, this.height(x, z, key) + 180), z); });
    if ($('region')) $('region').value = key;
  }

  async applyAtmosphere() {
    const c = REGIONS[this.region];
    await this.lab.setAtmosphere({ env: c.env, azimuth: c.az, elevation: c.el, turbidity: c.turb, rayleigh: c.ray, exposure: c.exposure, envIntensity: 0.85, sunIntensity: c.el < 8 ? 1.6 : 3.2, sunColor: c.sunColor, hemi: c.el < 8 ? 0.35 : 0.25, fog: c.fog });
  }

  // ------------------------------------------------------------------ station lifecycle
  async enter(lab, opts = {}) {
    this.lab = lab;
    if (opts.sub && REGIONS[opts.sub]) this.setRegion(opts.sub);
    await this.applyAtmosphere();
    lab.camera.near = 0.08; lab.camera.far = 60000; lab.camera.updateProjectionMatrix();
    lab.sun.shadow.camera.left = -6; lab.sun.shadow.camera.right = 6; lab.sun.shadow.camera.top = 6; lab.sun.shadow.camera.bottom = -6; lab.sun.shadow.camera.near = 1; lab.sun.shadow.camera.far = 60; lab.sun.shadow.camera.updateProjectionMatrix();
    lab.shadowFollow = () => this.plane.position;
    lab.floors = [];
    $('region').hidden = false; $('hud').hidden = false; $('touch').hidden = false;
    $('region').value = this.region;
    this.setView(this.view);
    this.panel();
    lab.ui.setHint('Arrow keys: pitch & bank · +/− or Page Up/Down: power · Space: start/pause · C: change view · Gamepad supported');
    this.drawPanel();
  }

  exit(lab) {
    this.running = false;
    $('region').hidden = true; $('hud').hidden = true; $('touch').hidden = true;
    lab.camera.near = 0.05; lab.camera.updateProjectionMatrix();
    lab.shadowFollow = null;
    lab.rig.position.set(0, 0, 0); lab.rig.quaternion.identity();
    if (this.audio) this.audio.gain.gain.setTargetAtTime(0, this.audio.ctx.currentTime, 0.1);
    lab.ui.setHint('');
  }

  setView(v) {
    this.view = v;
    const lab = this.lab;
    if (v === 'cockpit') { lab.controls.setCockpit({ fov: 68, limits: [2.2, 1.0] }); this.cockpit.visible = true; }
    else { lab.controls.setCockpit({ fov: 55, limits: [3.1, 0.7] }); this.cockpit.visible = false; this.chasePos = null; }
  }

  toggleView() { this.setView(this.view === 'cockpit' ? 'chase' : 'cockpit'); this.panel(); }

  toggleRun() {
    this.running = !this.running;
    if (this.running) this.startAudio();
    if (this.audio) this.audio.gain.gain.setTargetAtTime(this.running && this.sound ? 0.06 : 0, this.audio.ctx.currentTime, 0.2);
    this.panel();
  }

  resetFlight(keepRunning = false) {
    this.state = this.initialState();
    if (this.mission === 3) { this.state.heading = 92; }
    $('throttle').value = 62; $('throttleVal').textContent = '62%';
    this.running = keepRunning && this.running;
    this.rings?.forEach((r, i) => (r.material.emissiveIntensity = i === 0 ? 1.4 : 0.3));
    if (this.lab) this.panel();
  }

  startAudio() {
    if (this.audio || !this.sound) return;
    const A = this.lab.audio;
    A.unlock();
    if (!A.ctx) return;
    try {
      const ctx = A.ctx;
      const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 70;
      const osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 35;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 380;
      const wash = ctx.createBufferSource(); wash.buffer = A.noise; wash.loop = true;
      const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 180; wf.Q.value = 0.8;
      const wg = ctx.createGain(); wg.gain.value = 0.9;
      const gain = ctx.createGain(); gain.gain.value = 0;
      osc.connect(filter); osc2.connect(filter); wash.connect(wf).connect(wg).connect(filter);
      filter.connect(gain).connect(A.master);
      osc.start(); osc2.start(); wash.start();
      this.audio = { ctx, osc, osc2, gain, filter };
    } catch { /* audio unavailable */ }
  }

  panel() {
    const lab = this.lab;
    const m = MISSIONS[this.mission];
    const done = lab.progress.missions;
    lab.ui.setPanel({
      tag: `05 · Flight practice · ${REGIONS[this.region].name}`,
      title: m.title,
      html: `<p>${m.brief}</p><p class="src">Small, patient corrections work best. Pitch and power work together; bank turns the airplane. This simplified model omits wind, rudder, trim forces, real stall behaviour and aircraft-specific performance.</p>`,
      vrText: m.brief + ' Left stick flies, right stick sets power, A starts or pauses the flight and B recenters your seat.',
      buttons: [
        { label: this.running ? 'Pause flight' : 'Start flight', primary: true, onClick: () => this.toggleRun() },
        { label: 'Reset', onClick: () => this.resetFlight() },
        ...MISSIONS.map((x, i) => ({ label: `${i + 1}. ${x.title}${done.includes(i) ? ' ✓' : ''}`, on: i === this.mission, onClick: () => { this.mission = i; this.resetFlight(); } })),
        { label: this.view === 'cockpit' ? 'Outside view' : 'Cockpit view', onClick: () => this.toggleView() },
        { label: this.sound ? 'Engine sound off' : 'Engine sound on', onClick: () => { this.sound = !this.sound; if (this.sound) { this.startAudio(); } if (this.audio) this.audio.gain.gain.setTargetAtTime(this.sound && this.running ? 0.05 : 0, this.audio.ctx.currentTime, 0.2); this.panel(); } },
        ...(lab.renderer.xr.isPresenting ? [{ label: 'Recenter seat', onClick: () => (this.recenter = true) }] : []),
      ],
      progress: { value: done.filter(i => i < 4).length, max: 4, label: `${done.filter(i => i < 4).length} of 4 flight missions earned` },
      foot: 'Educational exploration only. No flight-training credit. Learn real procedures with a qualified instructor and your aircraft’s approved handbook.',
    });
  }

  /** Planar-reflection water (three.js Water) used on Ultra. */
  makeReflectiveWater(SIZE) {
    const normals = this.waterNormal.clone(); normals.repeat.set(1, 1); normals.wrapS = normals.wrapT = THREE.RepeatWrapping; normals.needsUpdate = true;
    const w = new Water(new THREE.PlaneGeometry(SIZE * 1.6, SIZE * 1.6), {
      textureWidth: 1024, textureHeight: 1024, waterNormals: normals,
      sunDirection: new THREE.Vector3(0.3, 0.6, -0.4), sunColor: 0xfff1df, waterColor: 0x0f3440,
      distortionScale: 2.6, alpha: 1.0, fog: true, size: 0.35,
    });
    // keep the lake colour: tint and soften the mirrored sky so water doesn't read as white at grazing angles
    w.material.fragmentShader = w.material.fragmentShader
      .replace('( vec3( 0.1 ) + reflectionSample * 0.9 + reflectionSample * specularLight )', '( waterColor * 1.15 + reflectionSample * waterColor * 2.2 * vec3( 0.75, 0.95, 1.15 ) + reflectionSample * specularLight )')
      .replace(/float reflectance = ([^;]+);/, 'float reflectance = ( $1 ) * 0.6;');
    w.rotation.x = -Math.PI / 2;
    w.position.set(0, -18, -7000);
    w.receiveShadow = false;
    w.visible = false;
    this.root.add(w);
    this.waterR = w;
  }

  /** Quality changed in the settings while flying. */
  applyQuality(q) {
    if (!this.terrainMat) return;
    const want = !!q.terrainHQ, has = 'TERRAIN_HQ' in (this.terrainMat.defines || {});
    if (want !== has) { this.terrainMat.defines = want ? { TERRAIN_HQ: '' } : {}; this.terrainMat.needsUpdate = true; }
    this.conifers.castShadow = this.broadleaf.castShadow = !!q.treeShadows;
    if (q.water === 'reflect' && !this.waterR) this.makeReflectiveWater(40000);
  }

  /** Conifers with layered boughs and broadleaf trees with a trunk and lumpy crown; vertex colours fake ambient occlusion. */
  treeGeometry(detailed) {
    const seg = detailed ? 11 : 8;
    const tint = (g, fn) => { const p = g.attributes.position, col = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) col.set(fn(p.getX(i), p.getY(i), p.getZ(i)), i * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g; };
    // conifer: trunk + 4 drooping tiers
    const parts = [tint(new THREE.CylinderGeometry(0.035, 0.06, 0.3, 6).translate(0, 0.15, 0), () => [0.3, 0.2, 0.13])];
    const tiers = detailed ? 5 : 4;
    for (let k = 0; k < tiers; k++) {
      const f = k / (tiers - 1), r = 0.72 - f * 0.48, y0 = 0.16 + f * 0.62, h = 0.42 - f * 0.12;
      const g = new THREE.ConeGeometry(r, h, seg, 2, true).translate(0, y0 + h / 2, 0);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y < y0 + 0.02) p.setY(i, y - 0.05 * Math.sin(i * 1.7) ** 2); const j = 1 + 0.08 * Math.sin(i * 12.9898); p.setX(i, p.getX(i) * j); p.setZ(i, p.getZ(i) * j); }
      g.computeVertexNormals();
      parts.push(tint(g, (x, y) => { const t = (y - y0) / h; const ao = 0.62 + t * 0.38 + f * 0.1; return [0.12 * ao, 0.27 * ao, 0.16 * ao]; }));
    }
    const conGeo = mergeGeometries(parts.map(g => g.toNonIndexed()));
    // broadleaf: trunk + 3 overlapping lumpy blobs
    const bparts = [tint(new THREE.CylinderGeometry(0.04, 0.07, 0.45, 6).translate(0, 0.22, 0), () => [0.32, 0.23, 0.15])];
    const blobs = detailed ? [[0, 0.78, 0, 0.42], [0.2, 0.62, 0.1, 0.32], [-0.18, 0.66, -0.12, 0.33], [0.05, 0.95, 0.08, 0.28]] : [[0, 0.75, 0, 0.45], [0.18, 0.62, 0.08, 0.33], [-0.16, 0.64, -0.1, 0.34]];
    blobs.forEach(([bx, by, bz, br], bi) => {
      const g = new THREE.IcosahedronGeometry(br, detailed ? 2 : 1);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)); const n = 1 + 0.16 * Math.sin(v.x * 23 + bi) * Math.cos(v.y * 19 - v.z * 17); v.multiplyScalar(n); p.setXYZ(i, v.x, v.y * 0.85, v.z); }
      g.translate(bx, by, bz); g.computeVertexNormals();
      bparts.push(tint(g, (x, y) => { const ao = 0.55 + Math.min(1, (y - 0.35) / 0.7) * 0.45; return [0.2 * ao, 0.34 * ao, 0.14 * ao]; }));
    });
    const decGeo = mergeGeometries(bparts.map(g => g.toNonIndexed()));
    return { conGeo, decGeo };
  }

  xrSpawn() { return { position: this.plane.position.clone(), yaw: 0 }; }
  /** A starts or stops the engine; B recenters the seat. The trigger stays free for the menu. */
  xrButton(name) { if (name === 'a') this.toggleRun(); if (name === 'b') { this.recenter = true; this.lab.ui.toast('Seat recentered'); } }

  // ------------------------------------------------------------------ simulation
  readInput(dt) {
    const k = this.keys, t = this.touch;
    let roll = (k.has('ArrowRight') || t.ArrowRight ? 1 : 0) - (k.has('ArrowLeft') || t.ArrowLeft ? 1 : 0);
    let pitch = (k.has('ArrowDown') || t.ArrowDown ? 1 : 0) - (k.has('ArrowUp') || t.ArrowUp ? 1 : 0);
    let thr = (k.has('Equal') || k.has('NumpadAdd') || k.has('PageUp') ? 1 : 0) - (k.has('Minus') || k.has('NumpadSubtract') || k.has('PageDown') ? 1 : 0);
    // gamepad (desktop)
    const gp = navigator.getGamepads?.().find(g => g && g.connected && g.mapping === 'standard');
    if (gp) {
      if (Math.abs(gp.axes[0]) > 0.1) roll = gp.axes[0];
      if (Math.abs(gp.axes[1]) > 0.1) pitch = gp.axes[1];
      thr += (gp.buttons[7]?.value || 0) - (gp.buttons[6]?.value || 0);
      if (gp.buttons[0]?.pressed && !this.gpA) this.toggleRun();
      this.gpA = gp.buttons[0]?.pressed;
    }
    // XR controllers
    const lab = this.lab;
    if (lab.renderer.xr.isPresenting) {
      const a = lab.xr.axes;
      if (a.left.x || a.left.y) { roll = a.left.x; pitch = a.left.y; }
      if (a.right.y) thr = -a.right.y;
    }
    if (thr) {
      this.state.throttle = THREE.MathUtils.clamp(this.state.throttle + thr * dt * 0.35, 0, 1);
      const v = Math.round(this.state.throttle * 100); $('throttle').value = v; $('throttleVal').textContent = v + '%';
    }
    if (this.lab.settings?.invertPitch) pitch = -pitch;
    return { roll: THREE.MathUtils.clamp(roll, -1, 1), pitch: THREE.MathUtils.clamp(pitch, -1, 1) };
  }

  step(dt) {
    const s = this.state, inp = this.readInput(dt);
    s.bank += inp.roll * 28 * dt;
    if (!inp.roll) s.bank *= Math.exp(-0.55 * dt);
    s.bank = THREE.MathUtils.clamp(s.bank, -45, 45);
    s.pitch += inp.pitch * 9 * dt;
    if (!inp.pitch) s.pitch *= Math.exp(-0.18 * dt);
    // stall: nose drops when too slow
    s.stall = s.speed < 50;
    if (s.stall) s.pitch -= 6 * dt;
    s.pitch = THREE.MathUtils.clamp(s.pitch, -15, 18);
    const target = 58 + s.throttle * 68 - s.pitch * 2.2 + Math.abs(s.bank) * -0.12;
    s.speed += (target - s.speed) * dt * 0.22;
    s.speed = THREE.MathUtils.clamp(s.speed, 40, 160);
    s.vs = s.speed * 101.27 * Math.sin(s.pitch * Math.PI / 180) * 0.85 + (s.throttle - 0.62) * 700 - (s.stall ? 600 : 0) - Math.abs(s.bank) * 4;
    s.turnRate = 1091 * Math.tan(s.bank * Math.PI / 180) / Math.max(40, s.speed); // deg/s
    s.heading = (s.heading + s.turnRate * dt + 360) % 360;
    const v = s.speed * 0.5144;
    const h = s.heading * Math.PI / 180;
    s.x += -Math.cos(h) * v * dt;
    s.z += -Math.sin(h) * v * dt;
    s.y += s.vs * FT / 60 * dt;
    // terrain awareness
    const ground = this.height(s.x, s.z) + 1;
    s.agl = s.y - Math.max(ground, REGIONS[this.region].water);
    if (s.agl < 0) {
      this.lab.ui.toast('Terrain contact: flight reset. Plan altitude and terrain clearance.', 'bad');
      this.resetFlight(true);
      return;
    }
    // keep within the world
    if (Math.abs(s.x) > 12500 || s.z < -21000 || s.z > 7500) {
      this.lab.ui.toast('Edge of the practice area: turning you back.', '');
      s.heading = (s.heading + 180) % 360;
      s.x = THREE.MathUtils.clamp(s.x, -12400, 12400); s.z = THREE.MathUtils.clamp(s.z, -20900, 7400);
    }
    this.missionCheck(dt);
  }

  missionCheck(dt) {
    const s = this.state, lab = this.lab;
    const alt = s.y / FT;
    const hd = tgt => Math.abs(((s.heading - tgt + 540) % 360) - 180);
    let good = false;
    if (this.mission === 0) good = Math.abs(alt - 2000) <= 100 && hd(90) <= 10 && Math.abs(s.bank) < 5;
    if (this.mission === 1) good = Math.abs(alt - 2500) <= 100 && Math.abs(s.bank) < 5;
    if (this.mission === 2) good = Math.abs(alt - 2000) <= 150 && hd(120) <= 10 && Math.abs(s.bank) < 5;
    if (this.mission <= 2) {
      s.hold = good ? Math.min(15, s.hold + dt) : 0;
      if (s.hold >= 15 && !this.earned) this.earn(this.mission);
      this.earned = s.hold >= 15;
      this.status = s.hold >= 15 ? '✓ Mission earned!' : good ? `On target · ${s.hold.toFixed(1)} / 15 s` : 'Adjust gently toward the targets';
      this.statusFrac = s.hold / 15;
    } else if (this.mission === 3) {
      const ring = this.rings[s.ringIndex];
      if (ring) {
        const d = ring.position.distanceTo(new THREE.Vector3(s.x, s.y, s.z));
        if (d < 62) {
          lab.ui.toast(`Ring ${s.ringIndex + 1} of ${RINGS.length}`, 'good');
          ring.material.emissiveIntensity = 0.15; ring.material.color.set(0x8fd6b0);
          s.ringIndex++;
          if (this.rings[s.ringIndex]) this.rings[s.ringIndex].material.emissiveIntensity = 1.4;
          if (s.ringIndex >= RINGS.length) this.earn(3);
        }
        this.status = s.ringIndex >= RINGS.length ? '✓ Valley tour complete!' : `Next ring ${s.ringIndex + 1} · ${(d / 1852).toFixed(1)} NM`;
        this.statusFrac = s.ringIndex / RINGS.length;
      }
    } else { this.status = 'Free flight'; this.statusFrac = 0; }
  }

  earn(i) {
    const lab = this.lab;
    const first = lab.mark('missions', i);
    lab.ui.toast(first ? 'Mission earned!' : 'Mission complete again', 'good');
    // keep the main site's progress (3 classic missions) in sync
    try {
      const p = JSON.parse(localStorage.getItem('firstflight') || '{}');
      p.missions ||= [];
      if (i <= 2 && !p.missions.includes(i)) { p.missions.push(i); localStorage.setItem('firstflight', JSON.stringify(p)); }
    } catch { /* ignore */ }
    this.panel();
  }

  update(dt, t, lab) {
    const s = this.state;
    if (this.running) this.step(dt);
    // place the airplane
    this.plane.position.set(s.x, s.y, s.z);
    this.plane.rotation.set(s.pitch * Math.PI / 180, (90 - s.heading) * Math.PI / 180, -s.bank * Math.PI / 180, 'YXZ');
    this.trainer.spinning = this.running;
    this.trainer.update(dt, t);
    // control animations
    const inp = { r: (this.keys.has('ArrowRight') || this.touch.ArrowRight ? 1 : 0) - (this.keys.has('ArrowLeft') || this.touch.ArrowLeft ? 1 : 0), p: (this.keys.has('ArrowDown') || this.touch.ArrowDown ? 1 : 0) - (this.keys.has('ArrowUp') || this.touch.ArrowUp ? 1 : 0) };
    if (lab.renderer.xr.isPresenting) { inp.r = lab.xr.axes.left.x; inp.p = lab.xr.axes.left.y; }
    this.yokes.forEach(y => { y.children[1].rotation.z = THREE.MathUtils.lerp(y.children[1].rotation.z, -inp.r * 0.6, 0.15); y.position.z = THREE.MathUtils.lerp(y.position.z, -0.98 + inp.p * 0.06, 0.15); });
    this.trainer.ailerons.forEach((a, i) => (a.rotation.x = inp.r * 0.3 * (i ? -1 : 1)));
    this.trainer.elevator.rotation.x = -inp.p * 0.3;
    this.throttleKnob.position.z = -1.0 + s.throttle * 0.07;
    // camera
    const q = this.plane.quaternion;
    const eyeWorld = this.eye.clone().applyQuaternion(q).add(this.plane.position);
    if (lab.renderer.xr.isPresenting) {
      // seated: put the floor of the play space under the pilot's eyes
      lab.rig.position.copy(eyeWorld).add(new THREE.Vector3(0, -1.15, 0).applyQuaternion(q));
      lab.rig.quaternion.copy(q);
      if (this.recenter) {
        this.recenter = false;
        const head = lab.renderer.xr.getCamera().position; // local to the rig
        lab.rig.position.sub(new THREE.Vector3(head.x, head.y - 1.15, head.z).applyQuaternion(q));
        this.seatOffset = new THREE.Vector3(head.x, head.y - 1.15, head.z);
      }
      if (this.seatOffset) lab.rig.position.sub(this.seatOffset.clone().applyQuaternion(q));
      this.cockpit.visible = true;
      this.yokes[0].children[1].children.forEach(c => { if (c.isGroup) c.visible = false; });
    } else if (this.view === 'cockpit') {
      this.yokes[0].children[1].children.forEach(c => { if (c.isGroup) c.visible = true; });
      lab.rig.position.set(0, 0, 0); lab.rig.quaternion.identity();
      lab.camera.position.copy(eyeWorld);
      const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(lab.controls.cockpit.pitch, lab.controls.cockpit.yaw, 0, 'YXZ'));
      lab.camera.quaternion.copy(q).multiply(look);
    } else {
      lab.rig.position.set(0, 0, 0); lab.rig.quaternion.identity();
      // chase camera behind and above, with drag-to-orbit
      const yawOff = lab.controls.cockpit.yaw * 1.5;
      const back = new THREE.Vector3(Math.sin(yawOff) * 14, 3.5 + lab.controls.cockpit.pitch * 6, Math.cos(yawOff) * 14);
      const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (90 - s.heading) * Math.PI / 180);
      const target = this.plane.position.clone().add(back.applyQuaternion(yawQ));
      if (!this.chasePos) this.chasePos = target.clone();
      this.chasePos.lerp(target, 1 - Math.exp(-dt * 4));
      lab.camera.position.copy(this.chasePos);
      lab.camera.lookAt(this.plane.position.x, this.plane.position.y + 1, this.plane.position.z);
    }
    // water + windsock + clouds
    this.waterNormal.offset.set(t * 0.004, t * 0.0025);
    if (this.waterR) {
      const show = REGIONS[this.region].water > -9000, reflect = quality().water === 'reflect' && !lab.renderer.xr.isPresenting;
      this.waterR.visible = show && reflect; this.water.visible = show && !reflect;
      const u = this.waterR.material.uniforms;
      u.time.value = t * 0.6; u.sunDirection.value.copy(lab.sunDir); u.sunColor.value.copy(lab.sun.color);
    }
    this.sock.rotation.y = Math.sin(t * 0.6) * 0.15;
    // audio pitch follows power
    if (this.audio && this.sound) { this.audio.osc.frequency.setTargetAtTime(55 + s.throttle * 55, this.audio.ctx.currentTime, 0.1); this.audio.osc2.frequency.setTargetAtTime(27 + s.throttle * 28, this.audio.ctx.currentTime, 0.1); }
    // instruments + HUD (10 Hz)
    this.hudTimer = (this.hudTimer || 0) - dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.drawPanel();
      const alt = Math.round(s.y / FT), warn = s.stall ? '<div class="warn">STALL WARNING · lower the nose, add power</div>' : (s.agl !== undefined && s.agl < 150 && this.running ? '<div class="warn">TERRAIN · climb or turn away</div>' : '');
      $('hud').innerHTML = `<div class="row"><div class="g"><small>AIRSPEED</small><b>${Math.round(s.speed)}</b> kt</div><div class="g"><small>ALTITUDE</small><b>${alt.toLocaleString()}</b> ft</div><div class="g"><small>HEADING</small><b>${String(Math.round(s.heading) % 360).padStart(3, '0')}°</b></div><div class="g"><small>VERT SPEED</small><b>${Math.round(s.vs / 10) * 10}</b></div></div>
<div class="m"><b>${MISSIONS[this.mission].title}</b> · ${this.running ? (this.status || '') : 'Paused: press Start or Space'}<div class="bar"><i style="width:${Math.round((this.statusFrac || 0) * 100)}%"></i></div>Power ${Math.round(s.throttle * 100)}% · Bank ${Math.round(s.bank)}°</div>${warn}`;
    }
  }
}
