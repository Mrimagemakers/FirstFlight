// AR aircraft explorer: detailed, original 3D models of a training airplane, an airliner and their key parts.
// Every builder returns { root, size, labels, explode(e), update(dt, t, animate) }.
// Model space: metres, +y up, sitting on y = 0, nose / intake toward -z.
// Labels: { title, text, at: [x,y,z], parent?: Object3D } — positions are local to `parent` (or root).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mesh, box, cyl, rod, tube, sphere, lathe, airfoil, roundedBox, canvasTexture } from '../util.js';
import { materials } from '../materials.js';
import { buildTrainer, TRAINER_GROUND } from './trainer.js';
import { buildAirliner } from './airliner.js';

const TAU = Math.PI * 2;
const lerp = THREE.MathUtils.lerp;

// ------------------------------------------------------------------ shared geometry helpers
/** A blade along +y from rIn to rOut, chord along x, twisted about the radial axis. */
function bladeGeo(rIn, rOut, chordIn, chordOut, twistIn, twistOut, thick = 0.01, seg = 6, sweep = 0) {
  const g = new THREE.BoxGeometry(1, 1, 1, 1, seg, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) + 0.5;
    const r = lerp(rIn, rOut, t), c = lerp(chordIn, chordOut, t), a = lerp(twistIn, twistOut, t);
    let x = p.getX(i) * c, z = p.getZ(i) * thick * (1 - 0.5 * t);
    // camber the blade slightly
    z += Math.cos(p.getX(i) * Math.PI) * thick * 0.6;
    const ca = Math.cos(a), sa = Math.sin(a);
    p.setXYZ(i, x * ca - z * sa + sweep * t * t, r, x * sa + z * ca);
  }
  g.computeVertexNormals();
  return g;
}

/** n copies of a geometry rotated around the z axis, merged into one mesh geometry. */
function ring(geo, n, phase = 0) {
  const parts = [];
  for (let i = 0; i < n; i++) { const g = geo.clone(); g.rotateZ(phase + (i / n) * TAU); parts.push(g); }
  return mergeGeometries(parts.map(g => (g.index ? g.toNonIndexed() : g)));
}

/** A lathe whose axis is z (profile points [r, z]); optional cutaway (leaves an open quadrant facing +x/+y). */
function latheZ(points, seg = 48, cut = false) {
  const g = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), seg, cut ? Math.PI : 0, cut ? Math.PI * 1.5 : TAU);
  g.rotateX(Math.PI / 2);
  return g;
}

/** Thin aerofoil-section slab (ribs, control surfaces): chord along z from 0..c, extruded along x by w. */
function foilSlab(chord, thickness, width, { camber = 0, n = 30 } = {}) {
  const shape = new THREE.Shape();
  airfoil(n, thickness, camber).forEach(([t, y], i) => (i ? shape.lineTo(t * chord, y * chord) : shape.moveTo(t * chord, y * chord)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false, curveSegments: 4 });
  g.rotateY(-Math.PI / 2); // chord: +x -> +z ; extrusion: +z -> +x... then centre on x
  g.translate(width / 2, 0, 0);
  return g;
}

