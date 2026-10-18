// A generic, original high-wing piston training airplane with teachable systems.
import * as THREE from 'three';
import { body, loftWing, mesh, rod, tube, sphere, box, cyl, lathe, contactShadow } from '../util.js';
import { materials } from '../materials.js';
import { makeLivery } from './livery.js';

export const TRAINER_GROUND = 1.47; // model-space wheel bottom is at y = -1.47

export function buildTrainer(lab, { livery = 'navy', interior = true } = {}) {
  const M = materials(lab);
  const root = new THREE.Group();
  root.name = 'trainer';
  const model = new THREE.Group();
  model.position.y = TRAINER_GROUND;
  root.add(model);
  const skin = new THREE.Group();
  skin.name = 'skin';
  model.add(skin);
  const parts = {};
  const systems = { airframe: new THREE.Group(), engine: new THREE.Group(), fuel: new THREE.Group(), electrical: new THREE.Group() };
  Object.entries(systems).forEach(([k, g]) => { g.name = 'system-' + k; model.add(g); });

  // ---------------------------------------------------------------- fuselage with painted livery
  const profile = [[-3.12, 0.02, 0.02, 0.03], [-3.05, 0.36, 0.34, 0.03], [-2.7, 0.49, 0.48, 0.02], [-1.8, 0.55, 0.56, 0], [-1.1, 0.6, 0.63, 0.06], [0.2, 0.6, 0.66, 0.07], [0.85, 0.5, 0.54, 0.07], [1.5, 0.36, 0.39, 0.1], [2.4, 0.2, 0.24, 0.18], [3.35, 0.085, 0.13, 0.25], [3.8, 0.02, 0.05, 0.28]];
  const liveryTex = makeLivery({
    W: 1024, H: 2048, circumference: 3.6, length: 6.92,
    draw(ctx, api) {
      // grey belly fade and a navy/gold cheatline
      const g = ctx.createLinearGradient(0, 0, api.W * 0.2, 0);
      g.addColorStop(0, '#c9ccc9'); g.addColorStop(1, '#f2f1ec');
      ctx.fillStyle = g; ctx.fillRect(0, 0, api.W * 0.2, api.H); ctx.save(); ctx.translate(api.W, 0); ctx.scale(-1, 1); ctx.fillRect(0, 0, api.W * 0.2, api.H); ctx.restore();
      api.band(0.165, 0.215, 0.05, 1, '#163a57');
      api.band(0.218, 0.226, 0.12, 1, '#c9964f');
      for (const s of ['right', 'left']) {
        api.side(s, s === 'right' ? 0.29 : 0.71, 0.66, c => {
          c.fillStyle = '#163a57'; c.font = '700 0.2px system-ui, sans-serif'; c.textAlign = 'center';
          c.fillText('FIRST FLIGHT', 0, 0);
          c.fillStyle = '#c9964f'; c.font = '600 0.07px system-ui, sans-serif';
          c.fillText('STUDENT PILOT ACADEMY', 0, 0.11);
        });
      }
    },
  });
  const fuselageMat = M.paintPlain.clone();
  fuselageMat.map = liveryTex.texture;
  fuselageMat.name = 'enamel';
  parts.airframe = mesh(body(profile, { seg: 64, steps: 6 }), fuselageMat, skin);

  // ---------------------------------------------------------------- wings (high wing, slight taper and dihedral)
  const wingMat = M.paint.clone(); wingMat.name = 'enamel';
  const wingSections = (dir) => [0, 0.5, 0.85, 1].map(t => ({ x: dir * (0.3 + t * 5.3), y: 1.0 + t * 0.12, z: -0.82 + t * 0.12, chord: 1.6 - t * 0.38 * t, thickness: 0.13 - t * 0.02, twist: -t * 0.03 }));
  parts.wing = new THREE.Group(); skin.add(parts.wing);
  for (const dir of [-1, 1]) {
    const w = mesh(loftWing(wingSections(dir), { n: 40, camber: 0.035 }), wingMat, parts.wing);
    w.name = 'wing';
    // wing tip fairing and nav light
    sphere(parts.wing, [0.05, 0.08, 0.6], [dir * 5.62, 1.12, -0.12], wingMat, 16);
    const nav = sphere(parts.wing, [0.035, 0.03, 0.07], [dir * 5.66, 1.12, -0.62], new THREE.MeshStandardMaterial({ color: dir < 0 ? 0xff3b30 : 0x30d158, emissive: dir < 0 ? 0x7a0d08 : 0x0a5a24, roughness: 0.1 }), 12);
    nav.castShadow = false;
  }
  // centre section over the cabin
  box(skin, [0.95, 0.08, 1.5], [0, 1.03, -0.12], wingMat);

  // ---------------------------------------------------------------- tail
  const tailSections = (dir) => [0, 1].map(t => ({ x: dir * (0.05 + t * 1.65), y: 0.36, z: 2.55 + t * 0.12, chord: 0.95 - t * 0.25, thickness: 0.1 }));
  parts.tail = new THREE.Group(); skin.add(parts.tail);
  for (const dir of [-1, 1]) mesh(loftWing(tailSections(dir), { n: 24, camber: 0 }), wingMat, parts.tail);
  const finShape = new THREE.Shape();
  finShape.moveTo(2.35, 0.32); finShape.lineTo(2.98, 1.78); finShape.quadraticCurveTo(3.1, 1.95, 3.28, 1.86); finShape.lineTo(3.55, 0.34); finShape.closePath();
  const fin = mesh(new THREE.ExtrudeGeometry(finShape, { depth: 0.06, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.025, bevelThickness: 0.025 }), M.navy, parts.tail);
  fin.rotation.y = -Math.PI / 2; fin.position.x = 0.03;
  // dorsal fairing
  const dorsal = new THREE.Shape(); dorsal.moveTo(1.2, 0.5); dorsal.quadraticCurveTo(2.0, 0.55, 2.45, 0.4); dorsal.lineTo(2.45, 0.3); dorsal.lineTo(1.2, 0.42); dorsal.closePath();
  const dorsalM = mesh(new THREE.ExtrudeGeometry(dorsal, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), M.navy, parts.tail);
  dorsalM.rotation.y = -Math.PI / 2; dorsalM.position.x = 0.025;

  // ---------------------------------------------------------------- moving control surfaces (airframe system)
  const controlMat = M.paintPlain.clone(); controlMat.name = 'enamel';
  const ailerons = [];
  for (const dir of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(dir * 3.9, 1.06, 0.55); systems.airframe.add(pivot);
    const a = box(pivot, [1.9, 0.05, 0.3], [0, 0, 0.15], controlMat); a.name = 'aileron';
    ailerons.push(pivot);
    const flap = new THREE.Group(); flap.position.set(dir * 1.75, 1.02, 0.6); systems.airframe.add(flap);
    box(flap, [2.4, 0.05, 0.32], [0, 0, 0.16], controlMat);
  }
  const elevator = new THREE.Group(); elevator.position.set(0, 0.36, 3.33); systems.airframe.add(elevator);
  box(elevator, [3.2, 0.04, 0.3], [0, 0, 0.15], controlMat);
  const rudder = new THREE.Group(); rudder.position.set(0, 0.35, 3.52); systems.airframe.add(rudder);
  const rudShape = new THREE.Shape(); rudShape.moveTo(0, 0); rudShape.lineTo(0, 1.5); rudShape.lineTo(0.28, 1.4); rudShape.lineTo(0.42, 0.05); rudShape.closePath();
  const rud = mesh(new THREE.ExtrudeGeometry(rudShape, { depth: 0.05, bevelEnabled: false }), M.navy, rudder);
  rud.rotation.y = -Math.PI / 2; rud.position.x = 0.025;
  // control cables to the cabin
  for (const dir of [-1, 1]) tube(systems.airframe, [[dir * 0.35, 0.95, -0.4], [dir * 2, 1.03, 0.3], [dir * 3.9, 1.06, 0.55]], 0.008, M.steel);
  tube(systems.airframe, [[0, -0.15, -0.6], [0, -0.05, 1.2], [0, 0.25, 3.3]], 0.01, M.gold);

  // ---------------------------------------------------------------- struts, windows, doors
  for (const dir of [-1, 1]) {
    rod(skin, [dir * 0.5, -0.22, -0.2], [dir * 3.3, 1.0, -0.15], 0.035, M.paintPlain);
    rod(skin, [dir * 0.5, -0.22, 0.1], [dir * 3.3, 1.0, 0.3], 0.03, M.paintPlain);
    // side windows
    const win = new THREE.Shape(); win.moveTo(-1.02, 0.5); win.lineTo(-0.66, 0.96); win.lineTo(0.08, 0.98); win.lineTo(0.14, 0.46); win.closePath();
    const winR = new THREE.Shape(); winR.moveTo(0.24, 0.45); winR.lineTo(0.2, 0.97); winR.quadraticCurveTo(0.6, 0.9, 0.78, 0.45); winR.closePath();
    for (const s of [win, winR]) {
      const g = new THREE.ShapeGeometry(s);
      g.rotateY(-Math.PI / 2);
      const m = mesh(g, M.cockpitGlass, skin, { cast: false });
      m.position.x = dir * (s === win ? 0.585 : 0.56);
      m.renderOrder = 2;
    }
    // door seam + handle
    tube(skin, [[dir * 0.6, 0.0, -0.95], [dir * 0.605, 0.45, -1.0], [dir * 0.6, 0.47, 0.15], [dir * 0.6, -0.05, 0.15], [dir * 0.6, 0.0, -0.95]], 0.005, M.darkMetal);
    box(skin, [0.02, 0.03, 0.12], [dir * 0.61, 0.15, 0.05], M.aluminum);
    // step
    rod(skin, [dir * 0.5, -0.4, -0.1], [dir * 0.75, -0.75, -0.1], 0.015, M.steel);
    box(skin, [0.18, 0.02, 0.12], [dir * 0.78, -0.76, -0.1], M.darkMetal);
  }
  // windscreen
  const ws = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.52, 0.48, -1.15), new THREE.Vector3(0.52, 0.48, -1.15), new THREE.Vector3(0.44, 0.99, -0.7), new THREE.Vector3(-0.44, 0.99, -0.7)]);
  ws.setIndex([0, 1, 2, 0, 2, 3]); ws.computeVertexNormals();
  const windscreen = mesh(ws, M.cockpitGlass, skin, { cast: false });
  windscreen.renderOrder = 2;
  rod(skin, [0, 0.5, -1.15], [0, 0.98, -0.72], 0.012, M.paintPlain);

  // ---------------------------------------------------------------- cowling details, spinner, propeller
  for (const dir of [-1, 1]) {
    sphere(skin, [0.13, 0.07, 0.02], [dir * 0.22, 0.05, -3.06], M.plastic, 16); // inlets
    tube(skin, [[dir * 0.32, 0.3, -3.0], [dir * 0.47, 0.38, -2.6], [dir * 0.53, 0.34, -1.85]], 0.004, M.darkMetal);
    for (let z = -2.5; z < -1.85; z += 0.1) box(skin, [0.012, 0.024, 0.06], [dir * 0.52, -0.16, z], M.plastic);
  }
  rod(skin, [-0.08, -0.4, -2.0], [-0.08, -0.62, -2.15], 0.035, M.steel); // exhaust
  const spinner = mesh(lathe([[0, 0.32], [0.08, 0.3], [0.14, 0.22], [0.17, 0.08], [0.175, 0]], 32), M.aluminum, skin);
  spinner.rotation.x = -Math.PI / 2; spinner.position.set(0, 0.03, -3.12);
  const prop = new THREE.Group(); prop.position.set(0, 0.03, -3.16); skin.add(prop);
  for (const dir of [-1, 1]) {
    const bladeShape = new THREE.Shape(); bladeShape.moveTo(-0.05, 0); bladeShape.quadraticCurveTo(-0.11, 0.4, -0.07, 0.9); bladeShape.quadraticCurveTo(0, 0.97, 0.06, 0.9); bladeShape.quadraticCurveTo(0.1, 0.4, 0.05, 0); bladeShape.closePath();
    const bg = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.02, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
    const blade = mesh(bg, M.plastic, prop);
    blade.rotation.z = dir > 0 ? 0 : Math.PI;
    blade.rotation.y = 0.25 * dir;
    const tip = mesh(new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-0.07, 0.86); s.quadraticCurveTo(0, 0.97, 0.06, 0.88); s.lineTo(0.065, 0.8); s.lineTo(-0.075, 0.8); s.closePath(); return s; })(), { depth: 0.024, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 }), prop);
    tip.rotation.copy(blade.rotation);
    tip.position.z = -0.002;
  }
  const propDisc = mesh(new THREE.CircleGeometry(0.98, 48), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, depthWrite: false }), skin, { cast: false });
  propDisc.position.set(0, 0.03, -3.17);

  // ---------------------------------------------------------------- landing gear
  function wheel(x, y, z, r, w = 0.17) {
    const g = new THREE.Group(); g.position.set(x, y, z); skin.add(g);
    const tire = mesh(new THREE.TorusGeometry(r - 0.07, 0.085, 16, 40), M.rubber, g); tire.rotation.y = Math.PI / 2; tire.scale.z = w / 0.17;
    const hub = cyl(g, r * 0.55, r * 0.55, w * 0.9, [0, 0, 0], M.aluminum, [0, 0, Math.PI / 2], 24);
    hub.scale.y = 1;
    cyl(g, r * 0.18, r * 0.18, w * 1.05, [0, 0, 0], M.steel, [0, 0, Math.PI / 2], 16);
    // brake disc and caliper
    cyl(g, r * 0.5, r * 0.5, 0.012, [-w * 0.55, 0, 0], M.steel, [0, 0, Math.PI / 2], 24);
    box(g, [0.04, 0.07, 0.06], [-w * 0.6, r * 0.3, -r * 0.25], M.red);
    return g;
  }
  for (const dir of [-1, 1]) {
    tube(skin, [[dir * 0.42, -0.35, 0.3], [dir * 0.8, -0.85, 0.55], [dir * 1.05, -1.18, 0.62]], 0.045, M.steel, 10);
    wheel(dir * 1.08, -1.18, 0.62, 0.29);
  }
  rod(skin, [0, -0.3, -2.25], [0, -1.18, -2.45], 0.035, M.aluminum);
  rod(skin, [0, -0.6, -2.25], [0, -0.95, -2.42], 0.06, M.steel); // oleo
  wheel(0, -1.21, -2.45, 0.25, 0.14);

  // ---------------------------------------------------------------- antennas, beacon, pitot
  rod(skin, [0, 0.66, 0.6], [0.0, 0.95, 0.85], 0.008, M.plastic);
  rod(skin, [0, -0.5, 0.4], [0, -0.7, 0.55], 0.006, M.plastic);
  const beacon = sphere(skin, [0.04, 0.05, 0.06], [0, 1.95, 3.15], new THREE.MeshStandardMaterial({ color: 0xff3020, emissive: 0x550000, roughness: 0.2 }), 12);
  rod(skin, [-3.2, 0.95, -0.6], [-3.2, 0.95, -1.05], 0.012, M.aluminum); // pitot tube

  // ---------------------------------------------------------------- interior (seen through glass)
  if (interior) {
    for (const dir of [-1, 1]) {
      box(skin, [0.42, 0.12, 0.46], [dir * 0.26, -0.22, -0.15], M.leather);
      const back = box(skin, [0.42, 0.6, 0.1], [dir * 0.26, 0.1, 0.16], M.leather); back.rotation.x = -0.15;
      box(skin, [0.4, 0.1, 0.42], [dir * 0.26, -0.22, 0.65], M.leather);
      const back2 = box(skin, [0.4, 0.55, 0.1], [dir * 0.26, 0.08, 0.9], M.leather); back2.rotation.x = -0.12;
      // yokes
      rod(skin, [dir * 0.27, 0.2, -1.05], [dir * 0.27, 0.2, -0.82], 0.015, M.steel);
      box(skin, [0.26, 0.04, 0.04], [dir * 0.27, 0.2, -0.82], M.plastic);
    }
    box(skin, [1.0, 0.28, 0.12], [0, 0.32, -1.08], M.plastic); // panel
    box(skin, [1.04, 0.06, 0.2], [0, 0.48, -1.06], M.leather); // glareshield
  }

  // ---------------------------------------------------------------- ENGINE system: horizontally opposed four
  const engine = systems.engine; engine.position.set(0, 0.0, -2.62);
  const eng = new THREE.Group(); engine.add(eng);
  sphere(eng, [0.17, 0.21, 0.36], [0, 0, 0], M.brushed);
  box(eng, [0.26, 0.14, 0.48], [0, -0.23, 0], M.steel);
  const pistons = [];
  for (let i = 0; i < 4; i++) {
    const side = i % 2 ? 1 : -1, z = (Math.floor(i / 2) - 0.5) * 0.36 + side * 0.025;
    const barrel = cyl(eng, 0.12, 0.12, 0.33, [side * 0.33, 0, z], M.steel, [0, 0, Math.PI / 2], 20);
    barrel.name = 'cylinder';
    for (let j = 0; j < 10; j++) cyl(eng, 0.15, 0.15, 0.011, [side * (0.19 + j * 0.028), 0, z], M.brushed, [0, 0, Math.PI / 2], 24);
    box(eng, [0.1, 0.22, 0.25], [side * 0.52, 0, z], M.brushed);
    for (const y of [-0.06, 0.06]) rod(eng, [side * 0.575, y, z - 0.07], [side * 0.575, y, z + 0.07], 0.012, M.gold);
    const piston = cyl(eng, 0.09, 0.09, 0.12, [side * 0.22, 0, z], M.gold, [0, 0, Math.PI / 2], 16);
    pistons.push({ m: piston, side, phase: i * Math.PI });
    tube(eng, [[side * 0.45, 0.12, z], [side * 0.32, 0.26, z + 0.15], [0, 0.18, 0.36]], 0.012, M.plastic);
    tube(eng, [[side * 0.45, -0.1, z], [side * 0.48, -0.3, z], [side * 0.2, -0.42, 0.3]], 0.024, M.darkMetal);
  }
  const crank = cyl(eng, 0.03, 0.03, 1.0, [0, 0, -0.08], M.steel, [Math.PI / 2, 0, 0], 12);
  sphere(eng, [0.1, 0.12, 0.11], [0.24, -0.12, 0.36], M.plastic); // alternator housing visual
  box(eng, [0.17, 0.15, 0.14], [0, -0.33, 0.08], M.gold); // carburettor / air box

  // ---------------------------------------------------------------- FUEL system
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x2f8fd0, metalness: 0.3, roughness: 0.3, transparent: true, opacity: 0.88 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0x55b8f0, emissive: 0x0b3550, roughness: 0.3 });
  for (const dir of [-1, 1]) {
    box(systems.fuel, [1.9, 0.14, 0.78], [dir * 2.4, 1.07, -0.25], tankMat);
    cyl(systems.fuel, 0.07, 0.07, 0.05, [dir * 2.4, 1.18, -0.25], M.gold);
    tube(systems.fuel, [[dir * 1.5, 1.02, -0.3], [dir * 0.55, 0.9, -0.55], [dir * 0.45, -0.2, -0.75], [dir * 0.1, -0.3, -1.4], [0, -0.3, -2.4]], 0.018, lineMat);
  }
  box(systems.fuel, [0.14, 0.08, 0.14], [0, -0.32, -1.3], M.gold); // selector valve
  box(systems.fuel, [0.12, 0.12, 0.12], [0, -0.32, -2.05], M.red); // gascolator

  // ---------------------------------------------------------------- ELECTRICAL system
  const battery = box(systems.electrical, [0.3, 0.22, 0.24], [0.22, -0.18, -1.55], new THREE.MeshStandardMaterial({ color: 0xbd3b2f, roughness: 0.5 }));
  battery.name = 'battery';
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xffc23d, emissive: 0x4a3000, roughness: 0.4 });
  tube(systems.electrical, [[0.22, -0.05, -1.55], [0.3, 0.1, -2.2], [0.24, -0.12, -2.26]], 0.012, wireMat);
  tube(systems.electrical, [[0.22, -0.05, -1.55], [0.35, 0.3, -1.25], [0.2, 0.32, -1.08]], 0.012, wireMat);
  tube(systems.electrical, [[-0.25, 0.32, -1.08], [-0.5, 0.75, -0.6], [-2, 1.05, -0.4], [-5.6, 1.12, -0.6]], 0.008, wireMat);
  tube(systems.electrical, [[0.25, 0.32, -1.08], [0.5, 0.75, -0.6], [2, 1.05, -0.4], [5.6, 1.12, -0.6]], 0.008, wireMat);

  // contact shadow
  contactShadow(root, 9, 7, [0, 0, -0.6], 0.5);

  // ---------------------------------------------------------------- behaviours
  const enamelMats = [];
  skin.traverse(o => { if (o.isMesh && o.material?.name === 'enamel' && !enamelMats.includes(o.material)) enamelMats.push(o.material); });
  systems.airframe.traverse(o => { if (o.isMesh && o.material?.name === 'enamel' && !enamelMats.includes(o.material)) enamelMats.push(o.material); });
  const originals = new Map();
  skin.traverse(o => { if (o.isMesh) originals.set(o, o.material); });

  const api = {
    root, model, skin, parts, systems, prop, pistons, ailerons, elevator, rudder, propDisc,
    spinning: false, animate: true, exploded: 0, explodeTarget: 0,
    /** semi-transparent skin to reveal systems */
    setCutaway(on) {
      skin.traverse(o => {
        if (!o.isMesh || !originals.has(o)) return;
        if (on) {
          const m = originals.get(o).clone();
          m.transparent = true; m.opacity = Math.min(0.14, m.opacity ?? 1); m.depthWrite = false;
          o.material = m; o.castShadow = false;
        } else { o.material = originals.get(o); o.castShadow = true; }
      });
    },
    setSystems(list) { Object.entries(systems).forEach(([k, g]) => (g.visible = list.includes(k))); },
    highlight(key) {
      Object.entries(systems).forEach(([k, g]) => g.traverse(o => { if (o.isMesh && o.material.emissive && !o.userData.baseEmissive) o.userData.baseEmissive = o.material.emissive.clone(); }));
    },
    setLivery(name) {
      const map = { navy: [0x163a57, 0xf2f1ec], crimson: [0x7c2430, 0xeef0ef], alloy: [0x2c3a44, 0xa9b0b4] };
      const [accent, base] = map[name] || map.navy;
      M.navy.color.set(accent);
      enamelMats.forEach(m => { m.color.set(name === 'alloy' ? 0xb7bec2 : 0xffffff); m.metalness = name === 'alloy' ? 0.7 : 0.05; m.roughness = name === 'alloy' ? 0.34 : 0.3; });
      wingMat.color.set(base); controlMat.color.set(base);
      api.livery = name;
    },
    update(dt, t) {
      // explode animation
      api.exploded += (api.explodeTarget - api.exploded) * Math.min(1, dt * 4);
      const e = api.exploded;
      engine.position.set(0, e * 0.6, -2.62 - e * 1.8);
      engine.scale.setScalar(1 + e * 0.5);
      systems.fuel.position.y = e * 1.4;
      systems.electrical.position.x = e * 1.6;
      systems.airframe.position.y = e * 0.5;
      if (api.animate) {
        const s = t * 1.2;
        pistons.forEach(p => (p.m.position.x = p.side * (0.22 + Math.sin(t * 9 + p.phase) * 0.05)));
        crank.rotation.y = t * 9;
        ailerons.forEach((a, i) => (a.rotation.x = Math.sin(s) * 0.28 * (i ? -1 : 1)));
        elevator.rotation.x = Math.sin(s * 0.8) * 0.3;
        rudder.rotation.y = Math.sin(s * 0.6) * 0.3;
      }
      if (api.spinning) { prop.rotation.z += dt * 55; propDisc.material.opacity = 0.18; prop.visible = true; }
      else { propDisc.material.opacity = 0; }
    },
  };
  api.setSystems([]);
  return api;
}