/** Canvas label used for engraved placards etc. */
function placard(text, w = 512, h = 128, bg = '#22282c', fg = '#e9eef0') {
  return canvasTexture(w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.font = `700 ${Math.round(h * 0.42)}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2); }).texture;
}

const mat = (o) => new THREE.MeshStandardMaterial(o);
const phys = (o) => new THREE.MeshPhysicalMaterial(o);

// ================================================================== 1. COMPLETE TRAINING AIRPLANE
function trainerFull(lab) {
  const t = buildTrainer(lab, { livery: 'navy' });
  t.setSystems([]);
  const root = new THREE.Group(); root.add(t.root);
  const G = TRAINER_GROUND;
  const s = t.skin, sys = t.systems;
  const labels = [
    { title: 'Propeller', text: 'Two twisted blades turn engine power into thrust. Each blade is an aerofoil, so it works like a rotating wing.', at: [0, 0.75, -3.17], parent: s },
    { title: 'Engine cowling', text: 'The smooth cover around the engine. It streamlines the nose and guides cooling air over the cylinders.', at: [0, 0.38, -2.4], parent: s },
    { title: 'Windscreen', text: 'Curved acrylic that gives the pilots a wide forward view. Pilots check it for cracks and bugs on the preflight walkaround.', at: [0, 0.98, -0.9], parent: s },
    { title: 'Wing', text: 'A high, strut-braced wing with a cambered aerofoil. It produces the lift that holds the airplane up and carries the fuel tanks.', at: [-4.2, 1.15, -0.3], parent: s },
    { title: 'Aileron', text: 'Hinged surfaces near each wingtip that move in opposite directions to roll (bank) the airplane.', at: [-4.2, 1.1, 0.75], parent: s },
    { title: 'Wing strut', text: 'Carries some of the wing’s load to the fuselage, allowing a lighter wing structure.', at: [2.0, 0.42, -0.1], parent: s },
    { title: 'Horizontal stabilizer & elevator', text: 'The tail’s horizontal surfaces keep the airplane stable in pitch; the hinged elevator moves the nose up or down.', at: [-1.4, 0.4, 3.35], parent: s },
    { title: 'Vertical fin & rudder', text: 'The fin keeps the airplane pointing into the airflow; the rudder yaws the nose left or right and coordinates turns.', at: [0, 1.6, 3.4], parent: s },
    { title: 'Main landing gear', text: 'Spring-steel legs with wheels and disc brakes carry most of the weight on the ground.', at: [1.08, -0.9, 0.62], parent: s },
    { title: 'Nose landing gear', text: 'A steerable nose wheel with a shock-absorbing oleo strut.', at: [0, -0.85, -2.45], parent: s },
    { title: 'Pitot tube', text: 'Measures ram air pressure for the airspeed indicator. A blocked pitot tube gives false airspeed readings.', at: [-3.2, 0.95, -0.95], parent: s },
    { title: 'Piston engine', text: 'A horizontally opposed four-cylinder engine. Open the Piston engine model to explore it part by part.', at: [0, 0.32, 0], parent: sys.engine, exploded: true },
    { title: 'Fuel tanks', text: 'One tank in each wing. Fuel flows through a selector valve and a strainer (gascolator) to the engine.', at: [2.4, 1.2, -0.25], parent: sys.fuel, exploded: true },
    { title: 'Battery & wiring', text: 'The battery starts the engine; an engine-driven alternator powers the electrical system in flight.', at: [0.22, 0.0, -1.55], parent: sys.electrical, exploded: true },
  ];
  return {
    root, size: 11.2, labels, trainer: t, center: [0, 1.0, 0], view: [0.62, 0.36, -0.72],
    explode(e) {
      t.explodeTarget = e;
      const on = e > 0.02;
      if (on !== this._cut) { this._cut = on; t.setCutaway(on); t.setSystems(on ? ['engine', 'fuel', 'electrical', 'airframe'] : []); }
    },
    update(dt, time, anim) { t.animate = anim; t.spinning = anim; t.update(dt, time); },
    exportRoot() { return t.root; },
  };
}

// ================================================================== 2. PISTON ENGINE + PROPELLER
function pistonEngine(lab) {
  const M = materials(lab);
  const root = new THREE.Group();
  const eng = new THREE.Group(); eng.position.y = 0.62; root.add(eng);
  const alu = mat({ color: 0xb9bdbf, metalness: 0.85, roughness: 0.38 });
  const castAlu = mat({ color: 0x9ea3a5, metalness: 0.7, roughness: 0.55 });
  const blackPaint = mat({ color: 0x1f2326, metalness: 0.3, roughness: 0.55 });
  const finMat = mat({ color: 0x8e9599, metalness: 0.85, roughness: 0.4 });
  const exhaustMat = mat({ color: 0x6b4d3a, metalness: 0.7, roughness: 0.6 });
  const leadMat = mat({ color: 0xe0d6c2, roughness: 0.6 });
  const parts = { cylinders: [], heads: [], prop: null, spinner: null, mags: null, sump: null, accessories: null };

  // crankcase (split along the centreline) and sump
  const crank = mesh(roundedBox(0.4, 0.34, 0.66, 0.06), castAlu, eng); crank.position.z = 0.02;
  box(eng, [0.006, 0.36, 0.66], [0, 0, 0.02], M.steel); // parting line
  const sump = new THREE.Group(); eng.add(sump); parts.sump = sump;
  mesh(roundedBox(0.34, 0.16, 0.52, 0.04), castAlu, sump).position.set(0, -0.25, 0.06);
  for (let i = 0; i < 6; i++) box(sump, [0.3, 0.012, 0.008], [0, -0.33, -0.15 + i * 0.08], castAlu);
  // cylinders: two per side, staggered
  const cylZ = { '-1': [-0.13, 0.19], '1': [-0.07, 0.25] };
  for (const side of [-1, 1]) for (const z of cylZ[side]) {
    const c = new THREE.Group(); c.position.set(side * 0.2, 0.02, z); eng.add(c);
    c.userData.side = side; parts.cylinders.push(c);
    cyl(c, 0.068, 0.068, 0.26, [side * 0.13, 0, 0], M.steel, [0, 0, Math.PI / 2], 24);
    for (let j = 0; j < 12; j++) cyl(c, 0.098, 0.098, 0.006, [side * (0.03 + j * 0.019), 0, 0], finMat, [0, 0, Math.PI / 2], 28);
    // head with deep fins, rocker cover, valves, spark plugs
    const h = new THREE.Group(); h.position.set(side * 0.33, 0, 0); c.add(h); parts.heads.push(h);
    mesh(roundedBox(0.12, 0.2, 0.2, 0.03), castAlu, h);
    for (let j = 0; j < 7; j++) box(h, [0.006, 0.24, 0.23], [side * (0.02 + j * 0.016), 0, 0], finMat);
    const rc = mesh(roundedBox(0.07, 0.07, 0.17, 0.02), blackPaint, h); rc.position.set(side * 0.03, 0.14, 0);
    for (const y of [0.08, -0.08]) { rod(h, [side * 0.06, y, 0.06], [side * 0.11, y * 1.25, 0.08], 0.011, M.steel); cyl(h, 0.016, 0.016, 0.03, [side * 0.12, y * 1.3, 0.085], leadMat, [0, 0, Math.PI / 2], 10); }
    // pushrod tubes under the barrel
    rod(c, [side * 0.02, -0.07, 0.03], [side * 0.27, -0.09, 0.03], 0.01, M.steel);
    rod(c, [side * 0.02, -0.07, -0.03], [side * 0.27, -0.09, -0.03], 0.01, M.steel);
    // exhaust stack from the bottom of the head
    tube(h, [[side * 0.0, -0.11, -0.02], [side * -0.02, -0.22, -0.06], [side * -0.08, -0.36, -0.05], [side * -0.14, -0.48, 0.1]], 0.022, exhaustMat, 10);
    // intake runner to the sump/plenum
    tube(h, [[side * -0.03, -0.1, 0.06], [side * -0.12, -0.18, 0.08], [side * -0.3, -0.24, 0.1]], 0.016, alu, 8);
  }
  // propeller flange, hub, two-blade propeller, spinner
  const propG = new THREE.Group(); propG.position.set(0, 0.02, -0.42); eng.add(propG); parts.prop = propG;
  cyl(propG, 0.09, 0.09, 0.05, [0, 0, 0.04], M.steel, [Math.PI / 2, 0, 0], 24);
  cyl(propG, 0.075, 0.075, 0.12, [0, 0, -0.03], alu, [Math.PI / 2, 0, 0], 24);
  const bladeMat = phys({ color: 0x24282b, metalness: 0.4, roughness: 0.4, clearcoat: 0.6 });
  const tipMat = mat({ color: 0xf2c230, roughness: 0.5 });
  for (const k of [0, 1]) {
    const bg = bladeGeo(0.07, 0.93, 0.16, 0.08, 0.95, 0.25, 0.028, 16);
    const b = mesh(bg, bladeMat, propG); b.rotation.z = k * Math.PI; b.position.z = -0.03;
    const tg = bladeGeo(0.86, 0.95, 0.09, 0.07, 0.3, 0.25, 0.03, 2);
    const tp = mesh(tg, tipMat, propG); tp.rotation.z = k * Math.PI; tp.position.z = -0.03;
  }
  const spinnerG = new THREE.Group(); spinnerG.position.set(0, 0.02, -0.5); eng.add(spinnerG); parts.spinner = spinnerG;
  const spin = mesh(latheZ([[0.001, -0.3], [0.06, -0.27], [0.12, -0.18], [0.155, -0.06], [0.16, 0.02]], 40), phys({ color: 0xd8dcde, metalness: 0.9, roughness: 0.18, clearcoat: 1 }), spinnerG);
  spin.position.z = 0;
  // accessories at the rear: two magnetos, oil filter; starter and alternator at the front
  const acc = new THREE.Group(); eng.add(acc); parts.accessories = acc;
  const mags = new THREE.Group(); acc.add(mags); parts.mags = mags;
  for (const side of [-1, 1]) {
    cyl(mags, 0.05, 0.05, 0.12, [side * 0.1, 0.12, 0.42], mat({ color: 0x2b2f33, metalness: 0.4, roughness: 0.5 }), [Math.PI / 2, 0, 0], 20);
    cyl(mags, 0.055, 0.055, 0.03, [side * 0.1, 0.12, 0.49], leadMat, [Math.PI / 2, 0, 0], 20);
    // ignition harness to the plugs
    for (const z of cylZ[side]) tube(mags, [[side * 0.1, 0.12, 0.5], [side * 0.3, 0.24, 0.35], [side * 0.48, 0.12, z + 0.08]], 0.006, leadMat, 6);
  }
  cyl(acc, 0.045, 0.045, 0.11, [0.0, -0.06, 0.44], mat({ color: 0xc2551f, roughness: 0.45 }), [Math.PI / 2, 0, 0], 20); // oil filter
  cyl(acc, 0.06, 0.06, 0.16, [0.17, -0.12, -0.32], blackPaint, [Math.PI / 2, 0, 0], 20); // alternator
  cyl(acc, 0.07, 0.07, 0.02, [0.17, -0.12, -0.41], M.steel, [Math.PI / 2, 0, 0], 24); // pulley
  cyl(acc, 0.055, 0.055, 0.18, [-0.15, -0.14, -0.3], mat({ color: 0x3c4246, metalness: 0.5, roughness: 0.4 }), [Math.PI / 2, 0, 0], 20); // starter
  const carb = mesh(roundedBox(0.12, 0.1, 0.12, 0.02), alu, acc); carb.position.set(0, -0.4, 0.04); // carburettor
  box(acc, [0.16, 0.05, 0.16], [0, -0.48, 0.04], blackPaint); // air box
  rod(acc, [0, 0.19, 0.3], [0, 0.32, 0.36], 0.01, mat({ color: 0xe8c33a, roughness: 0.5 })); // dipstick
  // engine mount to a firewall plate
  const mount = new THREE.Group(); root.add(mount);
  for (const x of [-0.2, 0.2]) for (const y of [0.42, 0.82]) rod(mount, [x * 1.2, y, 0.62], [x, y + (y > 0.6 ? -0.1 : 0.06), 0.3], 0.012, M.steel);
  box(mount, [0.66, 0.6, 0.02], [0, 0.62, 0.64], mat({ color: 0x9aa0a3, metalness: 0.8, roughness: 0.4 }));
  // stand
  box(root, [0.7, 0.04, 0.5], [0, 0.02, 0.55], blackPaint);
  rod(root, [0, 0.04, 0.55], [0, 0.32, 0.64], 0.03, blackPaint);

  const labels = [
    { title: 'Propeller', text: 'A fixed-pitch, two-blade propeller bolted to the crankshaft flange. Blade angle decreases toward the tip because the tip travels faster.', at: [0.0, 0.7, -0.03], parent: propG },
    { title: 'Spinner', text: 'A streamlined cap over the propeller hub that reduces drag and smooths airflow into the cowling.', at: [0, 0.12, -0.15], parent: spinnerG },
    { title: 'Crankcase', text: 'The two-piece aluminium case that holds the crankshaft and camshaft; the cylinders bolt onto it.', at: [0, 0.2, 0.05], parent: eng },
    { title: 'Cylinders & cooling fins', text: 'Four cylinders lie flat, two per side ("horizontally opposed"). Thin fins shed heat into the cooling air.', at: [0.13, 0.11, 0], parent: parts.cylinders[1] },
    { title: 'Cylinder head & valves', text: 'Each head holds an intake and an exhaust valve, opened by pushrods and rocker arms under the black rocker cover.', at: [0.03, 0.2, 0], parent: parts.heads[3] },
    { title: 'Spark plugs (dual ignition)', text: 'Two plugs per cylinder, each fired by a different magneto, for safety and a more complete burn.', at: [0.12, -0.12, 0.09], parent: parts.heads[2] },
    { title: 'Magnetos', text: 'Self-powered generators that make the spark. They work even if the airplane’s electrical system fails; pilots test each one before take-off.', at: [0.1, 0.2, 0.44], parent: mags },
    { title: 'Carburettor & air box', text: 'Mixes fuel with incoming air. Carburettor icing can form even on mild, humid days; carb heat melts it.', at: [0, -0.5, 0.04], parent: acc },
    { title: 'Exhaust', text: 'Carries hot exhaust gas overboard. Cracks can leak carbon monoxide, so the system is inspected carefully.', at: [-0.14, -0.48, 0.1], parent: parts.heads[0] },
    { title: 'Alternator', text: 'Belt-driven from the crankshaft; it charges the battery and powers the avionics in flight.', at: [0.17, -0.2, -0.32], parent: acc },
    { title: 'Starter motor', text: 'An electric motor that cranks the engine using battery power until it fires.', at: [-0.15, -0.23, -0.3], parent: acc },
    { title: 'Oil sump', text: 'Holds the engine oil, which lubricates, cools and cleans. Pilots check the dipstick on every preflight.', at: [0, -0.34, 0.15], parent: sump },
  ];
  return {
    root, size: 1.9, labels, center: [0, 0.62, -0.1], view: [0.62, 0.32, -0.75],
    explode(e) {
      parts.cylinders.forEach(c => (c.position.x = c.userData.side * (0.2 + e * 0.32)));
      parts.heads.forEach(h => (h.position.x = Math.sign(h.parent.userData.side) * (0.33 + e * 0.22)));
      propG.position.z = -0.42 - e * 0.55;
      spinnerG.position.z = -0.5 - e * 0.95;
      mags.position.z = e * 0.3;
      acc.position.y = -e * 0.0;
      sump.position.y = -e * 0.25;
    },
    update(dt, t, anim) { if (anim) propG.rotation.z += dt * 6; },
  };
}

// ================================================================== 3. WING STRUCTURE (cutaway section)
function wingSection(lab) {
  const M = materials(lab);
  const root = new THREE.Group();
  const W = 3.4, C = 1.55, TH = 0.13, Y = 0.9; // span, chord, thickness ratio, height
  const wing = new THREE.Group(); wing.position.y = Y; root.add(wing);
  const ribMat = mat({ color: 0xb8bec2, metalness: 0.85, roughness: 0.35 });
  const sparMat = mat({ color: 0x8d969b, metalness: 0.9, roughness: 0.3 });
  const foil = airfoil(40, TH, 0.035);
  const thick = (t) => { let up = 0, lo = 0; foil.forEach(([x, y]) => { if (Math.abs(x - t) < 0.03) { up = Math.max(up, y); lo = Math.min(lo, y); } }); return [lo * C, up * C]; };
  // ribs every 0.34 m
  const ribs = new THREE.Group(); wing.add(ribs);
  for (let x = -W / 2 + 0.05; x <= W / 2; x += 0.34) {
    const r = mesh(foilSlab(C, TH, 0.008, { camber: 0.035 }), ribMat, ribs); r.position.x = x;
    // lightening holes suggested by dark discs
    for (const t of [0.42, 0.55]) { const [lo, up] = thick(t); const d = cyl(ribs, (up - lo) * 0.28, (up - lo) * 0.28, 0.011, [x, (up + lo) / 2, t * C], M.darkMetal, [0, 0, Math.PI / 2], 16); }
  }
  // front and rear spars (I-beams)
  const spars = new THREE.Group(); wing.add(spars);
  for (const t of [0.25, 0.7]) {
    const [lo, up] = thick(t);
    box(spars, [W, up - lo, 0.012], [0, (up + lo) / 2, t * C], sparMat);
    box(spars, [W, 0.008, 0.06], [0, up - 0.004, t * C], sparMat);
    box(spars, [W, 0.008, 0.06], [0, lo + 0.004, t * C], sparMat);
  }
  // fuel tank between the spars (inboard half)
  const tankMat = phys({ color: 0x2f8fd0, metalness: 0.2, roughness: 0.25, transparent: true, opacity: 0.75, clearcoat: 1 });
  const tank = new THREE.Group(); wing.add(tank);
  { const [lo, up] = thick(0.47); mesh(roundedBox(1.3, (up - lo) * 0.8, 0.62, 0.03), tankMat, tank).position.set(-0.85, (up + lo) / 2, 0.47 * C); cyl(tank, 0.04, 0.04, 0.05, [-0.85, up + 0.01, 0.4 * C], M.gold, null, 16); }
  // skin: upper and lower surfaces as a thin translucent loft
  const skinMat = phys({ color: 0xf2f1ec, metalness: 0.05, roughness: 0.3, clearcoat: 1, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
  const skin = new THREE.Group(); wing.add(skin);
  const skinGeo = foilSlab(C * 0.65, TH, W, { camber: 0.035 });
  mesh(skinGeo, skinMat, skin, { cast: false });
  // leading edge (solid, painted) covers the front 0..0.25
  // control surfaces: aileron (outboard) and flap (inboard), hinged behind the rear spar
  const surfMat = phys({ color: 0xf2f1ec, metalness: 0.05, roughness: 0.3, clearcoat: 1 });
  const hingeZ = 0.72 * C, [hlo, hup] = thick(0.72), hy = (hup + hlo) / 2;
  const aileron = new THREE.Group(); aileron.position.set(0.85, hy, hingeZ); wing.add(aileron);
  const ag = foilSlab(C * 0.3, 0.12, 1.55); ag.translate(0, 0, 0); mesh(ag, surfMat, aileron).position.z = -0.01;
  const flap = new THREE.Group(); flap.position.set(-0.85, hy, hingeZ); wing.add(flap);
  mesh(foilSlab(C * 0.3, 0.12, 1.55), surfMat, flap).position.z = -0.01;
  for (const x of [0.25, 1.45]) cyl(wing, 0.012, 0.012, 0.06, [x, hy, hingeZ], M.steel, [0, 0, Math.PI / 2], 10);
  // control cable and bellcrank
  const cableMat = mat({ color: 0xc9964f, metalness: 0.8, roughness: 0.35 });
  tube(wing, [[-W / 2, hy + 0.01, 0.68 * C], [0.3, hy + 0.01, 0.68 * C], [0.62, hy, 0.66 * C]], 0.005, cableMat, 6);
  const bell = box(wing, [0.04, 0.02, 0.12], [0.65, hy, 0.69 * C], M.steel);
  // wingtip, nav light, pitot tube and stall-warning vane
  const tip = new THREE.Group(); wing.add(tip);
  const tipShape = foilSlab(C, TH, 0.1, { camber: 0.035 }); const tm = mesh(tipShape, surfMat, tip); tm.position.x = W / 2 + 0.05; tm.scale.set(1, 0.7, 1);
  sphere(tip, [0.035, 0.03, 0.06], [W / 2 + 0.11, 0.02, 0.15], mat({ color: 0x30d158, emissive: 0x0a7a34, roughness: 0.1 }), 12);
  sphere(tip, [0.03, 0.03, 0.03], [W / 2 + 0.11, 0.03, 1.2], mat({ color: 0xffffff, emissive: 0x888888, roughness: 0.1 }), 10);
  const pitot = new THREE.Group(); wing.add(pitot);
  rod(pitot, [-1.2, thick(0.3)[0], 0.3 * C], [-1.2, thick(0.3)[0] - 0.12, 0.3 * C], 0.012, M.aluminum);
  rod(pitot, [-1.2, thick(0.3)[0] - 0.12, 0.3 * C], [-1.2, thick(0.3)[0] - 0.12, -0.15], 0.01, M.aluminum);
  const stall = box(wing, [0.03, 0.006, 0.025], [-0.4, -0.005, -0.01], M.steel);
  // stand
  const blackPaint = mat({ color: 0x1f2326, roughness: 0.55 });
  box(root, [1.2, 0.04, 0.8], [0, 0.02, 0.75], blackPaint);
  rod(root, [0, 0.04, 0.75], [0, Y - 0.05, 0.75], 0.03, blackPaint);
  rod(root, [-W / 2 + 0.05, 0.04, 0.75], [-W / 2 + 0.05, Y - 0.05, 0.75], 0.025, blackPaint);
  box(root, [0.3, 0.04, 0.4], [-W / 2 + 0.05, 0.02, 0.75], blackPaint);

  const labels = [
    { title: 'Ribs', text: 'Aerofoil-shaped frames that give the wing its shape and carry air loads from the skin to the spars.', at: [-0.05, 0.12, 1.0], parent: ribs },
    { title: 'Front spar', text: 'The main beam running along the wing. It carries most of the bending load from lift; the strut attaches here.', at: [1.3, 0.12, 0.25 * C], parent: spars },
    { title: 'Rear spar', text: 'A second beam that carries load and provides the hinge line for the flap and aileron.', at: [1.5, 0.1, 0.7 * C], parent: spars },
    { title: 'Skin', text: 'Thin aluminium sheet riveted to the ribs and spars. On this model it is see-through so the structure shows.', at: [0.3, 0.13, 0.35], parent: skin },
    { title: 'Fuel tank', text: 'An integral wing tank between the spars. Pilots check fuel quantity visually and drain a sample from each tank.', at: [-0.85, 0.1, 0.47 * C], parent: tank },
    { title: 'Aileron', text: 'Moves up on one wing and down on the other to roll the airplane. Connected to the yoke by cables and a bellcrank.', at: [0.8, 0.02, 0.36], parent: aileron },
    { title: 'Flap', text: 'Extends downward for take-off and landing, adding lift and drag so the airplane can fly slower and descend steeper.', at: [-0.8, 0.02, 0.36], parent: flap },
    { title: 'Control cable & bellcrank', text: 'Steel cables run from the cockpit controls to a bellcrank that drives the aileron.', at: [0.65, 0.06, 0.69 * C], parent: wing },
    { title: 'Navigation & strobe lights', text: 'Green on the right wingtip, red on the left, white facing aft, plus a bright strobe to help others see you.', at: [W / 2 + 0.11, 0.1, 0.15], parent: tip },
    { title: 'Pitot tube', text: 'Points into the airflow to measure ram air pressure for the airspeed indicator.', at: [-1.2, -0.14, -0.15], parent: pitot },
    { title: 'Stall warning vane', text: 'A small tab on the leading edge that triggers a horn as the wing approaches its critical angle of attack.', at: [-0.4, 0.03, -0.02], parent: wing },
  ];
  return {
    root, size: 3.6, labels, center: [0, Y, 0.7], view: [0.45, 0.62, -0.68],
    explode(e) { skin.position.y = e * 0.45; tank.position.y = e * 0.25; aileron.position.z = hingeZ + e * 0.35; flap.position.z = hingeZ + e * 0.35; tip.position.x = e * 0.35; pitot.position.y = -e * 0.15; },
    update(dt, t, anim) { if (!anim) return; aileron.rotation.x = Math.sin(t * 1.4) * 0.35; flap.rotation.x = (Math.sin(t * 0.5) * 0.5 + 0.5) * 0.6; },
  };
}

// ================================================================== 4. EMPENNAGE (tail)
function empennage(lab) {
  const M = materials(lab);
  const root = new THREE.Group();
  const paint = phys({ color: 0xf3f2ec, metalness: 0.05, roughness: 0.3, clearcoat: 1 });
  const navy = phys({ color: 0x163a57, metalness: 0.2, roughness: 0.3, clearcoat: 1 });
  // tail cone
  const cone = mesh(latheZ([[0.34, -0.9], [0.3, -0.4], [0.2, 0.3], [0.1, 0.9], [0.04, 1.15]], 40), paint, root);
  cone.position.set(0, 1.0, 0);
  // horizontal stabilizer (fixed) with elevator and trim tab
  const hstab = new THREE.Group(); hstab.position.set(0, 1.0, 0.3); root.add(hstab);
  const span = 3.4, ch = 0.62;
  mesh(foilSlab(ch, 0.1, span), paint, hstab).position.z = -0.1;
  const elev = new THREE.Group(); elev.position.set(0, 0, 0.53); hstab.add(elev);
  const eg = foilSlab(0.36, 0.08, span - 0.1); mesh(eg, paint, elev);
  const trim = new THREE.Group(); trim.position.set(0.55, 0, 0.36); elev.add(trim);
  mesh(foilSlab(0.1, 0.06, 0.5), navy, trim);
  // vertical fin and rudder
  const fin = new THREE.Group(); fin.position.set(0, 1.08, 0.1); root.add(fin);
  const fs = new THREE.Shape(); fs.moveTo(-0.45, 0); fs.lineTo(0.45, 0); fs.lineTo(0.55, 1.2); fs.lineTo(0.2, 1.25); fs.closePath();
  const fg = new THREE.ExtrudeGeometry(fs, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 3 }); fg.translate(0, 0, -0.03); fg.rotateY(-Math.PI / 2);
  mesh(fg, navy, fin);
  const rudder = new THREE.Group(); rudder.position.set(0, 0, 0.6); fin.add(rudder);
  const rs = new THREE.Shape(); rs.moveTo(0, 0.05); rs.lineTo(0.38, 0.05); rs.lineTo(0.32, 1.1); rs.lineTo(0, 1.26); rs.closePath();
  const rg = new THREE.ExtrudeGeometry(rs, { depth: 0.04, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }); rg.translate(0, 0, -0.02); rg.rotateY(-Math.PI / 2);
  mesh(rg, navy, rudder);
  // hinges, beacon, tie-down, control horns and cables
  const beacon = sphere(fin, [0.04, 0.05, 0.06], [0, 1.28, 0.32], mat({ color: 0xff3020, emissive: 0x660000, roughness: 0.2 }), 12);
  rod(root, [0, 0.62, 0.5], [0, 0.98, 0.5], 0.012, M.steel); // tail tie-down
  cyl(root, 0.035, 0.035, 0.01, [0, 0.6, 0.5], M.steel, [Math.PI / 2, 0, 0], 16);
  const horn = box(elev, [0.02, 0.12, 0.05], [0, -0.07, 0.03], M.steel);
  const cableMat = mat({ color: 0xc9964f, metalness: 0.8, roughness: 0.35 });
  tube(root, [[0.06, 0.95, -0.9], [0.05, 0.93, 0.3], [0.0, 0.93, 0.85]], 0.005, cableMat, 6);
  tube(root, [[-0.06, 1.05, -0.9], [-0.05, 1.1, 0.4], [0.0, 1.2, 0.7]], 0.005, cableMat, 6);
  // stand
  const blackPaint = mat({ color: 0x1f2326, roughness: 0.55 });
  box(root, [0.8, 0.04, 0.6], [0, 0.02, -0.4], blackPaint);
  rod(root, [0, 0.04, -0.4], [0, 0.7, -0.4], 0.03, blackPaint);
  const labels = [
    { title: 'Horizontal stabilizer', text: 'The fixed horizontal tail. It balances the airplane in pitch, like the feathers on an arrow.', at: [-1.3, 0.05, 0.1], parent: hstab },
    { title: 'Elevator', text: 'Hinged to the stabilizer. Pull the yoke back: the elevator goes up, the tail goes down and the nose rises.', at: [1.2, 0.04, 0.2], parent: elev },
    { title: 'Trim tab', text: 'A small tab on the elevator that holds it in place aerodynamically so the pilot doesn’t have to keep pressure on the yoke.', at: [0, 0.04, 0.08], parent: trim },
    { title: 'Vertical stabilizer (fin)', text: 'Keeps the airplane pointing into the relative wind and stable in yaw.', at: [0, 0.75, 0.15], parent: fin },
    { title: 'Rudder', text: 'Controlled by the rudder pedals. It yaws the nose left or right and keeps turns coordinated.', at: [0, 0.75, 0.2], parent: rudder },
    { title: 'Anti-collision beacon', text: 'A flashing red light on top of the tail, switched on before engine start and kept on whenever the engine runs.', at: [0, 1.32, 0.32], parent: fin },
    { title: 'Control horn & cables', text: 'Cables from the cockpit pull on control horns to move the elevator and rudder.', at: [0, -0.12, 0.03], parent: elev },
    { title: 'Tail tie-down', text: 'A ring used to tie the airplane down when parked, so wind can’t move it.', at: [0, 0.6, 0.5], parent: root },
  ];
  return {
    root, size: 3.4, labels, center: [0, 1.2, 0.3], view: [0.68, 0.42, 0.62],
    explode(e) { elev.position.z = 0.53 + e * 0.35; trim.position.z = 0.36 + e * 0.2; rudder.position.z = 0.6 + e * 0.35; fin.position.y = 1.08 + e * 0.3; hstab.position.y = 1.0 + e * 0.1; },
    update(dt, t, anim) { if (!anim) return; elev.rotation.x = Math.sin(t * 1.1) * 0.35; rudder.rotation.y = Math.sin(t * 0.8) * 0.4; trim.rotation.x = Math.sin(t * 2) * 0.2; },
  };
}

// ================================================================== 5. LANDING GEAR (training airplane)
function landingGear(lab) {
  const M = materials(lab);
  const root = new THREE.Group();
  const paint = phys({ color: 0xf3f2ec, metalness: 0.05, roughness: 0.3, clearcoat: 1 });
  const chrome = mat({ color: 0xe1e4e6, metalness: 1, roughness: 0.12 });
  const hydraulic = mat({ color: 0x2b2f33, roughness: 0.5 });
  const wheels = [];
  const wheel = (parent, r, w) => {
    const g = new THREE.Group(); parent.add(g);
    const tire = mesh(new THREE.TorusGeometry(r - 0.07, 0.075, 18, 48), M.rubber, g); tire.rotation.y = Math.PI / 2; tire.scale.z = w / 0.15;
    // tread grooves
    for (const s of [-0.3, 0.3]) { const gr = mesh(new THREE.TorusGeometry(r + 0.001, 0.006, 6, 48), mat({ color: 0x050607, roughness: 1 }), g); gr.rotation.y = Math.PI / 2; gr.position.x = s * w; }
    const hubG = new THREE.Group(); g.add(hubG);
    cyl(hubG, r * 0.55, r * 0.55, w * 0.95, [0, 0, 0], M.aluminum, [0, 0, Math.PI / 2], 32);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; cyl(hubG, 0.012, 0.012, w, [0, Math.cos(a) * r * 0.32, Math.sin(a) * r * 0.32], M.steel, [0, 0, Math.PI / 2], 8); }
    cyl(g, 0.03, 0.03, w * 1.3, [0, 0, 0], M.steel, [0, 0, Math.PI / 2], 16); // axle
    wheels.push(hubG);
    return g;
  };
  // ---------- main gear (right side) — spring steel leg
  const main = new THREE.Group(); main.position.set(0.55, 0, 0.3); root.add(main);
  tube(main, [[-0.55, 0.95, 0], [-0.25, 0.65, 0.02], [0.1, 0.32, 0.02]], 0.035, paint, 10);
  const mWheel = wheel(main, 0.27, 0.16); mWheel.position.set(0.18, 0.27, 0.02);
  const brake = new THREE.Group(); main.add(brake);
  cyl(brake, 0.15, 0.15, 0.01, [0.07, 0.27, 0.02], M.steel, [0, 0, Math.PI / 2], 32);
  box(brake, [0.05, 0.08, 0.07], [0.06, 0.38, -0.07], M.red);
  tube(brake, [[0.06, 0.42, -0.08], [-0.15, 0.55, -0.05], [-0.5, 0.9, -0.02]], 0.006, hydraulic, 6);
  const fairing = new THREE.Group(); main.add(fairing);
  // ---------- nose gear — oleo strut, torque link, shimmy damper, fork
  const nose = new THREE.Group(); nose.position.set(-0.5, 0, -0.55); root.add(nose);
  const upper = cyl(nose, 0.05, 0.05, 0.45, [0, 0.82, 0], paint, null, 24);
  const piston = new THREE.Group(); nose.add(piston);
  cyl(piston, 0.035, 0.035, 0.36, [0, 0.55, 0], chrome, null, 24);
  const fork = new THREE.Group(); piston.add(fork);
  box(fork, [0.2, 0.04, 0.06], [0, 0.36, 0], M.steel);
  for (const x of [-0.08, 0.08]) rod(fork, [x, 0.36, 0], [x, 0.22, 0.02], 0.014, M.steel);
  const nWheel = wheel(fork, 0.22, 0.12); nWheel.position.set(0, 0.22, 0.02);
  // torque link (scissors) between the cylinder and the fork
  const link = new THREE.Group(); nose.add(link);
  const linkA = rod(link, [0, 0.62, 0.06], [0, 0.5, 0.12], 0.01, M.steel);
  const linkB = rod(link, [0, 0.5, 0.12], [0, 0.4, 0.06], 0.01, M.steel);
  const damper = new THREE.Group(); nose.add(damper);
  rod(damper, [0.06, 0.92, 0.0], [0.24, 0.92, 0.12], 0.016, mat({ color: 0x3a4248, metalness: 0.6, roughness: 0.4 }));
  rod(damper, [0.24, 0.92, 0.12], [0.34, 0.92, 0.18], 0.009, chrome);
  // steering rods to the rudder pedals
  rod(nose, [-0.06, 0.98, 0], [-0.3, 1.0, 0.45], 0.008, M.steel);
  // stand plinth
  box(root, [1.8, 0.02, 1.4], [0, 0.01, 0], mat({ color: 0x2b3135, roughness: 0.8 }));
  const labels = [
    { title: 'Main gear leg (spring steel)', text: 'A tapered spring-steel leg that flexes to absorb landing loads, with no hydraulics to maintain.', at: [-0.25, 0.68, 0.02], parent: main },
    { title: 'Wheel & tire', text: 'Pilots check tires for cuts, bald spots and correct inflation on every walkaround.', at: [0.18, 0.56, 0.02], parent: main },
    { title: 'Disc brake & caliper', text: 'Toe pressure on the rudder pedals squeezes the caliper (red) onto the disc. Each main wheel brakes independently.', at: [0.06, 0.44, -0.07], parent: brake },
    { title: 'Brake line', text: 'Carries hydraulic fluid from the master cylinders at the pedals to the caliper. Leaks show as red fluid.', at: [-0.2, 0.6, -0.05], parent: brake },
    { title: 'Oleo strut (shock absorber)', text: 'Air and oil inside the strut cushion the nose wheel. Check for correct extension and no oil leaks.', at: [0, 0.98, 0], parent: nose },
    { title: 'Torque link', text: 'A hinged “scissor” link that keeps the nose wheel aligned with the strut while letting it slide up and down.', at: [0, 0.52, 0.16], parent: link },
    { title: 'Shimmy damper', text: 'A small hydraulic damper that stops the nose wheel from vibrating side to side at speed.', at: [0.3, 0.98, 0.14], parent: damper },
    { title: 'Nose wheel & fork', text: 'Steered through the rudder pedals for taxiing.', at: [0, 0.48, 0.02], parent: fork },
  ];
  return {
    root, size: 1.8, labels, center: [0, 0.55, 0], view: [0.7, 0.35, 0.65],
    explode(e) { mWheel.position.x = 0.18 + e * 0.35; brake.position.x = e * 0.18; nWheel.position.y = 0.22 - e * 0.0; fork.position.y = -e * 0.18; damper.position.x = e * 0.2; link.position.z = e * 0.12; },
    update(dt, t, anim) {
      if (!anim) return;
      wheels.forEach(w => (w.rotation.x += dt * 4));
      piston.position.y = -Math.max(0, Math.sin(t * 1.6)) * 0.08;
    },
  };
}

// ================================================================== 6. INSTRUMENT PANEL
function drawGauge(c, S, kind, v) {
  const R = S / 2;
  c.save(); c.clearRect(0, 0, S, S); c.translate(R, R);
  const face = c.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  face.addColorStop(0, '#1a1e21'); face.addColorStop(1, '#0b0d0f');
  c.fillStyle = '#2b3034'; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
  c.fillStyle = face; c.beginPath(); c.arc(0, 0, R * 0.9, 0, TAU); c.fill();
  c.strokeStyle = '#eef1f2'; c.fillStyle = '#eef1f2'; c.lineCap = 'round';
  const ticks = (n, a0, a1, long = 5, labelsArr) => { for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; const L = i % long === 0 ? 0.16 : 0.08; c.lineWidth = i % long === 0 ? S * 0.012 : S * 0.006; c.beginPath(); c.moveTo(Math.sin(a) * R * 0.86, -Math.cos(a) * R * 0.86); c.lineTo(Math.sin(a) * R * (0.86 - L), -Math.cos(a) * R * (0.86 - L)); c.stroke(); if (labelsArr && i % long === 0) { const lab = labelsArr[i / long]; if (lab !== undefined) { c.font = `600 ${S * 0.085}px system-ui`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(lab, Math.sin(a) * R * 0.56, -Math.cos(a) * R * 0.56); } } } };
  const needle = (a, len = 0.78, w = 0.035, col = '#ffffff') => { c.save(); c.rotate(a); c.fillStyle = col; c.beginPath(); c.moveTo(-S * w / 2, R * 0.12); c.lineTo(0, -R * len); c.lineTo(S * w / 2, R * 0.12); c.closePath(); c.fill(); c.restore(); c.fillStyle = '#555'; c.beginPath(); c.arc(0, 0, R * 0.07, 0, TAU); c.fill(); };
  const title = (t, y = 0.3) => { c.fillStyle = '#c9d2d6'; c.font = `600 ${S * 0.07}px system-ui`; c.textAlign = 'center'; c.fillText(t, 0, R * y); };
  if (kind === 'asi') {
    const a = s => (-0.78 * Math.PI) + Math.min(1, s / 200) * 1.56 * Math.PI;
    const arc = (s0, s1, col, rr) => { c.strokeStyle = col; c.lineWidth = S * 0.035; c.beginPath(); c.arc(0, 0, R * rr, a(s0) - Math.PI / 2, a(s1) - Math.PI / 2); c.stroke(); };
    arc(40, 85, '#e9ecec', 0.8); arc(48, 128, '#38b05a', 0.86); arc(128, 163, '#e3c032', 0.86);
    c.strokeStyle = '#d63a2c'; c.lineWidth = S * 0.012; c.beginPath(); c.moveTo(Math.sin(a(163)) * R * 0.92, -Math.cos(a(163)) * R * 0.92); c.lineTo(Math.sin(a(163)) * R * 0.7, -Math.cos(a(163)) * R * 0.7); c.stroke();
    c.strokeStyle = '#eef1f2'; ticks(40, a(0), a(200), 5, ['', 25, 50, 75, 100, 125, 150, 175, 200]);
    title('KNOTS'); needle(a(v));
  } else if (kind === 'alt') {
    ticks(50, 0, TAU * 0.98, 5, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    title('ALT', 0.32); needle((v % 1000) / 1000 * TAU, 0.8, 0.03); needle((v % 10000) / 10000 * TAU, 0.5, 0.06, '#cfd6d9');
  } else if (kind === 'vsi') {
    const a = f => -Math.PI / 2 + THREE.MathUtils.clamp(f, -2000, 2000) / 2000 * Math.PI * 0.85;
    ticks(20, a(-2000), a(2000), 5, [2, 1, 0, 1, 2]);
    title('VERT SPEED', 0.32); needle(a(v));
  } else if (kind === 'ai') {
    c.save(); c.beginPath(); c.arc(0, 0, R * 0.86, 0, TAU); c.clip(); c.rotate(v.bank); c.translate(0, v.pitch * R * 0.02);
    c.fillStyle = '#3b7fc4'; c.fillRect(-R * 2, -R * 2, R * 4, R * 2); c.fillStyle = '#8a5a32'; c.fillRect(-R * 2, 0, R * 4, R * 2);
    c.strokeStyle = '#fff'; c.lineWidth = S * 0.012; c.beginPath(); c.moveTo(-R * 2, 0); c.lineTo(R * 2, 0); c.stroke();
    for (const p of [-20, -10, 10, 20]) { const y = -p * R * 0.02; c.lineWidth = S * 0.007; c.beginPath(); c.moveTo(-R * (p % 20 ? 0.12 : 0.22), y); c.lineTo(R * (p % 20 ? 0.12 : 0.22), y); c.stroke(); }
    c.restore();
    c.strokeStyle = '#f2b13a'; c.lineWidth = S * 0.025; c.beginPath(); c.moveTo(-R * 0.5, 0); c.lineTo(-R * 0.15, 0); c.lineTo(-R * 0.08, R * 0.08); c.moveTo(R * 0.5, 0); c.lineTo(R * 0.15, 0); c.lineTo(R * 0.08, R * 0.08); c.stroke();
    c.fillStyle = '#f2b13a'; c.beginPath(); c.arc(0, 0, R * 0.04, 0, TAU); c.fill();
  } else if (kind === 'hi') {
    c.save(); c.rotate(-v / 180 * Math.PI);
    for (let h = 0; h < 360; h += 5) { c.save(); c.rotate(h / 180 * Math.PI); c.lineWidth = h % 10 ? S * 0.006 : S * 0.012; c.beginPath(); c.moveTo(0, -R * 0.84); c.lineTo(0, -R * (h % 10 ? 0.76 : 0.7)); c.stroke(); if (h % 30 === 0) { c.font = `700 ${S * 0.09}px system-ui`; c.textAlign = 'center'; c.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[h] || h / 10, 0, -R * 0.54); } c.restore(); }
    c.restore();
    c.fillStyle = '#f2b13a'; c.beginPath(); c.moveTo(0, -R * 0.3); c.lineTo(-R * 0.18, R * 0.25); c.lineTo(0, R * 0.12); c.lineTo(R * 0.18, R * 0.25); c.closePath(); c.fill();
  } else if (kind === 'tc') {
    c.fillStyle = '#fff'; c.font = `600 ${S * 0.065}px system-ui`; c.textAlign = 'center'; c.fillText('L', -R * 0.62, R * 0.3); c.fillText('R', R * 0.62, R * 0.3); title('TURN COORDINATOR', -0.45);
    c.save(); c.rotate(v); c.strokeStyle = '#fff'; c.lineWidth = S * 0.03; c.beginPath(); c.moveTo(-R * 0.62, 0); c.lineTo(R * 0.62, 0); c.stroke(); c.beginPath(); c.arc(0, 0, R * 0.1, 0, TAU); c.fillStyle = '#fff'; c.fill(); c.restore();
    c.fillStyle = '#d7e0e3'; c.beginPath(); c.roundRect(-R * 0.4, R * 0.42, R * 0.8, R * 0.16, R * 0.08); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.arc(Math.sin(v) * R * 0.25, R * 0.5, R * 0.065, 0, TAU); c.fill();
  } else if (kind === 'rpm') {
    const a = r => (-0.75 * Math.PI) + Math.min(1, r / 3500) * 1.5 * Math.PI;
    c.strokeStyle = '#38b05a'; c.lineWidth = S * 0.035; c.beginPath(); c.arc(0, 0, R * 0.86, a(2100) - Math.PI / 2, a(2700) - Math.PI / 2); c.stroke();
    c.strokeStyle = '#eef1f2'; ticks(35, a(0), a(3500), 5, [0, 5, 10, 15, 20, 25, 30, 35]);
    title('RPM ×100'); needle(a(v));
  }
  c.restore();
}

function instrumentPanel(lab) {
  const M = materials(lab);
  const root = new THREE.Group();
  const panelMat = mat({ color: 0x24292d, roughness: 0.75 });
  const panel = new THREE.Group(); panel.position.set(0, 0.95, 0); root.add(panel);
  mesh(roundedBox(1.22, 0.46, 0.06, 0.02), panelMat, panel);
  // glareshield
  const gs = mesh(roundedBox(1.28, 0.06, 0.24, 0.02), mat({ color: 0x1a1e21, roughness: 0.9 }), panel); gs.position.set(0, 0.26, -0.08);
  const S = 256, gauges = {};
  const layout = [['asi', -0.47, 0.1], ['ai', -0.31, 0.1], ['alt', -0.15, 0.1], ['tc', -0.47, -0.08], ['hi', -0.31, -0.08], ['vsi', -0.15, -0.08], ['rpm', 0.03, 0.1]];
  for (const [k, x, y] of layout) {
    const ct = canvasTexture(S, S, null);
    const g = new THREE.Group(); g.position.set(x, y, 0.031); panel.add(g);
    const bezel = mesh(new THREE.TorusGeometry(0.07, 0.008, 10, 40), mat({ color: 0x15181a, metalness: 0.5, roughness: 0.4 }), g);
    const face = mesh(new THREE.CircleGeometry(0.07, 40), new THREE.MeshBasicMaterial({ map: ct.texture, toneMapped: false }), g, { cast: false });
    face.position.z = 0.002;
    const glass = mesh(new THREE.CircleGeometry(0.07, 40), phys({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, clearcoat: 1 }), g, { cast: false }); glass.position.z = 0.006;
    gauges[k] = { ct, g };
  }
  // radio & GPS stack with screens
  const scr = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#0c0f10'; c.fillRect(0, 0, 512, 512);
    const rows = [['COM1', '118.300', '121.500'], ['NAV1', '110.50', '113.90'], ['XPDR', '1200', 'ALT']];
    rows.forEach(([a, b, d], i) => { const y = 30 + i * 70; c.fillStyle = '#222a2e'; c.fillRect(10, y - 24, 492, 58); c.fillStyle = '#7fd6ff'; c.font = '700 26px ui-monospace,monospace'; c.fillText(a, 22, y + 14); c.fillStyle = '#5effa0'; c.fillText(b, 150, y + 14); c.fillStyle = '#9fb2ba'; c.fillText(d, 330, y + 14); });
    c.fillStyle = '#183c2a'; c.fillRect(10, 236, 492, 266); c.strokeStyle = '#5effa0'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(60, 460); c.lineTo(250, 330); c.lineTo(420, 280); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(250, 345); c.lineTo(238, 372); c.lineTo(262, 372); c.closePath(); c.fill();
    c.fillStyle = '#d0e7ff'; c.font = '600 22px system-ui'; c.fillText('GPS · TRAINING', 24, 266);
  });
  const stack = mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: scr.texture, toneMapped: false }), panel, { cast: false }); stack.position.set(0.32, 0.03, 0.032);
  // switches, magneto key, throttle and mixture, fuel selector
  const ctrls = new THREE.Group(); panel.add(ctrls);
  for (let i = 0; i < 6; i++) { box(ctrls, [0.012, 0.03, 0.02], [-0.5 + i * 0.05, -0.19, 0.045], M.aluminum); }
  const key = new THREE.Group(); key.position.set(-0.55, 0.0, 0.035); panel.add(key);
  cyl(key, 0.025, 0.025, 0.01, [0, 0, 0], M.steel, [Math.PI / 2, 0, 0], 20); box(key, [0.012, 0.035, 0.015], [0, 0, 0.012], mat({ color: 0xc9b26a, metalness: 0.9, roughness: 0.3 }));
  const quad = new THREE.Group(); quad.position.set(0.05, -0.15, 0.03); panel.add(quad);
  const throttle = new THREE.Group(); quad.add(throttle);
  rod(throttle, [0, 0, 0], [0, 0, 0.12], 0.006, M.steel); cyl(throttle, 0.022, 0.022, 0.03, [0, 0, 0.13], mat({ color: 0x111316, roughness: 0.5 }), [Math.PI / 2, 0, 0], 20);
  const mixture = new THREE.Group(); mixture.position.x = 0.08; quad.add(mixture);
  rod(mixture, [0, 0, 0], [0, 0, 0.11], 0.006, M.steel); cyl(mixture, 0.02, 0.02, 0.028, [0, 0, 0.12], mat({ color: 0xc22b20, roughness: 0.5 }), [Math.PI / 2, 0, 0], 20);
  // yokes on columns
  const yokes = [];
  for (const x of [-0.31, 0.32]) {
    const y = new THREE.Group(); y.position.set(x, -0.08, 0.03); panel.add(y);
    rod(y, [0, 0, 0], [0, 0, 0.24], 0.016, M.steel);
    const w = new THREE.Group(); w.position.z = 0.25; y.add(w);
    const grip = new THREE.Shape(); grip.moveTo(-0.15, 0.02); grip.lineTo(-0.15, 0.09); grip.lineTo(-0.1, 0.09); grip.lineTo(-0.07, 0.03); grip.lineTo(0.07, 0.03); grip.lineTo(0.1, 0.09); grip.lineTo(0.15, 0.09); grip.lineTo(0.15, 0.02); grip.quadraticCurveTo(0, -0.05, -0.15, 0.02);
    const gg = new THREE.ExtrudeGeometry(grip, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3 }); gg.translate(0, -0.03, -0.0125);
    mesh(gg, mat({ color: 0x15181a, roughness: 0.6 }), w);
    yokes.push(w);
  }
  // stand
  const blackPaint = mat({ color: 0x1f2326, roughness: 0.55 });
  box(root, [1.0, 0.04, 0.5], [0, 0.02, 0.05], blackPaint);
  rod(root, [0, 0.04, 0.05], [0, 0.72, -0.02], 0.03, blackPaint);
  const labels = [
    { title: 'Airspeed indicator', text: 'Shows speed through the air in knots. The coloured arcs mark flap, normal and caution ranges; the red line is never-exceed speed.', at: [-0.47, 0.19, 0.04], parent: panel },
    { title: 'Attitude indicator', text: 'An artificial horizon driven by a gyroscope. It shows pitch and bank, which is essential in cloud.', at: [-0.31, 0.19, 0.04], parent: panel },
    { title: 'Altimeter', text: 'Measures height above sea level from air pressure. Pilots set the local pressure setting before flight.', at: [-0.15, 0.19, 0.04], parent: panel },
    { title: 'Turn coordinator', text: 'Shows rate of turn and, with the ball, whether the turn is coordinated (step on the ball to centre it).', at: [-0.47, -0.17, 0.04], parent: panel },
    { title: 'Heading indicator', text: 'A gyroscopic compass card that is steady in turns. Align it with the magnetic compass regularly.', at: [-0.31, -0.17, 0.04], parent: panel },
    { title: 'Vertical speed indicator', text: 'Shows the rate of climb or descent in hundreds of feet per minute.', at: [-0.15, -0.17, 0.04], parent: panel },
    { title: 'Tachometer', text: 'Engine speed in revolutions per minute. The green arc is the normal operating range.', at: [0.03, 0.19, 0.04], parent: panel },
    { title: 'Radios, transponder & GPS', text: 'Communication and navigation radios, the transponder code (1200 for VFR in the U.S.) and a moving map.', at: [0.32, 0.2, 0.04], parent: panel },
    { title: 'Throttle (black) & mixture (red)', text: 'The throttle sets engine power; the mixture sets the fuel-to-air ratio and is pulled fully out to shut the engine down.', at: [0.09, -0.15, 0.17], parent: panel },
    { title: 'Yoke', text: 'Pull or push to pitch the nose; turn to roll. Each seat has its own, linked together.', at: [-0.31, 0.04, 0.29], parent: panel },
    { title: 'Ignition & magneto switch', text: 'Selects OFF, R, L, BOTH and START. Pilots check each magneto during the run-up.', at: [-0.55, 0.05, 0.04], parent: panel },
  ];
  let timer = 0;
  const draw = (t) => {
    const asi = 95 + Math.sin(t * 0.4) * 12, bank = Math.sin(t * 0.35) * 0.35;
    const vals = { asi, alt: 4500 + Math.sin(t * 0.2) * 250, vsi: Math.cos(t * 0.2) * 300, ai: { bank, pitch: Math.sin(t * 0.3) * 4 }, hi: (90 + t * 3) % 360, tc: bank * 0.6, rpm: 2400 + Math.sin(t * 0.7) * 60 };
    for (const [k, gg] of Object.entries(gauges)) { drawGauge(gg.ct.ctx, S, k, vals[k]); gg.ct.texture.needsUpdate = true; }
    yokes.forEach(w => (w.rotation.z = -bank * 0.8));
  };
  draw(0);
  return {
    root, size: 1.3, labels, center: [0, 0.95, 0.1], view: [0.3, 0.22, 1],
    explode(e) { Object.values(gauges).forEach((gg, i) => (gg.g.position.z = 0.031 + e * (0.12 + (i % 3) * 0.04))); stack.position.z = 0.032 + e * 0.1; quad.position.z = 0.03 + e * 0.15; },
    update(dt, t, anim) { if (!anim) return; timer -= dt; if (timer <= 0) { timer = 0.08; draw(t); } },
  };
}

// ================================================================== 7. COMPLETE AIRLINER
function airlinerFull(lab) {
  const a = buildAirliner(lab, { quality: 'high', cargoOpen: false });
  const root = new THREE.Group(); root.add(a.root);
  const labels = [
    { title: 'Flight deck', text: 'The cockpit, where two pilots fly the aircraft using glass displays, autopilot and fly-by-wire or cable controls.', at: [0, 5.3, -16.4] },
    { title: 'Fuselage', text: 'A pressurised aluminium (or composite) tube that carries passengers above and baggage and cargo below.', at: [0, 6.4, -5] },
    { title: 'Wing', text: 'Swept back to fly efficiently near the speed of sound. It holds fuel and carries the engines.', at: [10, 3.6, -0.4] },
    { title: 'Leading-edge slats', text: 'Slide forward and down for take-off and landing so the wing can fly slowly without stalling.', at: [-9, 3.4, -1.0] },
    { title: 'Trailing-edge flaps', text: 'Extend backward and down on rails (inside the pod-like fairings) to add lift and drag for landing.', at: [-6.5, 3.0, 2.6] },
    { title: 'Winglet', text: 'A swept tip that reduces wingtip vortices, saving fuel on long flights.', at: [17.7, 6.0, 4.0] },
    { title: 'Turbofan engine', text: 'A high-bypass turbofan on a pylon under each wing. Open the Turbofan engine model to see inside.', at: [-5.75, 3.0, -6.6] },
    { title: 'Horizontal stabilizer & elevators', text: 'The adjustable stabilizer trims the aircraft in pitch; elevators control pitch.', at: [4.5, 5.8, 17.4] },
    { title: 'Vertical stabilizer & rudder', text: 'The fin gives stability in yaw; the rudder steers and counters an engine failure on take-off.', at: [0, 9.6, 17.5] },
    { title: 'APU exhaust', text: 'The auxiliary power unit in the tail is a small turbine that provides power and air conditioning on the ground.', at: [0, 5.9, 20.4] },
    { title: 'Nose landing gear', text: 'Steerable twin wheels; ground crews connect the tow bar here for pushback.', at: [0, 1.6, -13.7] },
    { title: 'Main landing gear', text: 'Two-wheel main gear legs with multi-disc brakes carry most of the aircraft’s weight and retract into the belly.', at: [3.8, 2.0, 1.6] },
    { title: 'Cargo door', text: 'Forward and aft hold doors on the right side for baggage, cargo and mail.', at: [2.2, 3.4, -10.3] },
  ];
  return {
    root, size: 40, labels, airliner: a, center: [0, 4, 0], view: [0.62, 0.34, -0.74], realScaleWarning: true,
    explode(e) { a.engines.forEach((en, i) => { en.group.position.y = 1.72 - e * 1.4; en.group.position.x = (i ? 1 : -1) * (5.75 + e * 2.5); }); },
    update(dt, t, anim) { if (anim) a.engines.forEach(en => (en.fan.rotation.z += dt * 8)); },
  };
}

// ================================================================== 8. TURBOFAN ENGINE (cutaway)
function turbofan(lab) {
  const M = materials(lab);
  const root = new THREE.Group();
  const eng = new THREE.Group(); eng.position.y = 1.15; root.add(eng);
  const ti = mat({ color: 0x9aa3a9, metalness: 0.95, roughness: 0.28 });
  const steelM = mat({ color: 0x7c858b, metalness: 0.9, roughness: 0.32 });
  const hot = mat({ color: 0x6e5a4c, metalness: 0.85, roughness: 0.45 });
  const hotter = mat({ color: 0x7a4c34, metalness: 0.8, roughness: 0.5 });
  const cowl = phys({ color: 0xf2f2ee, metalness: 0.05, roughness: 0.28, clearcoat: 1, side: THREE.DoubleSide });
  const inner = mat({ color: 0x3a4045, metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide });
  const lp = new THREE.Group(), hp = new THREE.Group(); // spools
  eng.add(lp, hp);
  const modules = {};
  const mod = (k, z) => { const g = new THREE.Group(); g.userData.z = z; g.position.z = z; eng.add(g); modules[k] = g; return g; };

  // nacelle (cutaway quarter) with inlet lip and bypass duct
  const nac = mod('nacelle', 0);
  mesh(latheZ([[0.86, -1.55], [0.98, -1.5], [1.03, -1.25], [1.05, -0.6], [1.0, 0.25], [0.9, 0.75]], 64, true), cowl, nac);
  mesh(latheZ([[0.86, -1.55], [0.84, -1.2], [0.86, -0.85], [0.88, -0.2], [0.82, 0.75]], 64, true), inner, nac);
  const lip = mesh(new THREE.TorusGeometry(0.86, 0.05, 16, 64, Math.PI * 1.5), mat({ color: 0xd6dadc, metalness: 1, roughness: 0.2 }), nac); lip.position.z = -1.55; lip.rotation.z = Math.PI / 2;
  // outlet guide vanes in the bypass duct
  const ogv = mesh(ring(bladeGeo(0.52, 0.86, 0.12, 0.12, 0.25, 0.25, 0.008, 2), 36), steelM, nac); ogv.position.z = -0.45;
  // pylon on top and accessory gearbox below the fan case
  const pyl = new THREE.Group(); eng.add(pyl); modules.pylon = pyl; pyl.userData.z = 0;
  const pshape = new THREE.Shape(); pshape.moveTo(-1.2, 0); pshape.lineTo(1.4, 0); pshape.lineTo(1.0, 0.5); pshape.lineTo(-0.6, 0.5); pshape.closePath();
  const pg = new THREE.ExtrudeGeometry(pshape, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }); pg.translate(0, 0, -0.09); pg.rotateY(-Math.PI / 2);
  mesh(pg, cowl, pyl).position.y = 1.0;
  const agb = mod('gearbox', -0.7);
  mesh(roundedBox(0.5, 0.16, 0.3, 0.04), mat({ color: 0x4d5459, metalness: 0.6, roughness: 0.45 }), agb).position.y = -1.08;
  rod(agb, [0, -0.98, 0], [0, -0.5, 0.05], 0.025, steelM); // radial drive shaft
  // fan module: spinner + 22 wide-chord twisted blades (LP spool)
  const fan = mod('fan', -1.3);
  const spinner = mesh(latheZ([[0.001, -0.42], [0.09, -0.36], [0.18, -0.22], [0.24, -0.05], [0.25, 0.08]], 40), mat({ color: 0x1d2226, metalness: 0.8, roughness: 0.3 }), fan);
  const swirl = mesh(new THREE.TorusGeometry(0.12, 0.008, 6, 24, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff }), fan, { cast: false }); swirl.position.z = -0.31;
  const fanBlades = mesh(ring(bladeGeo(0.24, 0.83, 0.32, 0.4, 0.95, 0.25, 0.02, 12, -0.08), 22), ti, fan);
  // LP compressor (booster): 3 stages
  const lpc = mod('lpc', -0.95);
  for (let s = 0; s < 3; s++) { const r0 = 0.3, r1 = 0.47 - s * 0.015; const st = mesh(ring(bladeGeo(r0, r1, 0.06, 0.05, 0.7, 0.5, 0.006, 3), 48, s * 0.1), ti, lpc); st.position.z = s * 0.09; cyl(lpc, r0, r0, 0.04, [0, 0, s * 0.09], steelM, [Math.PI / 2, 0, 0], 32); }
  // core casing (cutaway) around compressor-combustor-turbine
  const core = mod('core', 0);
  mesh(latheZ([[0.5, -1.0], [0.48, -0.6], [0.38, -0.2], [0.36, 0.3], [0.42, 0.8], [0.45, 1.3], [0.38, 1.75]], 56, true), cowl, core);
  // HP compressor: 9 stages, shrinking
  const hpc = mod('hpc', -0.55);
  for (let s = 0; s < 9; s++) { const r1 = 0.36 - s * 0.012, r0 = 0.2 + s * 0.006; const st = mesh(ring(bladeGeo(r0, r1, 0.035, 0.03, 0.75, 0.55, 0.004, 2), 56, s * 0.05), steelM, hpc); st.position.z = s * 0.055; cyl(hpc, r0, r0, 0.025, [0, 0, s * 0.055], steelM, [Math.PI / 2, 0, 0], 32); }
  // combustor: annular chamber with fuel nozzles and an animated glow
  const comb = mod('combustor', 0.05);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x2a1408, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 0.6, side: THREE.DoubleSide });
  mesh(latheZ([[0.24, 0], [0.33, 0.02], [0.35, 0.2], [0.31, 0.32], [0.25, 0.3], [0.24, 0]], 48, true), glowMat, comb);
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; if (a > 0 && a < Math.PI * 0.5) continue; cyl(comb, 0.012, 0.012, 0.08, [Math.cos(a) * 0.3, Math.sin(a) * 0.3, -0.02], mat({ color: 0xc9964f, metalness: 0.8, roughness: 0.3 }), [Math.PI / 2, 0, 0], 8); }
  // HP turbine: 1-2 stages; LP turbine: 4 stages growing
  const hpt = mod('hpt', 0.45);
  for (let s = 0; s < 2; s++) { const st = mesh(ring(bladeGeo(0.24, 0.33, 0.04, 0.035, -0.6, -0.4, 0.008, 2), 60, s * 0.07), hotter, hpt); st.position.z = s * 0.07; cyl(hpt, 0.24, 0.24, 0.03, [0, 0, s * 0.07], hot, [Math.PI / 2, 0, 0], 32); }
  const lpt = mod('lpt', 0.7);
  for (let s = 0; s < 4; s++) { const r1 = 0.36 + s * 0.02; const st = mesh(ring(bladeGeo(0.24, r1, 0.045, 0.04, -0.7, -0.5, 0.006, 2), 64, s * 0.06), hot, lpt); st.position.z = s * 0.1; cyl(lpt, 0.24, 0.24, 0.03, [0, 0, s * 0.1], hot, [Math.PI / 2, 0, 0], 32); }
  // exhaust nozzle and plug
  const noz = mod('nozzle', 1.25);
  mesh(latheZ([[0.44, 0], [0.42, 0.3], [0.36, 0.55]], 48, true), mat({ color: 0x5f6468, metalness: 0.85, roughness: 0.4, side: THREE.DoubleSide }), noz);
  mesh(latheZ([[0.22, 0], [0.2, 0.3], [0.12, 0.6], [0.001, 0.82]], 40), mat({ color: 0x3a3d40, metalness: 0.8, roughness: 0.5 }), noz);
  // shafts: LP (inner, long) and HP (outer, short)
  const lpShaft = cyl(lp, 0.035, 0.035, 2.4, [0, 0, -0.1], mat({ color: 0xc9964f, metalness: 0.9, roughness: 0.3 }), [Math.PI / 2, 0, 0], 16);
  const hpShaft = cyl(hp, 0.07, 0.07, 1.05, [0, 0, -0.05], mat({ color: 0x4f8fc2, metalness: 0.8, roughness: 0.3 }), [Math.PI / 2, 0, 0], 20);
  // stand
  const blackPaint = mat({ color: 0x1f2326, roughness: 0.55 });
  box(root, [1.4, 0.05, 3.2], [0, 0.025, 0.1], blackPaint);
  for (const z of [-0.7, 0.8]) { rod(root, [0, 0.05, z], [0, 0.6, z], 0.04, blackPaint); const cr = mesh(new THREE.TorusGeometry(0.55, 0.03, 8, 24, Math.PI), blackPaint, root); cr.position.set(0, 1.15, z); cr.rotation.z = Math.PI; }

  const labels = [
    { title: 'Fan', text: 'The large front fan pushes most of the air around the engine core through the bypass duct. In a high-bypass engine that air makes most of the thrust.', at: [0.0, 0.62, 0.05], parent: fan },
    { title: 'Spinner', text: 'The cone at the centre of the fan. The painted swirl lets ground crew see at a glance that the fan is turning.', at: [0, 0.12, -0.32], parent: fan },
    { title: 'Nacelle & inlet', text: 'The streamlined cowling. Its inlet slows incoming air smoothly before it reaches the fan.', at: [-0.7, 0.7, -1.2], parent: nac },
    { title: 'Bypass duct', text: 'Air from the fan flows around the core here and leaves through the back of the nacelle.', at: [0, -0.72, 0.1], parent: nac },
    { title: 'Low-pressure compressor (booster)', text: 'A few stages on the same shaft as the fan start squeezing the air entering the core.', at: [0, 0.42, 0.1], parent: lpc },
    { title: 'High-pressure compressor', text: 'Many stages of small blades squeeze the air to many times outside pressure before it reaches the combustor.', at: [0, 0.33, 0.25], parent: hpc },
    { title: 'Combustion chamber', text: 'Fuel nozzles spray kerosene into the compressed air, where it burns continuously at very high temperature.', at: [0, 0.37, 0.15], parent: comb },
    { title: 'High-pressure turbine', text: 'Hot gas spins these blades, which drive the high-pressure compressor through the HP shaft (blue).', at: [0, 0.34, 0.03], parent: hpt },
    { title: 'Low-pressure turbine', text: 'Further stages extract energy to drive the fan and booster through the long LP shaft (gold).', at: [0, 0.42, 0.15], parent: lpt },
    { title: 'Exhaust nozzle & plug', text: 'The remaining hot core gas leaves here, adding to the thrust.', at: [0, 0.3, 0.5], parent: noz },
    { title: 'Accessory gearbox', text: 'Driven from the engine core; it runs the fuel pump, oil pumps, hydraulic pump and electrical generator.', at: [0, -1.2, 0], parent: agb },
    { title: 'Pylon', text: 'Attaches the engine to the wing and carries fuel, electrical and bleed-air lines.', at: [0, 1.5, 0.2], parent: pyl },
  ];
  return {
    root, size: 3.2, labels, center: [0, 1.15, 0], view: [0.66, 0.3, -0.7],
    explode(e) {
      const order = { fan: -1.0, lpc: -0.6, hpc: -0.25, combustor: 0.15, hpt: 0.45, lpt: 0.75, nozzle: 1.1, gearbox: -0.2 };
      for (const [k, g] of Object.entries(modules)) {
        if (k === 'nacelle') g.position.y = e * 1.0;
        else if (k === 'core') g.position.y = e * 0.65;
        else if (k === 'pylon') g.position.y = e * 1.3;
        else if (k === 'gearbox') g.position.y = -e * 0.35;
        else g.position.z = g.userData.z + (order[k] || 0) * e * 0.9;
      }
      lp.visible = hp.visible = e < 0.2;
    },
    update(dt, t, anim) {
      if (!anim) return;
      for (const k of ['fan', 'lpc', 'lpt']) modules[k].rotation.z += dt * 3.2;
      for (const k of ['hpc', 'hpt']) modules[k].rotation.z += dt * 7.5;
      lpShaft.rotation.y += dt * 3.2; hpShaft.rotation.y += dt * 7.5;
      glowMat.emissiveIntensity = 1.4 + Math.sin(t * 13) * 0.15 + Math.sin(t * 7.3) * 0.1;
    },
  };
}

// ================================================================== 9. AIRLINER MAIN LANDING GEAR
function airlinerGear(lab) {
  const M = materials(lab);
  const root = new THREE.Group();
  const paint = phys({ color: 0xf3f2ec, metalness: 0.05, roughness: 0.3, clearcoat: 1 });
  const chrome = mat({ color: 0xe1e4e6, metalness: 1, roughness: 0.12 });
  const grey = mat({ color: 0x8a9196, metalness: 0.7, roughness: 0.4 });
  const wheels = [];
  const wheel = (x) => {
    const g = new THREE.Group(); g.position.set(x, 0.58, 0); root.add(g);
    const tire = mesh(new THREE.TorusGeometry(0.42, 0.16, 20, 56), M.rubber, g); tire.rotation.y = Math.PI / 2; tire.scale.z = 1.15;
    for (const s of [-0.1, 0, 0.1]) { const gr = mesh(new THREE.TorusGeometry(0.581, 0.008, 6, 56), mat({ color: 0x050607, roughness: 1 }), g); gr.rotation.y = Math.PI / 2; gr.position.x = s; }
    const hub = new THREE.Group(); g.add(hub);
    cyl(hub, 0.28, 0.28, 0.3, [0, 0, 0], M.aluminum, [0, 0, Math.PI / 2], 40);
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; cyl(hub, 0.014, 0.014, 0.32, [0, Math.cos(a) * 0.17, Math.sin(a) * 0.17], M.steel, [0, 0, Math.PI / 2], 8); }
    wheels.push(hub);
    // multi-disc carbon brake stack on the inboard side
    const brake = new THREE.Group(); g.add(brake);
    for (let k = 0; k < 6; k++) cyl(brake, 0.25, 0.25, 0.018, [-Math.sign(x) * (0.18 + k * 0.022), 0, 0], k % 2 ? mat({ color: 0x2b2b2b, roughness: 0.9 }) : grey, [0, 0, Math.PI / 2], 36);
    return { g, brake };
  };
  const L = wheel(-0.42), R = wheel(0.42);
  // axle, shock strut (oleo), side brace, torque links, actuator
  const strut = new THREE.Group(); root.add(strut);
  rod(strut, [-0.55, 0.58, 0], [0.55, 0.58, 0], 0.07, M.steel);
  cyl(strut, 0.16, 0.16, 1.6, [0, 2.0, -0.12], paint, null, 32);
  const piston = cyl(strut, 0.12, 0.12, 0.9, [0, 1.05, -0.05], chrome, null, 32);
  rod(strut, [0, 1.3, -0.25], [0, 0.85, -0.3], 0.03, M.steel); rod(strut, [0, 0.85, -0.3], [0, 0.62, -0.08], 0.03, M.steel); // torque link
  const brace = new THREE.Group(); root.add(brace);
  rod(brace, [0.1, 2.6, -0.1], [1.2, 3.0, 0.6], 0.05, grey); rod(brace, [0.1, 2.0, -0.1], [1.2, 3.0, 0.6], 0.045, grey);
  const act = new THREE.Group(); root.add(act);
  rod(act, [-0.1, 2.5, -0.2], [-0.8, 3.0, -0.9], 0.06, mat({ color: 0x3a4248, metalness: 0.6, roughness: 0.4 }));
  rod(act, [-0.1, 2.5, -0.2], [-0.45, 2.75, -0.55], 0.035, chrome);
  const door = new THREE.Group(); root.add(door);
  const dm = box(door, [0.04, 1.3, 1.1], [-0.32, 2.1, 0.45], paint); dm.rotation.y = 0.2;
  const hyd = mat({ color: 0x2b2f33, roughness: 0.5 });
  tube(root, [[0.1, 2.8, 0.05], [0.18, 1.6, 0.05], [0.2, 0.75, 0.05]], 0.012, hyd, 6);
  box(root, [1.6, 0.03, 1.4], [0, 0.015, 0], mat({ color: 0x2b3135, roughness: 0.8 }));
  const labels = [
    { title: 'Shock strut (oleo)', text: 'A nitrogen and hydraulic-oil shock absorber that cushions touchdown and supports the aircraft’s weight.', at: [0, 2.3, -0.1], parent: strut },
    { title: 'Chrome piston', text: 'The sliding inner cylinder. Mechanics check its exposed length to confirm correct servicing.', at: [0.14, 1.2, -0.05], parent: strut },
    { title: 'Torque links', text: 'Keep the wheels aligned with the strut while it compresses.', at: [0, 0.9, -0.34], parent: strut },
    { title: 'Wheels & tires', text: 'High-pressure tires, inflated with nitrogen, inspected for wear, cuts and pressure before departure.', at: [0.42, 1.25, 0], parent: root },
    { title: 'Carbon brakes', text: 'A stack of rotating and stationary discs squeezed by hydraulic pistons. Brakes get very hot after landing.', at: [0.2, 0.9, 0], parent: R.g },
    { title: 'Side brace', text: 'Locks the gear down and carries side loads. It folds when the gear retracts.', at: [0.7, 2.9, 0.3], parent: brace },
    { title: 'Retraction actuator', text: 'A hydraulic cylinder that swings the gear up into the wheel well after take-off.', at: [-0.5, 2.95, -0.6], parent: act },
    { title: 'Gear door', text: 'Closes over the wheel well to keep the belly streamlined in flight.', at: [-0.32, 2.8, 0.45], parent: door },
  ];
  return {
    root, size: 3.6, labels, center: [0, 1.6, 0], view: [0.72, 0.3, 0.62],
    explode(e) { L.g.position.x = -0.42 - e * 0.5; R.g.position.x = 0.42 + e * 0.5; L.brake.position.x = e * 0.2; R.brake.position.x = -e * 0.2; door.position.x = -e * 0.6; act.position.x = -e * 0.4; brace.position.x = e * 0.4; },
    update(dt, t, anim) { if (!anim) return; wheels.forEach(w => (w.rotation.x += dt * 3)); piston.position.y = 1.05 + Math.sin(t * 1.5) * 0.06; },
  };
}

// ------------------------------------------------------------------ catalogue
export const CATALOG = [
  { id: 'trainer', group: 'Training airplane', title: 'Training airplane', blurb: 'A complete four-seat, high-wing trainer. Explode it to see the engine, fuel and electrical systems.', build: trainerFull, thumb: 'ar-trainer' },
  { id: 'piston', group: 'Training airplane', title: 'Piston engine & propeller', blurb: 'A horizontally opposed four-cylinder engine with dual ignition and a fixed-pitch propeller.', build: pistonEngine, thumb: 'ar-piston' },
  { id: 'wing', group: 'Training airplane', title: 'Wing structure', blurb: 'A see-through wing section: spars, ribs, fuel tank, aileron, flap, lights and pitot tube.', build: wingSection, thumb: 'ar-wing' },
  { id: 'tail', group: 'Training airplane', title: 'Tail (empennage)', blurb: 'Stabilizers, elevator, trim tab, rudder and the cables that move them.', build: empennage, thumb: 'ar-tail' },
  { id: 'gear', group: 'Training airplane', title: 'Landing gear', blurb: 'Spring-steel main gear with disc brakes and a nose gear with oleo strut, torque link and shimmy damper.', build: landingGear, thumb: 'ar-gear' },
  { id: 'panel', group: 'Training airplane', title: 'Instrument panel', blurb: 'The “six-pack” flight instruments, engine gauge, radios, throttle, mixture and yokes, with live needles.', build: instrumentPanel, thumb: 'ar-panel' },
  { id: 'airliner', group: 'Airliner', title: 'Narrow-body airliner', blurb: 'An original twin-engine airliner: flight deck, swept wings, slats and flaps, winglets, tail and gear.', build: airlinerFull, thumb: 'ar-airliner' },
  { id: 'turbofan', group: 'Airliner', title: 'Turbofan engine (cutaway)', blurb: 'Fan, compressors, combustor and turbines on two spinning spools. Explode it stage by stage.', build: turbofan, thumb: 'ar-turbofan' },
  { id: 'jetgear', group: 'Airliner', title: 'Main landing gear', blurb: 'Oleo shock strut, torque links, carbon brakes, side brace and retraction actuator.', build: airlinerGear, thumb: 'ar-jetgear' },
];
